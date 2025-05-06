# Map Datasets

Documentation of open spatial data resources for Goa. 

- For datasource wise details, please check individual folders.

## Regional Plan for Goa 2021

This is a georeferenced mosaic of village level land use plans published and notified by the Goa Town and Country Planning Department.

- [Regional Plan for Goa 2021 mosaic on mapwarper](https://mapwarper.net/layers/2054#Edit_tab) | [WMS/TMS/KML](https://mapwarper.net/layers/2054#Export_tab)
- GeoTIFF downloads are available on a village level. Check the export option on the mapwarper map link from the [Map Index](https://docs.google.com/spreadsheets/d/1F_1ntegp-tKhLfwaA4Ygv-cj1NST-fDmqeKuhfl1za8/edit?gid=347636234#gid=347636234)

**Process**

1. Individual village plans were downloaded from the [Goa Town and Country Planning Department](https://tcp.goa.gov.in/land-use-plan-regional-plan-for-goa-2021/) and uploaded to [mapwarper](https://mapwarper.net/).
2. A [Map Index Sheet](https://docs.google.com/spreadsheets/d/1F_1ntegp-tKhLfwaA4Ygv-cj1NST-fDmqeKuhfl1za8/edit?gid=347636234#gid=347636234) was compiled to coordinate the progress of georeferencing, masking and mosaicing by the community
3. After a plan was georeferenced, it was masked and added to the [Regional Plan for Goa 2021 mosaic](https://mapwarper.net/layers/2054#Edit_tab)
4. Based on feedback from the community, each village plan on mapwarper  can be continously adjusted for correct position and masking of the village edges for seamless mosaicing. These changes are instantly reflected on the mosaic.

## Mapbox Streets Vector Tiles

These are vector tiles of OpenStreetMap data and a combination of other open data sources from the Mapbox API. These are used to create the overlay vectors of roads, place labels and natural features on the map.

- [Docs](https://docs.mapbox.com/data/tilesets/reference/mapbox-streets-v8/)
- License: (c) [Mapbox](https://www.mapbox.com/about/maps#data-sources) and (c) [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)

**Buildings**

The buildings data in the vector tiles is primarily from the [OpenStreetMap India Community](https://www.openstreetmap.in) and backfilled with AI generated [Google Open Buildings](https://colab.research.google.com/github/google-research/google-research/blob/master/building_detection/open_buildings_download_region_polygons.ipynb) dataset

## OpenStreetMap Data

- Downloaded shapefiles updated daily from [Geofabrik](https://download.geofabrik.de/asia/india/western-zone.html)

## Google Open Buildings

- Use Natural Earth (low res)/India region
- Use WKT polygon covering Goa state and run step 1`POLYGON((73.55661736553476 15.954086566121125,74.63327752178476 15.954086566121125,74.63327752178476 14.741038479091157,73.55661736553476 14.741038479091157,73.55661736553476 15.954086566121125))`
- Run step 2 to Download result directly `open_buildings_v3_polygons_goa.csv.gz`
- Convert csv to gpkg
```
ogr2ogr -f GPKG ./google/open_buildings_v3_polygons_goa.gpkg ./google/open_buildings_v3_polygons_goa.csv -oo GEOM_POSSIBLE_NAMES=geometry -oo KEEP_GEOM_COLUMNS=NO -a_srs EPSG:4326
```


## ISRO CartoDEM

2.5m high resolution DEM licensed from ISRO. 

- CartoDem [specifications](https://bhoonidhi.nrsc.gov.in/bhoonidhi_resources/help/sampleprods/Cartosat-1/DEM/CartoDEM-Specs.pdf)

The source data has an elevation offset which has to be corrected and noise that has to be filtered by downsampling from 2.5m to 30m resolution.

See [/slope](./slope) for details on how the slope class map was generated.
