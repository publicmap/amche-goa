"""DEM and Slope Processing Script

This script processes Digital Elevation Model (DEM) files to create slope rasters.
It supports multiple DEM sources including CartoSat (2.5m & 30m), ASTER, ALOS, and NASADEM.

Usage:
    1. Place your source zipped DEM *tiff files in the corresponding input source folders:
       - ./src/cartodem_2_5m/
       - ./src/cartodem_30m/
       - ./src/aster_30m/
       - ./src/alos_30m/
       - ./src/nasadem_30m/

    - NASADEM:
curl -X 'GET' \
  'https://portal.opentopography.org/API/globaldem?demtype=NASADEM&south=14.5&north=16&west=73&east=75&outputFormat=GTiff&API_Key=demoapikeyot2022' \
  -H 'accept: */*' --output src/nasadem_30m/goa_nasadem_30m.tif
    
    2. Run the script:
       python3 dem_slope_processor.py <dem_type>
    
    The script will:
    - Unzip source files into tiff files
    - Merge and normalize DEM files
    - Generate slope rasters (in percent). See https://en.wikipedia.org/wiki/Grade_(slope) 
    - Create slope vector zones based on defined slope bands
    
    Output files will be created in:
    - ./dem/ (merged DEM .tiff )
    - ./slope/ (slope .tiff rasters and slope zone .fgb vectors)

Requirements:
    - GDAL
    - NumPy
"""

import os
from osgeo import gdal
import glob
import zipfile
import numpy as np
import sys
from typing import Dict, Any
from osgeo import ogr

# Configuration for different DEM sources
DEM_CONFIGS = {
    "cartodem_2_5m": {
        "dem_offset": 83,
        "dem_water_value": 83,
        "input_folder": "./src/cartodem_2_5m",
        "resample": { # resample from 2.5m to 30m resolution
            "enabled": True,
            "target_resolution": 30,
            "contour_interval": 1.0
        },
        "contour_interval": 0.5  # 1m intervals for high-resolution DEM
    },
    "cartodem_30m": {
        "dem_offset": 83,
        "dem_water_value": -255,
        "input_folder": "./src/cartodem_30m",
        "contour_interval": 5.0  # 5m intervals for 30m DEM
    },
    "aster_30m": {
        "dem_offset": 0,
        "dem_water_value": -255,
        "input_folder": "./src/aster_30m",
        "contour_interval": 5.0
    },
    "alos_30m": {
        "dem_offset": -1,
        "dem_water_value": -255,
        "input_folder": "./src/alos_30m",
        "contour_interval": 5.0
    },
    "nasadem_30m": {
        "dem_offset": 0,
        "dem_water_value": 0,
        "dem_nodata_value": -32768,
        "input_folder": "./src/nasadem_30m",
        "contour_interval": 10
    }
}

# Common scale factor for all DEMs
DEM_SCALE = 111120

# Add these constants after DEM_SCALE
SLOPE_BANDS = [
    (10, 20), # 10-20% Restricted Development Slope (RDS-1)
    (20, 25), # 20-25% Restricted Development Slope (RDS-2) 
    (25, 50), # 25-50% No-Development Slope (NDS)
    (50, float('inf')) # 50+% No-Development Slope (NDS)
]

# Add these flags after the SLOPE_BANDS constant
GENERATE_VECTORS = {
    'slope': True,  # Generate slope vector zones
    'contours': True  # Generate contour lines
}

def unzip_dem_files(input_folder: str) -> None:
    """
    Unzip all zip files in the input folder
    
    Args:
        input_folder (str): Path to folder containing zip files
    """
    zip_files = glob.glob(os.path.join(input_folder, "*.zip"))
    
    if not zip_files:
        print(f"No ZIP files found in {input_folder}")
        return
    
    for zip_file in zip_files:
        try:
            with zipfile.ZipFile(zip_file, 'r') as zip_ref:
                zip_ref.extractall(input_folder)
            print(f"Successfully unzipped: {zip_file}")
        except Exception as e:
            print(f"Error unzipping {zip_file}: {str(e)}")

