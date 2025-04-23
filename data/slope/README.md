# Slope Analysis and Processing Tools

This folder contains scripts for high resolution contour and slope extraction from remote sensing Digital Elevation Model (DEM) data. These are designed to help identify slopes categorized as **Restricted Development Slopes (RDS)** and **No Development Slopes (NDS)** according to Goa's legal framework for construction regulation.

## Background

Goa features sloping terrain and lateritic soil with very high rainfall. This combination poses significant landslide risks to people and property if slopes are destabilized through unregulated construction. The tools in this repository help identify areas where construction should be restricted or prohibited according to the following classifications:

- **Restricted Development Slopes (RDS-1)**: 10-20% slope
- **Restricted Development Slopes (RDS-2)**: 20-25% slope
- **No Development Slopes (NDS)**: 25-35% slope
- **No Development Slopes (NDS)**: >35% slope

## Supported DEM Sources

The processing scripts support multiple Digital Elevation Model sources:

| DEM Source | Resolution | Coverage | Notes |
|------------|------------|----------|-------|
| CartoSat | 2.5m | High-resolution local coverage | Best for detailed analysis |
| CartoSat | 30m | Regional coverage | Good balance of detail and coverage |
| ASTER | 30m | Global coverage | Alternative source |
| ALOS | 30m | Global coverage | Alternative source |
| NASADEM | 30m | Global coverage | NASA's improved SRTM data |

## Processing Workflow

### 1. DEM Processing (`dem_slope_processor.py`)

This script processes raw DEM data to create normalized elevation models and derived slope rasters:

**Features:**
- Merges multiple DEM tiles into a single raster
- Performs DEM normalization to correct for data offsets
- Applies noise filtering to improve accuracy
- Calculates slope in percent using the Zevenbergen-Thorne algorithm
- Generates contour lines at configurable intervals
- Creates vector polygons of slope zones based on RDS/NDS thresholds

**Usage:**
```
python dem_slope_processor.py <dem_source>
```

### 2. Plot Slope Analysis (`plot_slope_statistics.py`)

This script analyzes cadastral plots against slope data to quantify slope-related risks:

**Features:**
- Calculates precise area statistics for each slope category within plots
- Uses spatial indexing for efficient processing of large datasets
- Implements parallel processing to utilize multiple CPU cores
- Employs weighted moving averages to track progress and estimate completion time
- Produces detailed plot-level statistics and regional aggregations

**Usage:**
```
python plot_slope_statistics.py <cadastral_geojson> <slope_raster> [--debug]
```

### 3. Vector-Based Slope Analysis (`shape_slope_statistics.py`)

An alternative approach using vector-based analysis instead of raster sampling:

**Features:**
- Performs vector-based spatial intersections between plots and slope zones
- Generally faster than raster-based analysis for large datasets
- Produces compatible output with plot_slope_statistics.py

**Usage:**
```
python shape_slope_statistics.py <cadastral_geojson> <slope_zones_vector>
```

### 4. Mapbox Tileset Management (`tileset_manager.py`)

Helps publish slope and contour data to Mapbox for web visualization:

**Features:**
- Creates and updates Mapbox tilesets for web-based visualization
- Configures optimal zoom levels for different resolution datasets
- Supports all processed DEM sources

**Usage:**
```
python tileset_manager.py [create|update] [dem_type]
```

## Output Files

The scripts generate various output files including:

- Normalized DEM rasters (GeoTIFF format)
- Slope rasters in percent (GeoTIFF format)
- Contour lines (FlatGeobuf format)
- Slope zone polygons (FlatGeobuf format)
- Plot-level statistics with slope area measurements (FlatGeobuf format)
- Summary statistics (JSON format)
- Identified high-risk locations (GeoJSON, CSV formats)

## Special Features

### DEM Processing Optimizations

- **Normalization**: Corrects for data offsets and ensures consistent elevation values
- **Noise Filtering**: Reduces noise in DEM data to improve slope accuracy
- **Coordinate System Management**: Handles transformations between coordinate systems

### Performance Optimizations

- **Parallelization**: Both plot_slope_statistics.py and shape_slope_statistics.py use multiprocessing to speed up analysis
- **Spatial Indexing**: Divides work into spatial groups for efficient parallel processing
- **Progress Tracking**: Uses weighted moving averages to estimate completion time
- **Checkpointing**: Periodically saves progress to enable recovery from interruptions

## Requirements

See `requirements.txt` for detailed package dependencies. Main requirements:

- GDAL 3.0.0+
- NumPy
- Rasterio
- Fiona
- Mapbox Tilesets API (for publishing to web)

## Setup and Installation

```
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

For full Mapbox integration, set the `MAPBOX_ACCESS_TOKEN` environment variable with a token that has tilesets:write scope.

## Example Workflow

1. Download DEM data for your target area
2. Process DEM data: `python dem_slope_processor.py cartodem_30m`
3. Analyze plots: `python plot_slope_statistics.py plots.fgb slope/cartodem_30m_slope.tif`
4. Publish to Mapbox: `python tileset_manager.py create cartodem_30m`
