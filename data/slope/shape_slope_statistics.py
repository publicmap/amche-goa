"""Shape Slope Statistics Generator

This script analyzes cadastral plots and calculates statistics about their slope distributions
using a vector-based approach rather than raster sampling. It performs spatial intersections
between plot geometries and pre-classified slope zone polygons.

It outputs a new FlatGeobuf file containing the original plot geometries enriched with:
- Total area in square meters
- Area under each slope class (0-10%, 10-20%, 20-25%, 25-35%, >35%) in square meters
- Percentage of area under each slope class

Usage:
    python shape_slope_statistics.py <cadastral_geojson> <slope_zones_vector>

Example:
    python shape_slope_statistics.py ../amche-plot-geocoder/src/onemap/plots-sample.fgb ./slope/nasadem_30m_slope_zones.fgb
"""

import sys
import os
import geopandas as gpd
import pandas as pd
import numpy as np
from shapely.geometry import box
import logging
import time
from datetime import datetime
import json
import multiprocessing as mp
from multiprocessing import resource_tracker
from typing import Dict, List, Tuple, Optional
from tqdm import tqdm
import shapely.errors

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(message)s',
    datefmt='%H:%M:%S'
)

# Define slope classes
SLOPE_CLASSES = [
    (0, 10, 'slope_0_10'),
    (10, 20, 'slope_10_20'),
    (20, 25, 'slope_20_25'),
    (25, 35, 'slope_25_35'),
    (35, float('inf'), 'slope_35_inf')
]

# Get the directory where the script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "output")

