"""Plot Slope Statistics Generator

This script analyzes cadastral plots and calculates statistics about their slope distributions.
It outputs a new FlatGeobuf file containing the original plot geometries enriched with:
- Total area
- Area under each slope class (10-20%, 20-25%, 25-35%, >35%)
- has_slope_data: boolean indicating if the plot intersects with slope data

Algorithm:
1. Spatial Indexing:
   - Divides the study area into a grid
   - Groups plots by spatial location to optimize processing
   - Ensures each plot is processed exactly once

2. Parallel Processing:
   - Processes spatial groups in parallel using multiple CPU cores
   - Uses weighted moving averages to track progress and estimate completion time
   
3. Area-Weighted Slope Analysis:
   - For each plot:
     - Converts geometry to appropriate coordinate systems (raster CRS for intersection, UTM for area)
     - Extracts slope values from pixels that intersect with the plot
     - Calculates precise intersection area between each pixel and the plot
     - Weights slope values by their intersection area to get accurate slope distribution
     - Classifies weighted slopes into predefined categories
     
4. Results Storage:
   - Periodically saves progress for recovery in case of interruption
   - Generates final outputs with slope statistics for each plot
   - Creates regional aggregations by administrative boundaries

Usage:
    python plot_slope_statistics.py <cadastral_geojson> <slope_raster> [--debug]

Example:
    python plot_slope_statistics.py amche-plot-geocoder/src/onemap/plots.fgb slope/cartodem_30m_slope.tif
    python plot_slope_statistics.py amche-plot-geocoder/src/onemap/plots.fgb slope/cartodem_30m_slope.tif --debug

"""

import sys
import os
import geopandas as gpd
import pandas as pd
import numpy as np
import rasterio
from rasterio.features import geometry_mask
from rasterio.windows import Window, from_bounds, intersection
from rasterio.transform import from_origin
import multiprocessing as mp
from typing import Dict, List, Tuple, Optional
from tqdm import tqdm
import math
from shapely.geometry import box
import logging
import time
import warnings
from datetime import datetime
import json
from collections import defaultdict
import threading
import queue
import argparse

# Suppress ALL rasterio and fiona related warnings
logging.getLogger('rasterio').setLevel(logging.ERROR)
logging.getLogger('fiona').setLevel(logging.ERROR)
warnings.filterwarnings('ignore', category=Warning)
os.environ['GDAL_PAM_ENABLED'] = 'NO'
os.environ['AWS_NO_SIGN_REQUEST'] = 'YES'
os.environ['CPL_DEBUG'] = 'OFF'

# Configure logging to show only INFO and ERROR, with a cleaner format
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(message)s',
    datefmt='%H:%M:%S'
)

# Define slope classes
SLOPE_CLASSES = [
    (10, 20, 'pct_slope_10_20'),
    (20, 25, 'pct_slope_20_25'),
    (25, 35, 'pct_slope_25_35'),
    (35, float('inf'), 'pct_slope_35_inf')
]

# Get the directory where the script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "output")

# Global progress tracking
progress_tracker = {
    'total_plots': 0,
    'processed_plots': 0,
    'start_time': time.time(),
    'group_progress': defaultdict(lambda: {
        'processed': 0, 
        'total': 0, 
        'start_time': None,
        'last_update_time': None,
        'processing_rates': [],  # List to store historical processing rates
        'ewma_rate': None  # Exponential weighted moving average rate
    }),
    'lock': threading.Lock(),
    'overall_ewma_rate': None,  # Overall exponential weighted moving average rate
    'last_progress_print': 0  # Timestamp of last progress print
}

def calculate_ewma(current_rate: float, previous_ewma: float = None, alpha: float = 0.1) -> float:
    """Calculate exponential weighted moving average with smoothing factor alpha"""
    if previous_ewma is None:
        return current_rate
    return alpha * current_rate + (1 - alpha) * previous_ewma