def merge_dem_files(input_folder: str, output_file: str, dem_water_value: float, dem_offset: float, dem_nodata_value: float = None) -> None:
    """
    Merge all TIF files in the input folder and normalize elevation values
    
    Args:
        input_folder (str): Path to folder containing TIF files
        output_file (str): Path for output merged file
        dem_water_value (float): Value representing water in the DEM
        dem_offset (float): Offset to apply to elevation values
        dem_nodata_value (float, optional): Value representing no data in the DEM
    """
    try:
        # Find all TIF files recursively
        tif_files = []
        for root, dirs, files in os.walk(input_folder):
            for file in files:
                if file.endswith('.tif'):
                    tif_files.append(os.path.join(root, file))
        
        if not tif_files:
            print("No TIF files found in the input folder")
            return

        print(f"Found {len(tif_files)} TIF files")
        
        # Build VRT
        vrt = gdal.BuildVRT("merged.vrt", tif_files)
        
        if vrt is None:
            print("Failed to create VRT")
            return

        # Process DEM data
        dem_data = vrt.ReadAsArray()
        print("Before normalization:")
        print(f"Min elevation: {np.nanmin(dem_data)}")
        print(f"Max elevation: {np.nanmax(dem_data)}")
        
        dem_data = dem_data.astype(np.float32)
        
        # Replace nodata values with water values if dem_nodata_value is specified
        if dem_nodata_value is not None:
            dem_data = np.where(dem_data == dem_nodata_value, dem_water_value, dem_data)
        # Only replace water values with NaN if dem_water_value is not 0
        if dem_water_value != 0:
            dem_data = np.where(dem_data == dem_water_value, np.nan, dem_data)
        
        # Apply offset if not 0
        if dem_offset != 0:
            dem_data = dem_data + dem_offset
        
        print("\nAfter normalization:")
        print(f"Min elevation: {np.nanmin(dem_data)}")
        print(f"Max elevation: {np.nanmax(dem_data)}")
        
        # Create output file with Float32 type instead of 8-bit
        driver = gdal.GetDriverByName('GTiff')
        out_ds = driver.Create(output_file, 
                             vrt.RasterXSize, 
                             vrt.RasterYSize, 
                             1, 
                             gdal.GDT_Float32,  # Changed to Float32
                             options=['COMPRESS=DEFLATE', 'PREDICTOR=3'])
        
        out_ds.SetGeoTransform(vrt.GetGeoTransform())
        out_ds.SetProjection(vrt.GetProjection())
        
        out_band = out_ds.GetRasterBand(1)
        out_band.WriteArray(dem_data)
        out_band.SetNoDataValue(np.nan)
        
        # Cleanup
        out_ds.FlushCache()
        out_ds = None
        vrt = None
        
        if os.path.exists("merged.vrt"):
            os.remove("merged.vrt")
            
        print(f"Successfully merged and normalized DEM: {output_file}")
        
    except Exception as e:
        print(f"An error occurred while merging files: {str(e)}")
        raise e

def create_slope_raster(dem_file: str, output_slope_file: str) -> None:
    """
    Create a slope raster (in percent) from a DEM file using GDAL
    
    Args:
        dem_file (str): Path to the input DEM file
        output_slope_file (str): Path for the output slope file
    """
    try:
        # Create temporary floating-point slope file
        temp_slope_file = output_slope_file + '.temp.tif'
        
        slope_options = gdal.DEMProcessingOptions(
            format='GTiff',
            computeEdges=False,
            slopeFormat='percent',
            alg='ZevenbergenThorne',
            scale=DEM_SCALE
        )
        
        gdal.DEMProcessing(
            temp_slope_file,
            dem_file,
            'slope',
            options=slope_options
        )
        
        # Read the temporary slope file
        slope_ds = gdal.Open(temp_slope_file)
        slope_array = slope_ds.ReadAsArray()
        
        # Scale slope values to 0-255 range
        # Assuming max slope of 100% for scaling
        slope_array = (slope_array / 100.0 * 255).clip(0, 255)
        slope_array = slope_array.astype(np.uint8)
        
        # Create final 8-bit output
        driver = gdal.GetDriverByName('GTiff')
        out_ds = driver.Create(
            output_slope_file,
            slope_ds.RasterXSize,
            slope_ds.RasterYSize,
            1,
            gdal.GDT_Byte,
            options=['COMPRESS=DEFLATE', 'PREDICTOR=2']
        )
        
        out_ds.SetGeoTransform(slope_ds.GetGeoTransform())
        out_ds.SetProjection(slope_ds.GetProjection())
        out_band = out_ds.GetRasterBand(1)
        out_band.WriteArray(slope_array)
        
        # Cleanup
        out_ds = None
        slope_ds = None
        os.remove(temp_slope_file)  # Remove temporary file
        
        print(f"Successfully created 8-bit slope raster: {output_slope_file}")

    except Exception as e:
        print(f"An error occurred while creating slope raster: {str(e)}")