def create_output_directory():
    """Create output directory if it doesn't exist"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    logging.info(f"Output directory: {os.path.abspath(OUTPUT_DIR)}")
    
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

def load_data(plots_path: str, slope_zones_path: str) -> Tuple[gpd.GeoDataFrame, gpd.GeoDataFrame]:
    """Load plot and slope zone data"""
    logging.info(f"Loading plots from {plots_path}...")
    plots = gpd.read_file(plots_path)
    logging.info(f"Loaded {len(plots)} plots with CRS: {plots.crs}")
    
    logging.info(f"Loading slope zones from {slope_zones_path}...")
    slope_zones = gpd.read_file(slope_zones_path)
    logging.info(f"Loaded {len(slope_zones)} slope zones with CRS: {slope_zones.crs}")
    
    # Ensure both datasets are in the same CRS
    if plots.crs != slope_zones.crs:
        logging.info(f"Converting slope zones from {slope_zones.crs} to {plots.crs}")
        slope_zones = slope_zones.to_crs(plots.crs)
    
    return plots, slope_zones

def create_spatial_groups(plots: gpd.GeoDataFrame, num_groups: int = None) -> List[gpd.GeoDataFrame]:
    """
    Split plots into spatial groups for parallel processing
    """
    if num_groups is None:
        num_groups = mp.cpu_count()
    
    logging.info(f"Creating {num_groups} spatial groups for parallel processing...")
    
    # Create a spatial index grid
    xmin, ymin, xmax, ymax = plots.total_bounds
    
    # Try to make square-ish cells
    width = xmax - xmin
    height = ymax - ymin
    aspect_ratio = width / height
    
    # Adjust grid dimensions based on aspect ratio
    if aspect_ratio > 1:
        # Wider than tall
        cols = int(np.ceil(np.sqrt(num_groups * aspect_ratio)))
        rows = int(np.ceil(num_groups / cols))
    else:
        # Taller than wide
        rows = int(np.ceil(np.sqrt(num_groups / aspect_ratio)))
        cols = int(np.ceil(num_groups / rows))
    
    cell_width = width / cols
    cell_height = height / rows
    
    spatial_groups = []
    processed_indices = set()
    
    # Create groups based on grid cells
    for i in range(cols):
        for j in range(rows):
            cell_xmin = xmin + (i * cell_width)
            cell_ymin = ymin + (j * cell_height)
            cell_xmax = cell_xmin + cell_width
            cell_ymax = cell_ymin + cell_height
            
            cell = box(cell_xmin, cell_ymin, cell_xmax, cell_ymax)
            
            # Find plots that intersect with this cell
            indices = plots.index[plots.intersects(cell)]
            new_indices = [idx for idx in indices if idx not in processed_indices]
            
            if new_indices:
                spatial_groups.append(plots.loc[new_indices].copy())
                processed_indices.update(new_indices)
    
    # Check if any plots were missed (shouldn't happen, but just in case)
    missed_indices = set(plots.index) - processed_indices
    if missed_indices:
        spatial_groups.append(plots.loc[list(missed_indices)].copy())
    
    logging.info(f"Created {len(spatial_groups)} spatial groups")
    
    # Log group sizes
    group_sizes = [len(group) for group in spatial_groups]
    logging.info(f"Group sizes: min={min(group_sizes)}, max={max(group_sizes)}, " 
                f"avg={sum(group_sizes)/len(spatial_groups):.1f}")
    
    return spatial_groups

def create_summary_statistics(combined_results: gpd.GeoDataFrame) -> Dict:
    """
    Create summary statistics from results, ensuring JSON serializable values
    """
    # Convert numpy types to Python native types
    summary = {
        'total_plots': int(len(combined_results)),
        'plots_with_slope_data': int(combined_results['has_slope_data'].sum()),
        'percent_with_slope_data': round(float((combined_results['has_slope_data'].sum() / len(combined_results)) * 100), 1),
    }
    
    # Add stats for geometries
    if 'geometry_valid' in combined_results.columns:
        invalid_geoms = len(combined_results) - combined_results['geometry_valid'].sum()
        summary['plots_with_invalid_geometry'] = int(invalid_geoms)
        summary['percent_with_invalid_geometry'] = round(float((invalid_geoms / len(combined_results)) * 100), 1)
    
    # Add stats for each slope class
    for min_val, max_val, class_name in SLOPE_CLASSES:
        area_col = f"{class_name}_area_m2"
        percent_col = f"{class_name}_percent"
        
        plots_with_data = combined_results[combined_results['has_slope_data']]
        if len(plots_with_data) > 0:
            summary[f"avg_{class_name}_percent"] = round(float(plots_with_data[percent_col].mean()), 1)
            summary[f"total_{class_name}_area_km2"] = round(float(plots_with_data[area_col].sum() / 1_000_000), 1)  # Convert to km²
        else:
            summary[f"avg_{class_name}_percent"] = 0.0
            summary[f"total_{class_name}_area_km2"] = 0.0
            
    return summary

def process_plot_group(args: Tuple[int, gpd.GeoDataFrame, gpd.GeoDataFrame]) -> gpd.GeoDataFrame:
    """
    Process a group of plots: intersect with slope zones and calculate statistics
    """
    group_id, plots_group, slope_zones = args
    start_time = time.time()
    logging.info(f"Starting processing group {group_id} with {len(plots_group)} plots")
    
    # Initialize columns for results
    for min_val, max_val, class_name in SLOPE_CLASSES:
        plots_group[f"{class_name}_area_m2"] = 0.0
        plots_group[f"{class_name}_percent"] = 0.0
    
    plots_group['total_area_m2'] = 0.0
    plots_group['has_slope_data'] = False
    plots_group['geometry_valid'] = True
    plots_group['steep_slope_percent'] = 0.0
    plots_group['steep_slope_area_m2'] = 0.0
    
    # Track progress
    progress_interval = max(1, len(plots_group) // 10)
    
    # Process each plot
    for idx, plot_row in tqdm(plots_group.iterrows(), 
                              total=len(plots_group), 
                              desc=f"Group {group_id}",
                              position=group_id):
        try:
            # Get plot geometry
            plot_geom = plot_row.geometry
            
            # Check if geometry is valid, try to fix if not
            if not plot_geom.is_valid:
                logging.info(f"Plot {idx} has invalid geometry, attempting to fix...")
                try:
                    from shapely.validation import make_valid
                    fixed_geom = make_valid(plot_geom)
                    if fixed_geom.is_valid:
                        plot_geom = fixed_geom
                        logging.info(f"Successfully fixed geometry for plot {idx}")
                    else:
                        plots_group.at[idx, 'geometry_valid'] = False
                        logging.warning(f"Unable to fix geometry for plot {idx}, skipping")
                        continue
                except Exception as e:
                    plots_group.at[idx, 'geometry_valid'] = False
                    logging.warning(f"Error fixing geometry for plot {idx}: {str(e)}, skipping")
                    continue
            
            # Convert to UTM for accurate area calculation
            centroid = plot_geom.centroid
            lon, lat = centroid.x, centroid.y
            utm_zone = int((lon + 180) / 6) + 1
            utm_crs = f"EPSG:326{utm_zone:02d}"  # Northern hemisphere
            if lat < 0:
                utm_crs = f"EPSG:327{utm_zone:02d}"  # Southern hemisphere
            
            # Calculate total area in UTM
            plot_utm = gpd.GeoSeries([plot_geom], crs=plots_group.crs).to_crs(utm_crs)
            total_area_m2 = round(plot_utm.area.iloc[0], 1)
            plots_group.at[idx, 'total_area_m2'] = total_area_m2
            
            # Find intersecting slope zones - use try/except to handle topology errors
            try:
                intersecting_zones = slope_zones[slope_zones.intersects(plot_geom)].copy()
            except shapely.errors.GEOSException as e:
                logging.warning(f"Plot {idx}: Topology error during intersection check: {str(e)}")
                # Try with a buffered version of the geometry (can help with some topology issues)
                try:
                    buffer_amount = 0.000001  # Very small buffer
                    buffered_geom = plot_geom.buffer(buffer_amount)
                    if buffered_geom.is_valid:
                        intersecting_zones = slope_zones[slope_zones.intersects(buffered_geom)].copy()
                        logging.info(f"Plot {idx}: Successfully found intersections using buffered geometry")
                    else:
                        plots_group.at[idx, 'geometry_valid'] = False
                        logging.warning(f"Plot {idx}: Buffered geometry still invalid, skipping")
                        continue
                except Exception as e2:
                    plots_group.at[idx, 'geometry_valid'] = False
                    logging.warning(f"Plot {idx}: Failed to intersect even with buffered geometry: {str(e2)}, skipping")
                    continue
            
            if len(intersecting_zones) == 0:
                # No slope data for this plot
                plots_group.at[idx, 'has_slope_data'] = False
                continue
            
            # Set flag that we have slope data
            plots_group.at[idx, 'has_slope_data'] = True
            
            # Create plot GeoDataFrame in UTM for area calculations
            plot_gdf_utm = gpd.GeoDataFrame(geometry=[plot_geom], crs=plots_group.crs).to_crs(utm_crs)
            
            # Initialize total slope area for validation
            total_slope_area = 0.0
            
            # Calculate intersection with each slope zone
            for zone_idx, zone_row in intersecting_zones.iterrows():
                try:
                    # Get slope values
                    slope_min = zone_row['slope_min']
                    slope_max = zone_row['slope_max']
                    
                    # Find which slope class this falls into
                    for min_val, max_val, class_name in SLOPE_CLASSES:
                        if (slope_min >= min_val and slope_min < max_val) or \
                           (slope_max > min_val and slope_max <= max_val) or \
                           (slope_min <= min_val and slope_max >= max_val):
                            
                            # Handle GeometryCollection issue by using shapely directly
                            # instead of geopandas overlay
                            try:
                                # Convert zone geometry to UTM
                                zone_geom_utm = gpd.GeoSeries([zone_row.geometry], crs=slope_zones.crs).to_crs(utm_crs).iloc[0]
                                
                                # Check if geometries are valid before intersection
                                if not zone_geom_utm.is_valid:
                                    from shapely.validation import make_valid
                                    zone_geom_utm = make_valid(zone_geom_utm)
                                
                                plot_geom_utm = plot_gdf_utm.geometry.iloc[0]
                                if not plot_geom_utm.is_valid:
                                    from shapely.validation import make_valid
                                    plot_geom_utm = make_valid(plot_geom_utm)
                                
                                # Calculate intersection using shapely, with error handling
                                try:
                                    intersection_geom = plot_geom_utm.intersection(zone_geom_utm)
                                except shapely.errors.GEOSException as e:
                                    # Try with prepared geometries and buffer as a fallback
                                    try:
                                        from shapely.prepared import prep
                                        prepared_plot = prep(plot_geom_utm.buffer(0))
                                        prepared_zone = prep(zone_geom_utm.buffer(0))
                                        
                                        # Check if they still intersect after buffering
                                        if prepared_plot.intersects(zone_geom_utm):
                                            intersection_geom = plot_geom_utm.buffer(0).intersection(zone_geom_utm.buffer(0))
                                        else:
                                            # No valid intersection
                                            continue
                                    except Exception as e3:
                                        logging.error(f"Plot {idx}, Zone {zone_idx}: Failed all intersection attempts: {str(e3)}")
                                        continue
                                
                                # Calculate area of intersection
                                if not intersection_geom.is_empty:
                                    if hasattr(intersection_geom, 'geoms'):
                                        # Handle multi-geometries by summing areas
                                        intersection_area_m2 = sum(geom.area for geom in intersection_geom.geoms)
                                    else:
                                        # Single geometry
                                        intersection_area_m2 = intersection_geom.area
                                        
                                    # Update area for this slope class
                                    current_area = plots_group.at[idx, f"{class_name}_area_m2"]
                                    plots_group.at[idx, f"{class_name}_area_m2"] = current_area + intersection_area_m2
                                    total_slope_area += intersection_area_m2
                            
                            except Exception as e:
                                logging.error(f"Error calculating intersection for plot {idx} with zone {zone_idx}: {str(e)}")
                                # Try fallback method if direct shapely method fails
                                try:
                                    # Convert zone to UTM first
                                    zone_gdf_utm = gpd.GeoDataFrame(geometry=[zone_row.geometry], crs=slope_zones.crs).to_crs(utm_crs)
                                    
                                    # Try to fix geometries with buffer(0) before overlay
                                    plot_gdf_utm_fixed = gpd.GeoDataFrame(
                                        geometry=[plot_gdf_utm.geometry.iloc[0].buffer(0)], 
                                        crs=utm_crs
                                    )
                                    zone_gdf_utm_fixed = gpd.GeoDataFrame(
                                        geometry=[zone_gdf_utm.geometry.iloc[0].buffer(0)], 
                                        crs=utm_crs
                                    )
                                    
                                    # Use overlay with keep_geom_type=False
                                    intersection = gpd.overlay(
                                        plot_gdf_utm_fixed,
                                        zone_gdf_utm_fixed,
                                        how='intersection',
                                        keep_geom_type=False
                                    )
                                    
                                    if not intersection.empty:
                                        intersection_area_m2 = intersection.area.sum()
                                        
                                        # Update area for this slope class
                                        current_area = plots_group.at[idx, f"{class_name}_area_m2"]
                                        plots_group.at[idx, f"{class_name}_area_m2"] = current_area + intersection_area_m2
                                        total_slope_area += intersection_area_m2
                                except Exception as e2:
                                    logging.error(f"Fallback method also failed for plot {idx}: {str(e2)}")
                except Exception as zone_err:
                    logging.error(f"Error processing zone {zone_idx} for plot {idx}: {str(zone_err)}")
                    continue
            
            # Fix for plots with no slope area despite slope data
            if total_slope_area == 0 and plots_group.at[idx, 'has_slope_data']:
                logging.warning(f"Plot {idx} has slope zones but zero slope area - setting has_slope_data=False")
                plots_group.at[idx, 'has_slope_data'] = False
                continue
                
            # Normalize areas if there's a significant difference
            if total_area_m2 > 0:
                area_difference_percent = abs(total_slope_area - total_area_m2) / total_area_m2 * 100
                if area_difference_percent > 5 and total_slope_area > 0:
                    # Normalize all slope areas to match total area
                    scaling_factor = total_area_m2 / total_slope_area
                    logging.debug(f"Plot {idx}: normalizing areas (diff: {area_difference_percent:.1f}%, scaling: {scaling_factor:.3f})")
                    
                    for _, _, class_name in SLOPE_CLASSES:
                        area_col = f"{class_name}_area_m2"
                        current_area = plots_group.at[idx, area_col]
                        adjusted_area = round(current_area * scaling_factor, 1)
                        plots_group.at[idx, area_col] = adjusted_area
            else:
                # Handle case where total_area_m2 is zero
                logging.warning(f"Plot {idx} has zero total area, skipping area normalization")
                # Set has_slope_data to False since we can't calculate percentages
                plots_group.at[idx, 'has_slope_data'] = False
                continue
                
            # Round all area values to 1 decimal place
            for _, _, class_name in SLOPE_CLASSES:
                area_col = f"{class_name}_area_m2"
                current_area = plots_group.at[idx, area_col]
                plots_group.at[idx, area_col] = round(current_area, 1)
            
            # Calculate percentages
            if total_area_m2 > 0:
                for min_val, max_val, class_name in SLOPE_CLASSES:
                    area_m2 = plots_group.at[idx, f"{class_name}_area_m2"]
                    percentage = round((area_m2 / total_area_m2) * 100, 1)
                    plots_group.at[idx, f"{class_name}_percent"] = percentage
                
                # Calculate steep slope percentage and area
                steep_slope_percent = 0.0
                for min_val, max_val, class_name in SLOPE_CLASSES:
                    if min_val >= 25:  # All slope classes 25% and above
                        steep_slope_percent += plots_group.at[idx, f"{class_name}_percent"]
                
                plots_group.at[idx, 'steep_slope_percent'] = round(steep_slope_percent, 1)
                plots_group.at[idx, 'steep_slope_area_m2'] = round((steep_slope_percent / 100.0) * total_area_m2, 1)
            
        except Exception as e:
            logging.error(f"Error processing plot {idx}: {str(e)}")
            import traceback
            logging.error(traceback.format_exc())
    
    # Save intermediate results to file
    output_path = os.path.join(OUTPUT_DIR, f"group_{group_id}_results.fgb")
    plots_group.to_file(output_path, driver="FlatGeobuf")
    
    elapsed_time = time.time() - start_time
    logging.info(f"Completed group {group_id} in {elapsed_time:.1f} seconds")
    
    return plots_group

def validate_results(results: gpd.GeoDataFrame):
    """
    Validate the results to ensure the sum of slope areas equals total area
    and report on geometry issues
    """
    # Check geometry validation first
    if 'geometry_valid' in results.columns:
        invalid_count = len(results) - results['geometry_valid'].sum()
        if invalid_count > 0:
            logging.warning(f"Found {invalid_count} plots with invalid geometries ({invalid_count/len(results)*100:.1f}%)")
        else:
            logging.info("All plot geometries are valid")
    
    # Check only plots with slope data
    has_slope_data = results['has_slope_data'] == True
    if has_slope_data.sum() == 0:
        logging.warning("No plots with slope data to validate")
        return
    
    plots_with_data = results[has_slope_data].copy()
    
    # Calculate sum of slope class areas
    plots_with_data['sum_slope_areas'] = 0
    for _, _, class_name in SLOPE_CLASSES:
        plots_with_data['sum_slope_areas'] += plots_with_data[f"{class_name}_area_m2"]
    
    # Calculate difference
    plots_with_data['area_difference'] = abs(plots_with_data['total_area_m2'] - plots_with_data['sum_slope_areas'])
    
    # Filter out plots with zero total area before calculating percentage difference
    non_zero_area = plots_with_data['total_area_m2'] > 0
    if non_zero_area.sum() == 0:
        logging.warning("All plots have zero total area")
        return
    
    # Calculate percentage difference only for plots with non-zero total area
    plots_with_non_zero = plots_with_data[non_zero_area].copy()
    plots_with_non_zero['area_difference_percent'] = (plots_with_non_zero['area_difference'] / plots_with_non_zero['total_area_m2']) * 100
    
    # Verify steep_slope fields are properly calculated
    for idx, row in plots_with_non_zero.iterrows():
        steep_percent_sum = 0.0
        for min_val, max_val, class_name in SLOPE_CLASSES:
            if min_val >= 25:  # All slope classes 25% and above
                steep_percent_sum += row[f"{class_name}_percent"]
        
        if abs(steep_percent_sum - row['steep_slope_percent']) > 0.1:
            logging.warning(f"Plot {idx} has inconsistent steep slope percentage calculation")
    
    # Summarize results
    mean_diff_percent = round(plots_with_non_zero['area_difference_percent'].mean(), 1)
    max_diff_percent = round(plots_with_non_zero['area_difference_percent'].max(), 1)
    
    logging.info(f"Validation summary:")
    logging.info(f"  - Plots with slope data: {has_slope_data.sum()} of {len(results)}")
    logging.info(f"  - Plots with zero area: {len(plots_with_data) - non_zero_area.sum()} of {len(plots_with_data)}")
    logging.info(f"  - Mean area difference: {mean_diff_percent}%")
    logging.info(f"  - Max area difference: {max_diff_percent}%")
    
    # Count plots with significant differences
    significant_diff = plots_with_non_zero['area_difference_percent'] > 5
    if significant_diff.sum() > 0:
        logging.warning(f"  - {significant_diff.sum()} plots have area differences > 5%")

def create_nds_locations(results: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """
    Create a dataset of NDS (No Development Slopes) locations - 
    centroids of plots with >25% of area on slopes >25%
    """
    logging.info("Creating NDS locations from plots with >25% of area on slopes >25%...")
    
    # Filter out invalid geometries if that column exists
    valid_results = results
    if 'geometry_valid' in results.columns:
        valid_results = results[results['geometry_valid'] == True].copy()
        logging.info(f"Filtered out {len(results) - len(valid_results)} plots with invalid geometries")
    
    # Calculate total percentage of slopes over 25%
    valid_results['steep_slopes_percent'] = 0.0
    for min_val, max_val, class_name in SLOPE_CLASSES:
        if min_val >= 25:  # All slope classes 25% and above
            valid_results['steep_slopes_percent'] += valid_results[f"{class_name}_percent"]
    
    # Calculate steep slope area in square meters
    valid_results['steep_slope_area_m2'] = valid_results['steep_slopes_percent'] * valid_results['total_area_m2'] / 100.0
    
    # Filter for plots with slope data and >25% steep slopes
    nds_plots = valid_results[(valid_results['has_slope_data'] == True) & 
                         (valid_results['steep_slopes_percent'] > 25.0)].copy()
    
    logging.info(f"Found {len(nds_plots)} plots with >25% of their area on slopes >25%")
    
    # Extract centroids
    nds_points = nds_plots.copy()
    nds_points['geometry'] = nds_plots.centroid
    
    # Keep relevant columns
    keep_columns = ['geometry', 'steep_slopes_percent', 'steep_slope_area_m2', 'total_area_m2']
    
    # Add relevant slope columns
    for min_val, max_val, class_name in SLOPE_CLASSES:
        if min_val >= 25:  # All slope classes 25% and above
            keep_columns.append(f"{class_name}_percent")
            keep_columns.append(f"{class_name}_area_m2")
    
    # Map field names and keep additional identifier columns if they exist
    field_mappings = {'villagenam': 'village', 'lname': 'taluk'}
    for src_col, dest_col in field_mappings.items():
        if src_col in nds_plots.columns:
            nds_points[dest_col] = nds_plots[src_col]
            keep_columns.append(dest_col)
    
    # Keep additional identifier columns if they exist
    for col in ['id', 'survey_no', 'plot_no', 'village', 'name']:
        if col in nds_plots.columns and col not in keep_columns:
            keep_columns.append(col)
    
    # Filter columns and return
    nds_points = nds_points[keep_columns]
    
    return nds_points

def main():
    if len(sys.argv) != 3:
        print("Usage: python shape_slope_statistics.py <cadastral_geojson> <slope_zones_vector>")
        sys.exit(1)
        
    plots_path = sys.argv[1]
    slope_zones_path = sys.argv[2]
    
    try:
        # Create output directory
        create_output_directory()
        
        # Save run configuration
        config = {
            'start_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'plots_file': plots_path,
            'slope_zones_file': slope_zones_path,
            'slope_classes': {f"{min_val}-{max_val}": class_name for min_val, max_val, class_name in SLOPE_CLASSES},
            'output_directory': os.path.abspath(OUTPUT_DIR)
        }
        config_file = os.path.join(OUTPUT_DIR, 'processing_config.json')
        with open(config_file, 'w') as f:
            json.dump(config, f, indent=2)
        
        # Load data
        plots, slope_zones = load_data(plots_path, slope_zones_path)
        
        # Verify slope zones have required columns
        required_columns = ['slope_min', 'slope_max']
        missing_columns = [col for col in required_columns if col not in slope_zones.columns]
        if missing_columns:
            raise ValueError(f"Slope zones missing required columns: {missing_columns}")
        
        # Create spatial groups for parallel processing
        groups = create_spatial_groups(plots)
        
        # Process groups in parallel
        start_time = time.time()
        logging.info(f"Starting parallel processing with {mp.cpu_count()} workers")
        
        with mp.Pool(mp.cpu_count()) as pool:
            group_args = [(i, group, slope_zones) for i, group in enumerate(groups)]
            # Use list to force all tasks to complete before closing the pool
            results = list(pool.imap(process_plot_group, group_args))
        
        # Combine results
        combined_results = pd.concat(results)
        logging.info(f"Created {len(combined_results)} records")
        
        # Validate results
        validate_results(combined_results)
        
        # Save final results
        output_path = os.path.join(OUTPUT_DIR, "plot_slope_statistics.fgb")
        combined_results.to_file(output_path, driver="FlatGeobuf")
        
        # Create NDS locations (plots with >25% of area on slopes >25%)
        nds_locations = create_nds_locations(combined_results)
        nds_output_path = os.path.join(OUTPUT_DIR, "plot_nds_locations.fgb")
        nds_locations.to_file(nds_output_path, driver="FlatGeobuf")
        logging.info(f"NDS locations saved to: {nds_output_path}")
        
        # Create and save summary statistics
        summary = create_summary_statistics(combined_results)
        
        # Add NDS stats to summary
        summary['plots_with_steep_slopes_25pct'] = int(len(nds_locations))
        summary['percent_plots_with_steep_slopes_25pct'] = round((len(nds_locations) / len(combined_results)) * 100, 1)
        
        # Save summary
        summary_path = os.path.join(OUTPUT_DIR, "summary_statistics.json")
        with open(summary_path, 'w') as f:
            json.dump(summary, f, indent=2)
        
        # Print completion info
        elapsed_time = time.time() - start_time
        logging.info(f"Processing completed in {elapsed_time:.1f} seconds")
        logging.info(f"Results saved to: {output_path}")
        logging.info(f"NDS locations saved to: {nds_output_path}")
        logging.info(f"Summary saved to: {summary_path}")
        
        # Cleanup multiprocessing resources to prevent semaphore leaks
        def cleanup_resources():
            try:
                # Force cleanup of any leaked semaphores
                if hasattr(resource_tracker, '_REGISTRY'):
                    # Get all semaphore resources
                    semaphores = [rtype for rtype, res in resource_tracker._REGISTRY.items() 
                                if rtype.startswith('/mp')]
                    
                    # Unregister each semaphore
                    for semaphore in semaphores:
                        logging.info(f"Cleaning up leaked semaphore: {semaphore}")
                        resource_tracker.unregister(semaphore, 'semaphore')
                        
                resource_tracker._CLEANUP_FUNCS.clear()
                # Ensure the resource tracker is terminated
                if hasattr(resource_tracker, '_resource_tracker'):
                    resource_tracker._resource_tracker = None
            except Exception as e:
                logging.warning(f"Error during multiprocessing cleanup: {str(e)}")
                
        cleanup_resources()
        
    except Exception as e:
        logging.error(f"Error: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        sys.exit(1)

if __name__ == "__main__":
    main() 