def update_progress(group_index: int, processed: int, total: int):
    """Update progress and print status with smoothed estimates"""
    current_time = time.time()
    
    # Only update at most once per second to avoid too frequent updates
    if current_time - progress_tracker['last_progress_print'] < 1:
        return
        
    with progress_tracker['lock']:
        group_data = progress_tracker['group_progress'][group_index]
        
        # Update group progress
        group_data['processed'] = processed
        
        # Calculate group processing rate
        if group_data['last_update_time'] is not None:
            time_delta = current_time - group_data['last_update_time']
            if time_delta > 0:
                plots_delta = processed - group_data['last_processed']
                current_rate = plots_delta / time_delta
                
                # Update EWMA rate for group
                group_data['ewma_rate'] = calculate_ewma(
                    current_rate, 
                    group_data['ewma_rate']
                )
        
        # Store current values for next update
        group_data['last_update_time'] = current_time
        group_data['last_processed'] = processed
        
        # Calculate overall progress
        total_processed = sum(g['processed'] for g in progress_tracker['group_progress'].values())
        total_plots = sum(g['total'] for g in progress_tracker['group_progress'].values())
        
        if total_plots > 0:
            # Calculate overall processing rate
            elapsed_time = current_time - progress_tracker['start_time']
            overall_rate = total_processed / elapsed_time if elapsed_time > 0 else 0
            
            # Update overall EWMA rate
            progress_tracker['overall_ewma_rate'] = calculate_ewma(
                overall_rate,
                progress_tracker['overall_ewma_rate']
            )
            
            # Use EWMA rate for time estimation
            stable_rate = progress_tracker['overall_ewma_rate'] or overall_rate
            remaining_plots = total_plots - total_processed
            estimated_remaining_seconds = remaining_plots / stable_rate if stable_rate > 0 else 0
            
            # Format time remaining
            hours = int(estimated_remaining_seconds // 3600)
            minutes = int((estimated_remaining_seconds % 3600) // 60)
            seconds = int(estimated_remaining_seconds % 60)
            
            # Calculate completion percentage
            pct_complete = (total_processed / total_plots) * 100
            
            # Create progress summary
            status = (
                f"\nOverall Progress: {pct_complete:.1f}% "
                f"({total_processed:,}/{total_plots:,} plots)\n"
                f"Stable processing rate: {stable_rate:.1f} plots/sec\n"
                f"Elapsed time: {int(elapsed_time//3600):02d}:{int((elapsed_time%3600)//60):02d}:{int(elapsed_time%60):02d}\n"
                f"Estimated time remaining: {hours:02d}:{minutes:02d}:{seconds:02d}\n"
                f"\nActive Groups Progress:\n"
            )
            
            # Add individual group progress
            for idx, group in sorted(progress_tracker['group_progress'].items()):
                if group['processed'] < group['total']:  # Only show active groups
                    group_pct = (group['processed'] / group['total']) * 100
                    group_time = current_time - group['start_time'] if group['start_time'] else 0
                    group_rate = group['ewma_rate'] or (group['processed'] / group_time if group_time > 0 else 0)
                    status += (
                        f"  Group {idx:2d}: {group_pct:6.1f}% "
                        f"({group['processed']:,}/{group['total']:,} plots) "
                        f"@ {group_rate:.1f} plots/sec\n"
                    )
            
            # Clear previous lines and print new status
            print("\033[2J\033[H")  # Clear screen and move cursor to top
            print(status)
            
            progress_tracker['last_progress_print'] = current_time

def create_spatial_index(gdf: gpd.GeoDataFrame, raster_path: str, grid_size: int = 4) -> List[Tuple[gpd.GeoDataFrame, Tuple]]:
    """
    Create a spatial index by dividing the area into a grid and grouping plots
    """
    try:
        with rasterio.open(raster_path) as src:
            # Convert plots to raster CRS if needed
            if gdf.crs != src.crs:
                logging.info(f"Converting plots from {gdf.crs} to {src.crs}")
                gdf = gdf.to_crs(src.crs)
            
            # Get raster bounds
            raster_bounds = src.bounds
            plot_bounds = gdf.total_bounds
            
            # Calculate intersection
            minx = max(plot_bounds[0], raster_bounds.left)
            miny = max(plot_bounds[1], raster_bounds.bottom)
            maxx = min(plot_bounds[2], raster_bounds.right)
            maxy = min(plot_bounds[3], raster_bounds.top)
            
            if minx >= maxx or miny >= maxy:
                raise ValueError("No overlap between plots and raster data")
            
            # Calculate grid
            width = maxx - minx
            height = maxy - miny
            
            cell_width = width / grid_size
            cell_height = height / grid_size
            
            # Add a small buffer to ensure we don't miss edge pixels
            buffer_size = max(abs(src.transform.a), abs(src.transform.e)) * 2
            
            spatial_groups = []
            processed_plots = set()  # Track which plots have been processed
            
            for i in range(grid_size):
                for j in range(grid_size):
                    cell_minx = minx + (i * cell_width)
                    cell_miny = miny + (j * cell_height)
                    cell_maxx = cell_minx + cell_width
                    cell_maxy = cell_miny + cell_height
                    
                    # Create cell with buffer
                    cell = box(
                        cell_minx - buffer_size,
                        cell_miny - buffer_size,
                        cell_maxx + buffer_size,
                        cell_maxy + buffer_size
                    )
                    
                    # Find plots that intersect with this cell
                    mask = gdf.intersects(cell)
                    if mask.any():
                        # Filter out already processed plots
                        new_plots = gdf[mask].copy()
                        new_plots = new_plots[~new_plots.index.isin(processed_plots)]
                        
                        if len(new_plots) > 0:
                            bounds = (cell_minx, cell_miny, cell_maxx, cell_maxy)
                            spatial_groups.append((new_plots, bounds))
                            processed_plots.update(new_plots.index)
            
            logging.info(f"Created {len(spatial_groups)} spatial groups containing {len(processed_plots)} unique plots")
            return spatial_groups
            
    except Exception as e:
        logging.error(f"Error in create_spatial_index: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        raise

def get_valid_window(bounds: Tuple[float, float, float, float], 
                    src_transform: rasterio.Affine,
                    src_shape: Tuple[int, int]) -> Tuple[Window, rasterio.Affine]:
    """
    Get a valid raster window from bounds, ensuring it's within the raster extent
    """
    # Add a much larger buffer to ensure we capture all relevant pixels
    buffer_size = max(abs(src_transform.a), abs(src_transform.e)) * 10  # Increased buffer significantly
    buffered_bounds = (
        bounds[0] - buffer_size,
        bounds[1] - buffer_size,
        bounds[2] + buffer_size,
        bounds[3] + buffer_size
    )
    
    # Convert bounds to pixel coordinates
    window = from_bounds(*buffered_bounds, src_transform)
    
    # Round to integers and ensure positive width/height
    col_start = max(0, int(window.col_off - 1))  # Extra padding
    row_start = max(0, int(window.row_off - 1))  # Extra padding
    col_stop = min(src_shape[1], int(window.col_off + window.width + 2))  # Extra padding
    row_stop = min(src_shape[0], int(window.row_off + window.height + 2))  # Extra padding
    
    # Ensure window has positive dimensions
    width = max(1, col_stop - col_start)
    height = max(1, row_stop - row_start)
    
    valid_window = Window(col_start, row_start, width, height)
    window_transform = rasterio.windows.transform(valid_window, src_transform)
    
    return valid_window, window_transform

def validate_slope_values(slope_data: np.ndarray, src, mask=None) -> None:
    """Validate slope values in the raster data"""
    if slope_data.size == 0:
        logging.warning("Empty slope data array")
        return
        
    # Create valid mask considering nodata values
    valid_mask = slope_data != src.nodata if src.nodata is not None else np.ones_like(slope_data, dtype=bool)
    if mask is not None:
        valid_mask = valid_mask & mask
    valid_slopes = slope_data[valid_mask]
    
    if valid_slopes.size == 0:
        logging.warning("No valid slope values found")
        return
        
    # Calculate basic statistics
    stats = {
        'min': np.min(valid_slopes),
        'max': np.max(valid_slopes),
        'mean': np.mean(valid_slopes),
        'median': np.median(valid_slopes),
        'std': np.std(valid_slopes),
        'count': len(valid_slopes)
    }
    
    logging.info("Slope statistics:")
    for key, value in stats.items():
        if key != 'count':
            logging.info(f"  {key}: {value:.2f}")
        else:
            logging.info(f"  {key}: {value}")
    
    # Calculate histogram of slope values
    hist, bin_edges = np.histogram(valid_slopes, bins=[0, 10, 20, 25, 35, float('inf')])
    total_pixels = len(valid_slopes)
    
    logging.info("Slope distribution:")
    for i in range(len(hist)):
        start = bin_edges[i]
        end = bin_edges[i+1]
        pixel_count = hist[i]
        percentage = (pixel_count / total_pixels) * 100
        logging.info(f"  {start:.1f}-{end if end != float('inf') else 'inf'}%: {pixel_count} pixels ({percentage:.2f}% of total)")
    
    # Check for potentially invalid values
    if stats['max'] > 100:
        logging.warning(f"Found slope values > 100% (max: {stats['max']:.2f}%)")
    if stats['min'] < 0:
        logging.warning(f"Found negative slope values (min: {stats['min']:.2f}%)")

def validate_slope_classification(slopes: np.ndarray, areas: np.ndarray) -> Dict[str, float]:
    """
    Validate that slopes are classified correctly and return percentages
    """
    if len(slopes) == 0:
        return {key: 0.0 for _, _, key in SLOPE_CLASSES}
        
    total_area = np.sum(areas)
    result = {}
    
    # First verify each slope value is classified exactly once
    classified_mask = np.zeros_like(slopes, dtype=bool)
    
    for min_slope, max_slope, key in SLOPE_CLASSES:
        class_mask = (slopes >= min_slope) & (slopes < max_slope)
        
        # Check for any slopes that would be classified multiple times
        if np.any(classified_mask & class_mask):
            overlap_slopes = slopes[classified_mask & class_mask]
            logging.error(f"Slopes {overlap_slopes} classified multiple times!")
            
        classified_mask = classified_mask | class_mask
        
        # Calculate percentage for this class
        area_in_class = np.sum(areas[class_mask])
        percentage = (area_in_class / total_area) * 100 if total_area > 0 else 0
        result[key] = round(percentage, 2)
        
        # Detailed validation for this class
        if np.any(class_mask):
            slopes_in_class = slopes[class_mask]
            if np.any(slopes_in_class < min_slope) or np.any(slopes_in_class >= max_slope):
                logging.error(f"Found slopes outside class bounds in {key}:")
                logging.error(f"  Min slope in class: {np.min(slopes_in_class):.2f}%")
                logging.error(f"  Max slope in class: {np.max(slopes_in_class):.2f}%")
                logging.error(f"  Expected range: [{min_slope}, {max_slope})")
    
    # Add a special case for slopes below our minimum classification (0-10%)
    min_classification = min(min_slope for min_slope, _, _ in SLOPE_CLASSES)
    unclassified_mask = slopes < min_classification
    if np.any(unclassified_mask):
        area_below_min = np.sum(areas[unclassified_mask])
        percentage_below_min = (area_below_min / total_area) * 100 if total_area > 0 else 0
        result['pct_slope_below_min'] = round(percentage_below_min, 2)
        
        if result['pct_slope_below_min'] > 0:
            logging.info(f"Found {result['pct_slope_below_min']:.2f}% of area with slopes below {min_classification}%")
    else:
        result['pct_slope_below_min'] = 0.0
    
    # Check for any other unclassified slopes
    if not np.all(classified_mask | unclassified_mask):
        unclassified_slopes = slopes[~(classified_mask | unclassified_mask)]
        logging.error(f"Found unclassified slopes: {unclassified_slopes}")
    
    return result

def calculate_plot_statistics_windowed(
    plot_geom: gpd.GeoSeries,
    raster_path: str,
    bounds: Tuple[float, float, float, float],
    plot_id: Optional[int] = None
) -> Dict:
    try:
        # Get the CRS from the raster
        with rasterio.open(raster_path) as src:
            raster_crs = src.crs
            
        # Special debugging for plot 7589461
        is_debug_plot = plot_id == 7589461
        if is_debug_plot:
            logging.info("=== Processing debug plot 7589461 ===")

        # Ensure plot geometry is in raster CRS for slope analysis
        if not isinstance(plot_geom, gpd.GeoSeries):
            plot_geom = gpd.GeoSeries([plot_geom], crs=raster_crs)
        elif plot_geom.crs != raster_crs:
            plot_geom = plot_geom.to_crs(raster_crs)
            
        # Calculate area in UTM (do this separately)
        centroid = plot_geom.centroid.iloc[0]
        lon = centroid.x
        utm_zone = int((lon + 180) / 6) + 1
        utm_crs = f"EPSG:326{utm_zone:02d}"  # Northern hemisphere
        if centroid.y < 0:
            utm_crs = f"EPSG:327{utm_zone:02d}"  # Southern hemisphere
            
        # Convert to UTM for accurate area calculation
        plot_utm = plot_geom.to_crs(utm_crs)
        plot_geometry_utm = plot_utm.iloc[0]
        
        # Get the area from shape_area if available, otherwise calculate
        if hasattr(plot_geom, 'shape_area') and not pd.isna(plot_geom.shape_area.iloc[0]):
            plot_area = float(plot_geom.shape_area.iloc[0])
        else:
            plot_area = plot_geometry_utm.area
            
        stats = {'shape_area_m2': plot_area}
        
        if is_debug_plot:
            logging.info(f"Plot area (UTM calculated): {plot_geometry_utm.area:.2f} sq meters")
            logging.info(f"Plot area (shape_area): {plot_geom.shape_area.iloc[0] if hasattr(plot_geom, 'shape_area') else 'Not available'}")
            logging.info(f"Plot area (final): {plot_area:.2f} sq meters")
            logging.info(f"Plot bounds (UTM): {plot_geometry_utm.bounds}")
            logging.info(f"Plot valid: {plot_geometry_utm.is_valid}")
            if not plot_geometry_utm.is_valid:
                logging.info(f"Plot validation error: {explain_validity(plot_geometry_utm)}")
        
        with rasterio.open(raster_path) as src:
            # Get pixel size
            pixel_width = abs(src.transform.a)
            pixel_height = abs(src.transform.e)
            
            # Add a small buffer to the plot geometry to ensure we capture edge pixels
            buffer_size = min(pixel_width, pixel_height) / 10  # Small buffer
            plot_geometry_buffered = plot_geom.iloc[0].buffer(buffer_size)
            
            # Get valid window and transform with extra padding
            window, window_transform = get_valid_window(bounds, src.transform, src.shape)
            
            # Read only the required portion of the raster
            slope_data = src.read(1, window=window)
            
            if is_debug_plot:
                logging.info(f"Raw slope data shape: {slope_data.shape}")
                logging.info(f"Raw slope data values range: {np.min(slope_data):.2f}% to {np.max(slope_data):.2f}%")
                logging.info(f"Pixel size: {pixel_width:.2f} x {pixel_height:.2f} meters")
                logging.info(f"Buffer size: {buffer_size:.2f} meters")
            
            if slope_data.size == 0:
                stats['has_slope_data'] = False
                for _, _, key in SLOPE_CLASSES:
                    stats[key] = 0.0
                return stats
            
            # Create mask for the plot using the exact same dimensions as the data
            height, width = slope_data.shape
            mask = geometry_mask(
                [plot_geometry_buffered],  # Use buffered geometry
                out_shape=(height, width),
                transform=window_transform,
                invert=True,
                all_touched=True
            )
            
            if is_debug_plot:
                logging.info(f"Mask shape: {mask.shape}")
                logging.info(f"Number of True values in mask: {np.sum(mask)}")
            
            # Verify mask and data have same shape
            if mask.shape != slope_data.shape:
                logging.error(f"Shape mismatch - Mask: {mask.shape}, Data: {slope_data.shape}")
                stats['has_slope_data'] = False
                for _, _, key in SLOPE_CLASSES:
                    stats[key] = 0.0
                return stats
            
            # Get valid slope values and calculate pixel geometries
            valid_mask = (slope_data != src.nodata) & mask if src.nodata is not None else mask
            plot_slopes = slope_data[valid_mask]
            
            # Calculate pixel geometries and intersection areas
            pixel_areas = []
            pixel_slopes = []
            
            # Get row and column indices of valid pixels
            rows, cols = np.where(valid_mask)
            
            if is_debug_plot:
                logging.info(f"Found {len(rows)} potentially intersecting pixels")
            
            for row, col in zip(rows, cols):
                try:
                    # Get pixel bounds in raster CRS
                    pixel_bounds = rasterio.transform.xy(window_transform, row, col)
                    pixel_bounds2 = rasterio.transform.xy(window_transform, row+1, col+1)
                    pixel_geom = box(pixel_bounds[0], pixel_bounds[1], pixel_bounds2[0], pixel_bounds2[1])
                    
                    # Convert pixel geometry to UTM for accurate area calculation
                    pixel_geom_utm = gpd.GeoSeries([pixel_geom], crs=raster_crs).to_crs(utm_crs).iloc[0]
                    
                    # Calculate intersection area in UTM coordinates
                    intersection = plot_geometry_utm.intersection(pixel_geom_utm)
                    intersection_area = intersection.area  # Area in square meters
                    
                    # Only include pixels with significant intersection
                    min_area = 0.01  # 0.01 square meters minimum
                    if intersection_area > min_area:
                        pixel_areas.append(intersection_area)
                        pixel_slopes.append(slope_data[row, col])
                        
                        if is_debug_plot:
                            logging.info(f"Pixel at ({row}, {col}):")
                            logging.info(f"  Slope: {slope_data[row, col]:.2f}%")
                            logging.info(f"  Intersection area: {intersection_area:.2f} sq meters")
                            logging.info(f"  Percentage of plot: {(intersection_area/plot_area)*100:.2f}%")
                            logging.info(f"  Pixel bounds (UTM): {pixel_geom_utm.bounds}")
                            logging.info(f"  Intersection valid: {intersection.is_valid}")
                            logging.info(f"  Intersection bounds: {intersection.bounds}")
                    elif is_debug_plot:
                        logging.info(f"Skipping pixel at ({row}, {col}) - intersection too small: {intersection_area:.6f} sq meters")
                        
                except Exception as e:
                    logging.error(f"Error processing pixel at ({row}, {col}): {str(e)}")
                    continue
            
            if not pixel_areas:
                stats['has_slope_data'] = False
                for _, _, key in SLOPE_CLASSES:
                    stats[key] = 0.0
                return stats
            
            # Convert to numpy arrays
            pixel_areas = np.array(pixel_areas)
            pixel_slopes = np.array(pixel_slopes)
            
            # Normalize areas to get weights
            total_area = np.sum(pixel_areas)
            weights = pixel_areas / total_area
            
            if is_debug_plot:
                logging.info(f"Total intersecting pixels with significant area: {len(pixel_slopes)}")
                logging.info(f"Total intersection area: {total_area:.2f} sq meters")
                logging.info(f"Plot area: {plot_area:.2f} sq meters")
                logging.info(f"Area coverage: {(total_area/plot_area)*100:.2f}%")
                logging.info("Area-weighted slope calculations:")
                for slope, area, weight in zip(pixel_slopes, pixel_areas, weights):
                    logging.info(f"  Slope {slope:.2f}% with area {area:.2f} sq meters (weight: {weight:.4f})")
            
            # Verify we have reasonable area coverage
            area_coverage = total_area / plot_area
            if area_coverage < 0.5:  # Less than 50% coverage
                logging.warning(f"Low area coverage for plot {plot_id}: {area_coverage*100:.1f}%")
            
            stats['has_slope_data'] = True
            
            # Calculate area-weighted percentages for each slope class
            for min_slope, max_slope, key in SLOPE_CLASSES:
                class_mask = (pixel_slopes >= min_slope) & (pixel_slopes < max_slope)
                
                # Sum the weights of pixels in this class
                class_pctage = np.sum(weights[class_mask]) * 100
                stats[key] = round(class_pctage, 2)
                
                if is_debug_plot:
                    slopes_in_class = pixel_slopes[class_mask]
                    areas_in_class = pixel_areas[class_mask]
                    weights_in_class = weights[class_mask]
                    logging.info(f"\nSlope class {min_slope}-{max_slope}%:")
                    logging.info(f"  Number of pixels: {len(slopes_in_class)}")
                    if len(slopes_in_class) > 0:
                        logging.info("  Slopes and areas in this class:")
                        for s, a, w in zip(slopes_in_class, areas_in_class, weights_in_class):
                            logging.info(f"    Slope: {s:.2f}%, Area: {a:.2f} sq meters, Weight: {w:.4f}")
                    logging.info(f"  Area-weighted percentage: {class_pctage:.2f}%")
            
            # Also handle slopes below the minimum classification threshold
            min_classification = min(min_slope for min_slope, _, _ in SLOPE_CLASSES)
            below_min_mask = (pixel_slopes < min_classification)
            below_min_pctage = np.sum(weights[below_min_mask]) * 100
            stats['pct_slope_below_min'] = round(below_min_pctage, 2)
            
            if is_debug_plot and below_min_pctage > 0:
                slopes_below_min = pixel_slopes[below_min_mask]
                areas_below_min = pixel_areas[below_min_mask]
                weights_below_min = weights[below_min_mask]
                logging.info(f"\nSlopes below {min_classification}%:")
                logging.info(f"  Number of pixels: {len(slopes_below_min)}")
                if len(slopes_below_min) > 0:
                    logging.info("  Slopes and areas in this class:")
                    for s, a, w in zip(slopes_below_min, areas_below_min, weights_below_min):
                        logging.info(f"    Slope: {s:.2f}%, Area: {a:.2f} sq meters, Weight: {w:.4f}")
                logging.info(f"  Area-weighted percentage: {below_min_pctage:.2f}%")
            
            # Verify total percentages
            total_pctage = sum(stats[key] for _, _, key in SLOPE_CLASSES)
            if not (99.0 <= total_pctage <= 101.0):
                logging.warning(f"Total percentage ({total_pctage:.2f}%) not close to 100%")
                
            if is_debug_plot:
                logging.info("\nFinal statistics:")
                for key in sorted(stats.keys()):
                    logging.info(f"  {key}: {stats[key]}")
                    
    except Exception as e:
        logging.error(f"Error in calculate_plot_statistics_windowed: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        stats = {
            'shape_area_m2': 0.0,
            'has_slope_data': False,
            **{key: 0.0 for _, _, key in SLOPE_CLASSES}
        }
    
    return stats

def save_group_progress(group_index: int, plots_group: gpd.GeoDataFrame, results: List[Dict], group_start_time: float):
    """Save group progress to files"""
    if not results:  # Don't try to save if no results
        return
        
    try:
        # Ensure output directory exists
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        
        # Convert results to proper columns, ensuring each value is a Python native type
        valid_results = []
        for result in results:
            if isinstance(result, dict):
                # Convert numpy types to Python native types and ensure no NaN values
                cleaned_result = {}
                for k, v in result.items():
                    if isinstance(v, (np.float32, np.float64, np.int32, np.int64)):
                        cleaned_result[k] = float(v)
                    elif pd.isna(v):  # Handle NaN values
                        if k == 'has_slope_data':
                            cleaned_result[k] = False
                        elif k == 'shape_area_m2':
                            cleaned_result[k] = 0.0
                        else:
                            cleaned_result[k] = 0.0
                    else:
                        cleaned_result[k] = v
                valid_results.append(cleaned_result)
        
        if not valid_results:
            logging.error(f"No valid results to save for group {group_index}")
            return
            
        # Create DataFrame from valid results
        stats_df = pd.DataFrame(valid_results)
        
        # Create a copy of the plots group for the results we have
        temp_result = plots_group.iloc[:len(valid_results)].copy()
        
        # Add statistics columns, ensuring no NaN values
        for col in stats_df.columns:
            if col == 'has_slope_data':
                temp_result[col] = stats_df[col].fillna(False)
            else:
                temp_result[col] = stats_df[col].fillna(0.0)
        
        # Save to temporary file
        group_temp_file = os.path.join(OUTPUT_DIR, f"group_{group_index}_in_progress.fgb")
        try:
            # Ensure all numeric columns are float
            for col in temp_result.columns:
                if temp_result[col].dtype.kind in 'iuf':  # integer, unsigned integer, or float
                    temp_result[col] = temp_result[col].astype(float)
                    
            temp_result.to_file(group_temp_file, driver="FlatGeobuf")
            logging.info(f"Saved progress data to: {group_temp_file}")
        except Exception as e:
            logging.error(f"Error saving progress data: {str(e)}")
            logging.error(traceback.format_exc())
        
        # Save summary statistics
        timestamp = datetime.now().strftime('%H%M%S')
        summary_file = os.path.join(OUTPUT_DIR, f"summary_group_{group_index}_{timestamp}.csv")
        
        current_time = time.time()
        elapsed_time = current_time - group_start_time
        processing_rate = len(results) / elapsed_time if elapsed_time > 0 else 0
        
        # Calculate summary stats
        summary_stats = {
            'group': float(group_index),
            'total_plots_in_group': float(len(plots_group)),
            'plots_processed': float(len(results)),
            'plots_with_slope': float(stats_df['has_slope_data'].fillna(False).sum()),
            'pct_complete': float((len(results)/len(plots_group)*100)),
            'pct_with_slope': float((stats_df['has_slope_data'].fillna(False).sum()/len(results)*100)) if len(results) > 0 else 0.0,
            'processing_rate': float(processing_rate),
            'elapsed_time': float(elapsed_time)
        }
        
        # Add slope class statistics
        for _, _, key in SLOPE_CLASSES:
            if key in stats_df.columns:
                summary_stats[key] = float(stats_df[key].fillna(0.0).mean())
        
        try:
            pd.DataFrame([summary_stats]).to_csv(summary_file, index=False)
            logging.info(f"Saved progress summary to: {summary_file}")
        except Exception as e:
            logging.error(f"Error saving progress summary: {str(e)}")
            
    except Exception as e:
        logging.error(f"Error in save_group_progress for group {group_index}: {str(e)}")
        logging.error(traceback.format_exc())

def process_spatial_group(args: Tuple) -> List[Dict]:
    """
    Process a group of spatially related plots
    """
    plots_group, bounds, slope_path, group_index, total_groups = args
    results = []
    group_start_time = time.time()
    plots_processed = 0
    last_save_time = time.time()
    SAVE_INTERVAL = 300  # Save every 5 minutes
    
    try:
        # Initialize group in progress tracker
        with progress_tracker['lock']:
            progress_tracker['group_progress'][group_index] = {
                'processed': 0,
                'total': len(plots_group),
                'start_time': group_start_time,
                'last_update_time': group_start_time,
                'last_processed': 0,
                'processing_rates': [],
                'ewma_rate': None
            }
        
        for _, plot_row in plots_group.iterrows():
            try:
                plot_start_time = time.time()
                plot_id = plot_row.get('id')  # Get plot ID if available
                
                # Debug for plot 7589461
                is_debug_plot = plot_id == 7589461
                if is_debug_plot:
                    logging.info(f"\n=== Starting to process plot {plot_id} ===")
                    
                stats = calculate_plot_statistics_windowed(
                    plot_row.geometry,
                    slope_path,
                    bounds,
                    plot_id
                )
                
                if is_debug_plot:
                    logging.info("\nCalculated statistics:")
                    for key in sorted(stats.keys()):
                        logging.info(f"  {key}: {stats[key]}")
                
                stats['processing_time'] = time.time() - plot_start_time
                results.append(stats)
                
                plots_processed += 1
                
                # Update progress and save intermediate results
                if plots_processed % 100 == 0 or is_debug_plot:
                    with progress_tracker['lock']:
                        group_data = progress_tracker['group_progress'][group_index]
                        group_data['processed'] = plots_processed
                        group_data['last_update_time'] = time.time()
                        group_data['last_processed'] = plots_processed
                    update_progress(group_index, plots_processed, len(plots_group))
                    
                    # Save progress to files
                    save_group_progress(group_index, plots_group, results, group_start_time)
                    
                    if is_debug_plot:
                        logging.info("\nSaved intermediate results for debug plot")
                        # Find the plot in the saved results
                        temp_result = plots_group.iloc[:len(results)].copy()
                        for col in stats.keys():
                            temp_result[col] = pd.Series([r.get(col) for r in results])
                        debug_plot = temp_result[temp_result['id'] == 7589461]
                        if not debug_plot.empty:
                            logging.info("Values in saved results:")
                            for col in sorted(stats.keys()):
                                logging.info(f"  {col}: {debug_plot.iloc[0][col]}")
                
                # Regular interval save
                current_time = time.time()
                if current_time - last_save_time > SAVE_INTERVAL:
                    save_group_progress(group_index, plots_group, results, group_start_time)
                    last_save_time = current_time
                    
            except Exception as e:
                logging.error(f"Error processing plot in group {group_index}: {str(e)}")
                # Add empty stats for this plot
                results.append({
                    'shape_area_m2': 0,
                    'has_slope_data': False,
                    'processing_time': 0,
                    **{key: 0.0 for _, _, key in SLOPE_CLASSES}
                })
        
        # Update final progress for this group
        with progress_tracker['lock']:
            group_data = progress_tracker['group_progress'][group_index]
            group_data['processed'] = len(plots_group)
            group_data['last_update_time'] = time.time()
            group_data['last_processed'] = len(plots_group)
        update_progress(group_index, len(plots_group), len(plots_group))
        
        # Save final results for this group
        try:
            final_group_file = os.path.join(OUTPUT_DIR, f"group_{group_index}_complete.fgb")
            stats_df = pd.DataFrame(results)
            final_result = plots_group.copy()
            for col in stats_df.columns:
                final_result[col] = stats_df[col]
                
            # Debug check for plot 7589461 in final results
            debug_plot = final_result[final_result['id'] == 7589461]
            if not debug_plot.empty:
                logging.info("\nFinal saved values for debug plot:")
                for col in sorted(stats_df.columns):
                    logging.info(f"  {col}: {debug_plot.iloc[0][col]}")
            
            final_result.to_file(final_group_file, driver="FlatGeobuf")
            
            # Save final summary for this group
            summary_file = os.path.join(OUTPUT_DIR, f"summary_group_{group_index}_final.csv")
            total_time = time.time() - group_start_time
            summary_stats = {
                'group': group_index,
                'total_plots': len(plots_group),
                'plots_with_slope': stats_df['has_slope_data'].sum(),
                'pct_with_slope': (stats_df['has_slope_data'].sum()/len(plots_group)*100),
                'total_processing_time': total_time,
                'average_rate': len(plots_group) / total_time if total_time > 0 else 0,
                **{key: stats_df[key].mean() for _, _, key in SLOPE_CLASSES}
            }
            pd.DataFrame([summary_stats]).to_csv(summary_file, index=False)
            
            logging.info(f"Group {group_index} processing complete:")
            logging.info(f"  - Final data: {final_group_file}")
            logging.info(f"  - Final summary: {summary_file}")
            
        except Exception as e:
            logging.error(f"Error saving final results for group {group_index}: {str(e)}")
            
    except Exception as e:
        logging.error(f"Error processing group {group_index}: {str(e)}")
        # Add empty stats for remaining plots
        remaining_plots = len(plots_group) - len(results)
        for _ in range(remaining_plots):
            results.append({
                'shape_area_m2': 0,
                'has_slope_data': False,
                'processing_time': 0,
                **{key: 0.0 for _, _, key in SLOPE_CLASSES}
            })
    
    return results

def create_region_aggregated_stats(result_df: gpd.GeoDataFrame) -> pd.DataFrame:
    """
    Create aggregated statistics by administrative regions (district, village, taluk)
    
    Args:
        result_df: GeoDataFrame containing all plots with slope statistics
        
    Returns:
        DataFrame with aggregated statistics by region
    """
    logging.info("Generating aggregated statistics by region...")
    
    # Check if required columns exist
    required_cols = ['district', 'village', 'taluk', 'shape_area_m2']
    for col in required_cols:
        if col not in result_df.columns:
            logging.warning(f"Column '{col}' not found in the results. Using default values.")
    
    # Create a copy of the dataframe with only the relevant columns
    df = result_df.copy()
    
    # Ensure all required columns exist, create them with default values if not
    for col in required_cols:
        if col not in df.columns:
            df[col] = 'Unknown' if col != 'shape_area_m2' else 0.0
    
    # Group by administrative boundaries
    grouped = df.groupby(['district', 'village', 'taluk'])
    
    # Create aggregated results
    agg_results = []
    for (district, village, taluk), group in grouped:
        # Calculate total shape area
        total_shape_area = group['shape_area_m2'].sum()
        total_area_m2 = group['shape_area_m2'].sum()  # Same as shape_area for consistency
        
        # Calculate steep slope areas (>25%)
        nds_slope_pct_25_35 = group['pct_slope_25_35'].mean() if 'pct_slope_25_35' in group.columns else 0
        nds_slope_pct_35_inf = group['pct_slope_35_inf'].mean() if 'pct_slope_35_inf' in group.columns else 0
        nds_slope_pct = nds_slope_pct_25_35 + nds_slope_pct_35_inf
        nds_slope_area_m2 = total_area_m2 * (nds_slope_pct / 100)
        
        # Calculate area in each slope class in square meters
        slope_below_min_area_m2 = total_area_m2 * (group['pct_slope_below_min'].mean() / 100) if 'pct_slope_below_min' in group.columns else 0
        slope_10_20_area_m2 = total_area_m2 * (group['pct_slope_10_20'].mean() / 100) if 'pct_slope_10_20' in group.columns else 0
        slope_20_25_area_m2 = total_area_m2 * (group['pct_slope_20_25'].mean() / 100) if 'pct_slope_20_25' in group.columns else 0
        slope_25_35_area_m2 = total_area_m2 * (group['pct_slope_25_35'].mean() / 100) if 'pct_slope_25_35' in group.columns else 0
        slope_35_inf_area_m2 = total_area_m2 * (group['pct_slope_35_inf'].mean() / 100) if 'pct_slope_35_inf' in group.columns else 0
        
        # Calculate average percentages
        slope_below_min_pct = group['pct_slope_below_min'].mean() if 'pct_slope_below_min' in group.columns else 0
        slope_10_20_pct = group['pct_slope_10_20'].mean() if 'pct_slope_10_20' in group.columns else 0
        slope_20_25_pct = group['pct_slope_20_25'].mean() if 'pct_slope_20_25' in group.columns else 0
        slope_25_35_pct = group['pct_slope_25_35'].mean() if 'pct_slope_25_35' in group.columns else 0
        slope_35_inf_pct = group['pct_slope_35_inf'].mean() if 'pct_slope_35_inf' in group.columns else 0
        
        # Create result row
        agg_results.append({
            'district': district,
            'village': village,
            'taluk': taluk,
            'shape_area': total_shape_area,
            'total_area_m2': total_area_m2,
            'nds_slope_area_m2': nds_slope_area_m2,
            'nds_slope_pct': f"{nds_slope_pct:.2f}%",
            'slope_below_min_area_m2': slope_below_min_area_m2,
            'slope_below_min_pct': slope_below_min_pct,
            'slope_10_20_area_m2': slope_10_20_area_m2,
            'slope_10_20_pct': slope_10_20_pct,
            'slope_20_25_area_m2': slope_20_25_area_m2,
            'slope_20_25_pct': slope_20_25_pct,
            'slope_25_35_area_m2': slope_25_35_area_m2,
            'slope_25_35_pct': slope_25_35_pct,
            'slope_35_inf_area_m2': slope_35_inf_area_m2,
            'slope_35_inf_pct': slope_35_inf_pct
        })
    
    return pd.DataFrame(agg_results)

def main():
    # Set up argument parser
    parser = argparse.ArgumentParser(description="Process plots and calculate slope statistics")
    parser.add_argument("plots_path", help="Path to the cadastral plots file (GeoJSON/FlatGeobuf)")
    parser.add_argument("slope_raster", help="Path to the slope raster file")
    parser.add_argument("--debug", action="store_true", help="Enable debug mode: limit to 1,000 plots")
    
    args = parser.parse_args()
    
    plots_path = args.plots_path
    slope_raster = args.slope_raster
    debug_mode = args.debug
    
    try:
        # Create output directory first thing
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        logging.info(f"Created output directory: {os.path.abspath(OUTPUT_DIR)}")
        
        # Save run configuration
        config = {
            'start_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'plots_file': plots_path,
            'slope_raster': slope_raster,
            'slope_classes': {f"{min_val}-{max_val}": key for min_val, max_val, key in SLOPE_CLASSES},
            'output_directory': os.path.abspath(OUTPUT_DIR),
            'debug_mode': debug_mode
        }
        config_file = os.path.join(OUTPUT_DIR, 'processing_config.json')
        with open(config_file, 'w') as f:
            json.dump(config, f, indent=2)
        
        logging.info(f"Processing configuration saved to: {config_file}")
        logging.info(f"All output files will be saved in: {os.path.abspath(OUTPUT_DIR)}")
        
        if debug_mode:
            logging.info("DEBUG MODE ENABLED: Processing limited to 1,000 plots")
        
        # Test file creation
        test_file = os.path.join(OUTPUT_DIR, 'test_write.txt')
        try:
            with open(test_file, 'w') as f:
                f.write('Testing write access\n')
            os.remove(test_file)
            logging.info("Successfully verified write access to output directory")
        except Exception as e:
            logging.error(f"Error writing to output directory: {str(e)}")
            raise

        # Validate raster file
        with rasterio.open(slope_raster) as src:
            if src.count != 1:
                raise ValueError(f"Expected single-band raster, got {src.count} bands")
            logging.info(f"Raster: {src.shape[1]}x{src.shape[0]} pixels, CRS: {src.crs}")
        
        # Load plots
        logging.info(f"Loading plots from {plots_path}...")
        plots = gpd.read_file(plots_path)
        logging.info(f"Loaded {len(plots)} plots with CRS: {plots.crs}")
        
        # If debug mode, limit to 1,000 plots
        if debug_mode:
            if len(plots) > 1000:
                plots = plots.iloc[:1000].copy()
                logging.info(f"DEBUG MODE: Limited to first 1,000 plots")
        
        # Create spatial index
        logging.info("Creating spatial index...")
        spatial_groups = create_spatial_index(plots, slope_raster)
        
        if len(spatial_groups) == 0:
            raise ValueError("No valid spatial groups created - check if plots overlap with raster data")
        
        # Initialize progress tracking
        progress_tracker['start_time'] = time.time()
        progress_tracker['total_plots'] = len(plots)
        
        # Process spatial groups in parallel
        all_results = []
        
        logging.info(f"Processing {len(plots)} plots in {len(spatial_groups)} groups using {mp.cpu_count()} cores")
        logging.info("Progress files will be saved in the following formats:")
        logging.info(f"  - Group progress: {os.path.join(OUTPUT_DIR, 'group_X_in_progress.fgb')}")
        logging.info(f"  - Group summaries: {os.path.join(OUTPUT_DIR, 'summary_group_X_HHMMSS.csv')}")
        logging.info(f"  - Final results: {os.path.join(OUTPUT_DIR, 'plot_slope_statistics.fgb')}")
        
        # Add debug suffix to output files if in debug mode
        output_suffix = "_debug" if debug_mode else ""
        
        with mp.Pool(mp.cpu_count()) as pool:
            chunk_args = [(group, bounds, slope_raster, i+1, len(spatial_groups)) 
                         for i, (group, bounds) in enumerate(spatial_groups)]
            
            for group_results in pool.imap_unordered(process_spatial_group, chunk_args):
                all_results.extend(group_results)
        
        # Create final results
        stats_df = pd.DataFrame(all_results)
        result = plots.copy()
        for col in stats_df.columns:
            if col != 'processing_time':  # Don't include processing time in final output
                result[col] = stats_df[col]
        
        # Save final results
        output_path = os.path.join(OUTPUT_DIR, f"plot_slope_statistics{output_suffix}.fgb")
        summary_path = os.path.join(OUTPUT_DIR, f"final_summary{output_suffix}.csv")
        region_agg_path = os.path.join(OUTPUT_DIR, f"regional_slope_statistics{output_suffix}.csv")
        
        logging.info(f"Saving final results to: {output_path}")
        result.to_file(output_path, driver="FlatGeobuf")
        
        # Save final summary
        summary_stats = {
            'total_plots': len(plots),
            'plots_with_slope': stats_df['has_slope_data'].sum(),
            'pct_with_slope': (stats_df['has_slope_data'].sum()/len(plots)*100),
            **{key: stats_df[key].mean() for _, _, key in SLOPE_CLASSES}
        }
        pd.DataFrame([summary_stats]).to_csv(summary_path, index=False)
        logging.info(f"Final summary statistics saved to: {summary_path}")
        
        # Generate and save regional aggregated statistics
        regional_stats = create_region_aggregated_stats(result)
        regional_stats.to_csv(region_agg_path, index=False)
        logging.info(f"Regional aggregated statistics saved to: {region_agg_path}")
        
        # List all output files
        logging.info("\nAvailable output files:")
        for file in sorted(os.listdir(OUTPUT_DIR)):
            file_path = os.path.join(OUTPUT_DIR, file)
            size_mb = os.path.getsize(file_path) / (1024 * 1024)
            logging.info(f"  - {file} ({size_mb:.1f} MB)")
        
    except Exception as e:
        logging.error(f"Error: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        sys.exit(1)

if __name__ == "__main__":
    main() 