def resample_raster(input_file: str, output_file: str, target_resolution: float) -> None:
    """
    Resample a raster to a lower resolution using GDAL
    
    Args:
        input_file (str): Path to the input raster file
        output_file (str): Path for the output resampled file
        target_resolution (float): Target resolution in meters
    """
    try:
        import subprocess
        
        # Get the input raster dimensions
        ds = gdal.Open(input_file)
        if ds is None:
            raise ValueError(f"Could not open {input_file}")
            
        width = ds.RasterXSize
        height = ds.RasterYSize
        ds = None  # Close dataset
        
        # Calculate new dimensions based on resolution ratio
        scale_factor = target_resolution / 2.5  # 2.5m to target_resolution
        new_width = int(width / scale_factor)
        new_height = int(height / scale_factor)
        
        # Construct gdalwarp command
        cmd = [
            'gdalwarp',
            '-overwrite',
            '-ts', str(new_width), str(new_height),  # target size instead of resolution
            '-r', 'bilinear',
            '-co', 'COMPRESS=DEFLATE',
            '-co', 'PREDICTOR=2',
            '-co', 'TILED=YES',
            '-co', 'BLOCKXSIZE=256',
            '-co', 'BLOCKYSIZE=256',
            '-wm', '256',
            '-multi',
            input_file,
            output_file
        ]
        
        print(f"Executing command: {' '.join(cmd)}")
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=False
        )
        
        if result.returncode != 0:
            error_msg = result.stderr if result.stderr else result.stdout
            if not error_msg:
                error_msg = "No error message provided by gdalwarp"
            raise RuntimeError(f"gdalwarp failed with return code {result.returncode}: {error_msg}")
            
        print(f"Successfully resampled raster to {target_resolution}m resolution: {output_file}")

    except Exception as e:
        print(f"An error occurred while resampling raster: {str(e)}")
        raise e

