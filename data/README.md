## Building footprints for Goa state

- Google Open Buildings: https://colab.research.google.com/github/google-research/google-research/blob/master/building_detection/open_buildings_download_region_polygons.ipynb
- Use Natural Earth (low res)/India region
- Use WKT polygon covering Goa state and run step 1`POLYGON((73.55661736553476 15.954086566121125,74.63327752178476 15.954086566121125,74.63327752178476 14.741038479091157,73.55661736553476 14.741038479091157,73.55661736553476 15.954086566121125))`
- Run step 2 to Download result directly `open_buildings_v3_polygons_goa.csv.gz`
- Convert csv to gpkg
```
ogr2ogr -f GPKG /Users/arun/Gis/qgis/Goa/data/google/open_buildings_v3_polygons_goa.gpkg /Users/arun/Gis/qgis/Goa/data/google/open_buildings_v3_polygons_goa.csv -oo GEOM_POSSIBLE_NAMES=geometry -oo KEEP_GEOM_COLUMNS=NO -a_srs EPSG:4326
```


## Generating slope class map from raster DEM data

- CartoDem [specifications](https://bhoonidhi.nrsc.gov.in/bhoonidhi_resources/help/sampleprods/Cartosat-1/DEM/CartoDEM-Specs.pdf). 

- Inspect 2.5m DEM in QGIS. Compare with SRTM to find elevation offset.

- Convert 2.5m DEM tif to contour lines with 1m  interval

```
# First, apply a smoothing filter to remove noisy spikes from the original DEM
# -md 2: Sets the maximum distance for interpolation
# -si 1: Sets the search interval to 1 pixel

# First, combine the two input DEM images
gdal_merge.py -o /Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/tmp_combined_dem.tif \
-init -249 \
/Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/P5_PAN_CD_N15_375_E073_875_DEM.tif \
/Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/P5_PAN_CD_N15_500_E073_750_DEM.tif

# Now, apply the offset correction to the smoothed DEM
gdal_translate -a_offset 81 \
    /Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/tmp_combined_dem.tif \
	/Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/isro_2_5m_dem_corrected.tif 


# Resample to 30m to remove high frequency noise of building edges
gdalwarp -tr .0003 .0003 -r bilinear \
    /Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/isro_2_5m_dem_corrected.tif \
    /Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/isro_30m_resampled_dem.tif

# Create slope map from corrected and smoothed ISRO DEM
gdaldem slope /Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/isro_30m_resampled_dem.tif /Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/isro_30m_slope.tif -p -s 111120 -alg ZevenbergenThorne -compute_edges -of GTiff

# Create slope map from ASTER DEM
gdaldem slope /Users/arun/Gis/qgis/Goa/data/dem/aster_30m/ASTGTMV003_N15E073_dem.tif /Users/arun/Gis/qgis/Goa/data/dem/aster_30m/aster_30m_slope.tif -p -s 111120 -alg ZevenbergenThorne -compute_edges -of GTiff


# Create classified slope raster
# 1=<10% slope, 2=10-20% slope, 3=20-25% slope, 4=>25% slope

## Create slope classes raster from ISRO slope map

gdal_calc.py  --overwrite -A /Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/isro_30m_slope.tif \
    --outfile=/Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/isro_30m_slope_bands.tif \
    --calc="0*(A<=10) + 10*((A>10) & (A<=20)) + 20*((A>20) & (A<=25)) + 25*((A>25) & (A<=35)) + 35*((A>35) & (A<=45)) + 45*((A>45))" \
    --NoDataValue=-9999 \
    --type=Int16

gdal_calc.py  --overwrite -A /Users/arun/Gis/qgis/Goa/data/dem/aster_30m/aster_30m_slope.tif \
    --outfile=/Users/arun/Gis/qgis/Goa/data/dem/aster_30m/aster_30m_slope_bands.tif \
    --calc="0*(A<=10) + 10*((A>10) & (A<=20)) + 20*((A>20) & (A<=25)) + 25*((A>25) & (A<=35)) + 35*((A>35) & (A<=45)) + 45*((A>45))" \
    --NoDataValue=-9999 \
    --type=Int16

# Convert slope bands raster to points at cell centroids
gdal_translate -of XYZ /Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/isro_30m_slope_bands.tif /Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/tmp_slope_points.xyz

# Convert XYZ to CSV with header row, ensuring numeric formatting
echo "longitude,latitude,slope_pct" > /Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/tmp_slope_points.csv
awk '{printf "%.6f,%.6f,%d\n", $1, $2, $3}' /Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/tmp_slope_points.xyz >> /Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/tmp_slope_points.csv

# Convert CSV to GeoPackage points
ogr2ogr -f "GPKG" \
    /Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/isro_30m_slope_centroids.gpkg \
    /Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/tmp_slope_points.csv \
    -oo X_POSSIBLE_NAMES=longitude \
    -oo Y_POSSIBLE_NAMES=latitude \
    -oo AUTODETECT_TYPE=YES \
    -a_srs EPSG:4326

# Clean up temporary files
rm /Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/tmp_slope_points.xyz
rm /Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/tmp_slope_points.csv


# Create color palette file for rendered slope tifs
echo "1 255 255 255 0
2 255 221 1 255
3 255 126 21 255
4 255 1 86 255" > /Users/arun/Gis/qgis/Goa/data/slope_colors.txt

# Create rendered slope tif for ISRO slope map
gdaldem color-relief -co "COMPRESS=LZW" -alpha /Users/arun/Gis/qgis/Goa/data/dem/isro_30m_slope_classes.tif /Users/arun/Gis/qgis/Goa/data/slope_colors.txt /Users/arun/Gis/qgis/Goa/data/dem/isro_30m_slope_rendered.tif

# Create rendered slope tif for ASTER slope map
gdaldem color-relief -co "COMPRESS=LZW" -alpha /Users/arun/Gis/qgis/Goa/data/dem/aster_30m/aster_30m_slope_classes.tif /Users/arun/Gis/qgis/Goa/data/slope_colors.txt /Users/arun/Gis/qgis/Goa/data/dem/aster_30m/aster_30m_slope_rendered.tif

# Generate polygons from the slope classes raster
rm -f /Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/isro_30m_slope_bands.gpkg
gdal_polygonize.py /Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/isro_30m_slope_bands.tif /Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/isro_30m_slope_bands.gpkg isro_30m_slope_bands min_slope_pct

# Delete features with min_slope_pct=0
# And incorrect slopes at data tile edges using an area filter
ogr2ogr -f "GPKG" /Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/isro_30m_slope_bands_filtered.gpkg /Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/isro_30m_slope_bands.gpkg -sql "SELECT *, ST_Area(ST_Transform(geom, 3857)) AS area_m2 FROM isro_30m_slope_bands WHERE min_slope_pct>0 AND NOT (min_slope_pct = 45 AND ST_Area(ST_Transform(geom, 32643)) > 100000)"

# Overwrite the original file with the filtered one
mv /Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/isro_30m_slope_bands_filtered.gpkg /Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/isro_30m_slope_bands.gpkg

# Create a new GeoPackage with slope zones and buildings layers
rm -f /Users/arun/Gis/qgis/Goa/data/goa_slope_zone_buildings.gpkg

# Add slope zones layer to the new GeoPackage
ogr2ogr -f "GPKG" /Users/arun/Gis/qgis/Goa/data/goa_slope_zone_buildings.gpkg /Users/arun/Gis/qgis/Goa/data/dem/isro_2_5m/isro_30m_slope_bands.gpkg -nln slope_zone 

# Add buildings layer to the new GeoPackage
# Extract only buildings matching DEM area
ogr2ogr -f "GPKG" -update /Users/arun/Gis/qgis/Goa/data/goa_slope_zone_buildings.gpkg /Users/arun/Gis/qgis/Goa/data/google/open_buildings_v3_polygons_goa.gpkg open_buildings_v3_polygons_goa -nln buildings -spat 73.75 15.37 74.00 15.62

# Create a separate GeoPackage for the union of slope zones and buildings layers
# Takes  20min
ogr2ogr -f "GPKG" -nlt MULTIPOLYGON /Users/arun/Gis/qgis/Goa/data/goa_slope_zones_buildings_union.gpkg /Users/arun/Gis/qgis/Goa/data/goa_slope_zone_buildings.gpkg -dialect sqlite -sql "
SELECT 
    b.*, 
    s.min_slope_pct
FROM buildings b
JOIN slope_zone s ON ST_Intersects(b.geometry, s.geom)
WHERE s.min_slope_pct >= 20
GROUP BY b.fid
HAVING s.min_slope_pct = MAX(s.min_slope_pct)
" -nln buildings_with_slope_class


# Create a separate GeoPackage for the union of slope zones and buildings layers
qgis_process run native:joinattributesbylocation --distance_units=meters --area_units=m2 --ellipsoid=EPSG:7030 --INPUT='/Users/arun/Gis/qgis/Goa/data/goa_slope_zone_buildings.gpkg|layername=buildings' --PREDICATE=0 --JOIN='/Users/arun/Gis/qgis/Goa/data/goa_slope_zone_buildings.gpkg|layername=slope_zones' --JOIN_FIELDS=slope_class --METHOD=2 --DISCARD_NONMATCHING=false --PREFIX= --OUTPUT=TEMPORARY_OUTPUT
```