def create_slope_vector(slope_file: str, output_vector: str) -> None:
    """
    Create vector polygons from slope raster based on defined slope bands
    
    Args:
        slope_file (str): Path to the input slope raster
        output_vector (str): Path for the output vector file
    """
    try:
        # Open slope raster
        slope_ds = gdal.Open(slope_file)
        if slope_ds is None:
            raise ValueError(f"Cannot open slope file: {slope_file}")
            
        slope_band = slope_ds.GetRasterBand(1)
        slope_data = slope_band.ReadAsArray()
        
        # Create output vector
        driver = ogr.GetDriverByName('FlatGeobuf')
        if os.path.exists(output_vector):
            driver.DeleteDataSource(output_vector)
        vector_ds = driver.CreateDataSource(output_vector)
        
        # Create layer with explicit MULTIPOLYGON type
        srs = ogr.osr.SpatialReference()
        srs.ImportFromWkt(slope_ds.GetProjectionRef())
        layer = vector_ds.CreateLayer('slope_zones', srs, ogr.wkbMultiPolygon, options=['GEOMETRY_NAME=geom'])
        
        # Add fields
        layer.CreateField(ogr.FieldDefn('slope_min', ogr.OFTReal))
        layer.CreateField(ogr.FieldDefn('slope_max', ogr.OFTReal))
        
        # Process each slope band
        for min_slope, max_slope in SLOPE_BANDS:
            print(f"Processing slope band {min_slope}-{max_slope}%...")
            
            # Create binary mask for this slope range
            binary_data = np.logical_and(
                slope_data >= min_slope,
                slope_data < max_slope
            ).astype(np.uint8)
            
            # Create temporary raster in memory
            driver_mem = gdal.GetDriverByName('MEM')
            binary_ds = driver_mem.Create('',
                                        slope_ds.RasterXSize,
                                        slope_ds.RasterYSize,
                                        1,
                                        gdal.GDT_Byte)
            
            binary_ds.SetGeoTransform(slope_ds.GetGeoTransform())
            binary_ds.SetProjection(slope_ds.GetProjection())
            binary_band = binary_ds.GetRasterBand(1)
            binary_band.WriteArray(binary_data)
            
            # Create a memory layer for temporary polygons
            mem_driver = ogr.GetDriverByName('Memory')
            mem_ds = mem_driver.CreateDataSource('')
            mem_layer = mem_ds.CreateLayer('temp', srs, ogr.wkbPolygon)
            
            # Polygonize to memory layer
            gdal.Polygonize(binary_band, binary_band, mem_layer, -1, [], callback=None)
            
            # Convert polygons to multipolygons and add to final layer
            for feature in mem_layer:
                geom = feature.GetGeometryRef()
                if geom.GetGeometryType() == ogr.wkbPolygon:
                    multi_geom = ogr.Geometry(ogr.wkbMultiPolygon)
                    multi_geom.AddGeometry(geom)
                    out_feature = ogr.Feature(layer.GetLayerDefn())
                    out_feature.SetGeometry(multi_geom)
                    out_feature.SetField('slope_min', min_slope)
                    out_feature.SetField('slope_max', max_slope)
                    layer.CreateFeature(out_feature)
            
            # Cleanup temporary objects
            binary_ds = None
            mem_ds = None
        
        # Cleanup
        vector_ds = None
        slope_ds = None
        print(f"Successfully created slope vector: {output_vector}")
        
    except Exception as e:
        print(f"An error occurred while creating slope vector: {str(e)}")
        raise e

# Add derived paths to configs
for dem_type, config in DEM_CONFIGS.items():
    # Base output paths
    config['dem_file'] = f"./dem/{dem_type}_merged.tif"
    config['slope_file'] = f"./slope/{dem_type}_slope.tif"
    config['slope_vector'] = f"./slope/{dem_type}_slope_zones.fgb"
    config['contour_vector'] = f"./contours/{dem_type}_contours.fgb"
    
    # Add resampled paths if resampling is enabled
    if config.get('resample', {}).get('enabled'):
        target_res = config['resample']['target_resolution']
        config['resample'].update({
            'dem_file': f"./dem/{dem_type}_merged_{target_res}m.tif",
            'slope_file': f"./slope/{dem_type}_slope_{target_res}m.tif",
            'slope_vector': f"./slope/{dem_type}_slope_zones_{target_res}m.fgb",
            'contour_vector': f"./contours/{dem_type}_contours_{target_res}m.fgb"
        })

def create_contours(dem_file: str, output_vector: str, interval: float = 1.0) -> None:
    """
    Create contour lines from DEM with specified interval
    
    Args:
        dem_file (str): Path to the input DEM file
        output_vector (str): Path for the output contour vector file
        interval (float): Contour interval in meters (default: 1.0)
    """
    try:
        # Create output directory if it doesn't exist
        os.makedirs(os.path.dirname(output_vector), exist_ok=True)

        # Open DEM file
        ds = gdal.Open(dem_file)
        if ds is None:
            raise ValueError(f"Cannot open DEM file: {dem_file}")

        # Get the first raster band (1-based index)
        band = ds.GetRasterBand(1)
        if band is None:
            raise ValueError("Could not get raster band")

        # Create output vector
        driver = ogr.GetDriverByName('FlatGeobuf')
        if os.path.exists(output_vector):
            driver.DeleteDataSource(output_vector)
        vector_ds = driver.CreateDataSource(output_vector)
        
        if vector_ds is None:
            raise ValueError(f"Could not create output vector file: {output_vector}")

        # Create layer
        srs = ogr.osr.SpatialReference()
        srs.ImportFromWkt(ds.GetProjectionRef())
        layer = vector_ds.CreateLayer('contours', srs, ogr.wkbLineString, options=['GEOMETRY_NAME=geom'])
        
        if layer is None:
            raise ValueError("Could not create vector layer")

        # Add elevation field
        field_defn = ogr.FieldDefn('elevation', ogr.OFTReal)
        layer.CreateField(field_defn)
        
        # Generate contours with explicit parameters
        # Parameters: band, interval, base, fixedLevels, useNoData, noDataValue, layer, idField, elevField
        result = gdal.ContourGenerate(
            band,           # Input band
            interval,       # Interval between contours
            0,             # Base contour
            [],            # Fixed levels
            0,             # Use NoData flag
            0,             # NoData value
            layer,         # Output layer
            0,             # ID field index (-1 for none)
            0             # Elevation field index
        )
        
        if result != 0:
            raise ValueError(f"ContourGenerate failed with error code: {result}")
        
        # Cleanup
        vector_ds = None
        ds = None
        print(f"Successfully created contours: {output_vector}")
        
    except Exception as e:
        print(f"An error occurred while creating contours: {str(e)}")
        raise e

def process_dem(dem_type: str) -> None:
    """
    Process a specific DEM type through the entire workflow
    
    Args:
        dem_type (str): Type of DEM to process (must be a key in DEM_CONFIGS)
    """
    if dem_type not in DEM_CONFIGS:
        print(f"Unknown DEM type: {dem_type}")
        return
    
    config = DEM_CONFIGS[dem_type]
    print(f"\nProcessing {dem_type}...")
    
    # Create output directories
    os.makedirs(os.path.dirname(config["dem_file"]), exist_ok=True)
    os.makedirs(os.path.dirname(config["slope_file"]), exist_ok=True)
    
    # Process steps
    print("Unzipping files...")
    unzip_dem_files(config["input_folder"])
    
    print("\nMerging TIF files...")
    merge_dem_files(
        config["input_folder"],
        config["dem_file"],
        config["dem_water_value"],
        config["dem_offset"],
        config.get("dem_nodata_value")  # Get nodata value if it exists
    )
    
    print("\nCreating slope raster...")
    create_slope_raster(config["dem_file"], config["slope_file"])
    
    # Perform resampling if enabled
    if config.get("resample", {}).get("enabled", False):
        print(f"\nResampling to {config['resample']['target_resolution']}m resolution...")
        # Resample DEM
        resample_raster(
            config["dem_file"],
            config["resample"]["dem_file"],
            config["resample"]["target_resolution"]
        )
        # Create slope from resampled DEM
        print("\nCreating slope raster from resampled DEM...")
        create_slope_raster(
            config["resample"]["dem_file"],
            config["resample"]["slope_file"]
        )
        
        # Generate slope vectors if enabled
        if GENERATE_VECTORS['slope']:
            print("\nCreating slope vector zones from resampled data...")
            create_slope_vector(
                config["resample"]["slope_file"],
                config["resample"]["slope_vector"]
            )
        
        # Generate contours if enabled
        if GENERATE_VECTORS['contours']:
            print("\nCreating contours from resampled DEM...")
            create_contours(
                config["resample"]["dem_file"],
                config["resample"]["contour_vector"],
                interval=config["resample"]["contour_interval"]
            )
    else:
        # Generate slope vectors if enabled
        if GENERATE_VECTORS['slope']:
            print("\nCreating slope vector zones...")
            create_slope_vector(config["slope_file"], config["slope_vector"])
        
        # Generate contours if enabled
        if GENERATE_VECTORS['contours']:
            print("\nCreating contours...")
            create_contours(
                config["dem_file"],
                config["contour_vector"],
                interval=config["contour_interval"]
            )

if __name__ == "__main__":
    # Process all DEM types
    dem_type = sys.argv[1]
    process_dem(dem_type) 