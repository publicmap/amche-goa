export const layersConfig = [
    {
        id: 'streetmap',
        title: 'Street Map रस्त्याचो नकासो',
        description: 'Detailed street map sourced from <a href="https://www.openstreetmap.org/#map=11/15.4054/73.9280" target="_blank">OpenStreetMap contributors</a> and other data sources via <a href="https://docs.mapbox.com/data/tilesets/reference/mapbox-streets-v8/" target="_blank">Mapbox Streets</a> vector tiles.',
        type: 'style',
        headerImage: 'assets/map-layer-streetmap.png',
        initiallyChecked: true,
        layers: [
            { title: 'Places', sourceLayer: 'place_label' },
            { title: 'Landmarks', sourceLayer: 'poi_label' },
            { title: 'Buildings', sourceLayer: 'building' },
            { title: 'Structures', sourceLayer: 'structure' },
            { title: 'Roads', sourceLayer: 'road' },
            { title: 'Hillshading', sourceLayer: 'hillshade' },
            { title: 'Landcover', sourceLayer: 'landcover' },
            { title: 'Landuse', sourceLayer: 'landuse' },
            { title: 'Wetlands & National Parks', sourceLayer: 'landuse_overlay' },
            { title: 'Waterways', sourceLayer: 'waterway' },
            { title: 'Waterbodies', sourceLayer: 'water' },
        ]
    },
    {
        title: 'Community Pins',
        description: 'Pin your notes on the map for the rest of the community to see',
        headerImage: 'assets/map-layer-pins.png',
        type: 'markers',
        id: 'community-pins',
        dataUrl: 'https://docs.google.com/spreadsheets/d/1Y0l4aSIdks8G3lmxSxSKxuzLoARL-FCiYbTL9a0b3O0/gviz/tq?tqx=out:json&tq&gid=0',
        attribution: 'Collected by amche.in | <a href="https://docs.google.com/spreadsheets/d/1Y0l4aSIdks8G3lmxSxSKxuzLoARL-FCiYbTL9a0b3O0/edit?resourcekey=&gid=485622101#gid=485622101">View Source Spreadsheet</a>',
        style: {
            'circle-color': '#FF4136',
            'circle-radius': 8
        },
        inspect: {
            title: 'Pin Details',
            label: 'name',
            fields: ['Location Name', 'Additional Notes (optional)', 'Timestamp_ago'],
            fieldTitles: ['Name', 'Notes', 'Added'],
        }
    },
    {
        title: 'Community Maps',
        description: 'Sketches, maps and plans by the people of Goa',
        headerImage: 'assets/map-layer-community-maps.png',
        type: 'tms',
        id: 'community-maps',
        url: 'https://mapwarper.net/mosaics/tile/2157/{z}/{x}/{y}.png',
        attribution: '<a href="https://mapwarper.net/layers/2157">CC-BY-SA Mapwarper community maps of Goa</a>'
    },
    {
        title: 'Cadastral Plot Boundaries',
        description: 'Cadastral Boundaries from the <a href="Directorate of Settlement & Land Records">Department of Land Records</a>. The map is provided for information purpose only. An official copy can be obtained from <a href="https://goaonline.gov.in" target="_blank" rel="noopener noreferrer">Goa Online</a>',
        headerImage: 'assets/map-layer-survey.png',
        type: 'vector',
        id: 'plot',
        url: 'https://indianopenmaps.fly.dev/not-so-open/cadastrals/goa/bhunaksha/{z}/{x}/{y}.pbf',
        sourceLayer: 'Goa_Bhunaksha_Cadastrals',
        maxzoom: 16,
        attribution: '<a href="https://bhunaksha.goa.gov.in/bhunaksha/">Goa Bhunaksha</a> - Collected by <a href="https://datameet.org">Datameet Community</a>',
        style: {
            'text-font': ['Open Sans Bold'],
            'text-field': [
                "step",
                ["zoom"],
                "",
                15,
                [
                    "to-string",
                    ['get', 'kide']
                ]
            ],
            'text-color': 'black',
            'text-halo-color': 'white',
            'text-halo-width': .5,
            'text-halo-blur': 1,
            'text-size': 13,
            'fill-color': [
                'interpolate',
                ['linear'],
                ['zoom'],
                15, 'rgba(0, 0, 0, 0.05)',
                18, 'rgba(0, 0, 0, 0.1)'
            ],
            'line-color': 'black',
            'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                15, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    2,
                    ['boolean', ['feature-state', 'hover'], false],
                    1.5,
                    0
                ],
                18, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    6,
                    ['boolean', ['feature-state', 'hover'], false],
                    5,
                    .5
                ]
            ]
        },
        initiallyChecked: true,
        inspect: {
            id: 'id',
            title: 'Survey Number',
            label: 'kide',
            fields: ['VillageNam', 'TalName'],
            fieldTitles: ['Village', 'Taluk'],
            customHtml: '<a href="https://bhunaksha.goa.gov.in/bhunaksha/" target="_blank">View in Bhunaksha Goa</a> | <a href="https://goaonline.gov.in/Appln/Uil/DeptServices?__DocId=REV&__ServiceId=REV31" target="_blank">View RoR</a>'
        }
    },
    {
        id: 'village',
        title: 'Village Boundaries',
        headerImage: 'assets/map-layer-village.png',
        description: 'Revenue village boundaries with <a href="https://lgdirectory.gov.in/" target="_blank">Local Government Directory</a> attributes.',
        type: 'vector',
        url: 'https://indianopenmaps.fly.dev/not-so-open/villages/lgd/{z}/{x}/{y}.pbf ',
        sourceLayer: 'LGD_Villages',
        maxzoom: 10,
        attribution: '<a href="https://mapservice.gov.in/gismapservice/rest/services/BharatMapService/Village_Boundary/MapServer/0">NIC Bharatmaps GIS</a>, <a href="https://lgdirectory.gov.in/" target="_blank">Local Government Directory, Ministry of Panchayati Raj</a> - Collected by <a href="https://datameet.org">Datameet Community</a>',
        style: {
            'text-field': ['get', 'vilnam_soi'],
            'text-color': 'white',
            'text-halo-color': 'black',
            'text-halo-width': 5,
            'text-size': 13,
            'fill-color': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8, 'rgba(0, 0, 0, 0)',
                12, 'rgba(0, 0, 0, 0.1)'
            ],
            'line-color': 'black',
            'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    1.5,
                    ['boolean', ['feature-state', 'hover'], false],
                    1,
                    0
                ],
                12, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    3,
                    ['boolean', ['feature-state', 'hover'], false],
                    2,
                    1
                ]
            ]
        },
        inspect: {
            title: 'Village',
            label: 'vilnam_soi',
            id: 'OBJECTID',
            fields: ['vil_lgd', 'gp_name', 'block_name', 'sdtname', 'dtname'],
            fieldTitles: ['Village Code', 'Gram Panchayat', 'Block', 'Sub District', 'District']
        }
    },
    {
        id: 'municipal-wards',
        title: 'Municipal Ward Boundaries',
        headerImage: 'assets/map-layer-ulb-wards.png',
        description: 'Ward boundaries for Panaji Municipal Corporation and Municipal Councils (partial coverage)',
        type: 'vector',
        url: 'https://indianopenmaps.fly.dev/not-so-open/urban/wards/sbm/{z}/{x}/{y}.pbf',
        sourceLayer: 'SBM_Wards',
        maxzoom: 12,
        attribution: '<a href="https://sbm-g-esriindia1.hub.arcgis.com/">Swachh Bharat Mission GIS</a> - Collected by <a href="https://datameet.org">Datameet Community</a>',
        style: {
            'text-field': ['get', 'wardcode'],
            'text-color': 'white',
            'text-halo-color': 'purple',
            'text-halo-width': 5,
            'text-size': 13,
            'fill-color': [
                'interpolate',
                ['linear'],
                ['zoom'],
                16, 'rgba(0, 0, 0, 0.05)',
                18, 'rgba(0, 0, 0, 0.1)'
            ],
            'line-color': 'hsl(278, 82%, 57%)',
            'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                12, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    4,
                    ['boolean', ['feature-state', 'hover'], false],
                    4,
                    1
                ],
                18, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    6,
                    ['boolean', ['feature-state', 'hover'], false],
                    5,
                    3
                ]
            ]
        },
        inspect: {
            title: 'Ward Number',
            label: 'wardcode',
            id: 'objectid',
            fields: ['ulbname'],
            fieldTitles: ['Urban Local Body']
        }
    },
    {
        title: 'Local Body Boundaries',
        description: 'Municipal and Panchayat local body boundaries. Please see <a href="https://grammanchitra.gov.in/gm4MVC" target="_blank">Gramanchiitra</a> for panchayat demographic profile and information on elected representatives.',
        headerImage: 'assets/map-layer-local-boundaries.png',
        type: 'vector',
        id: 'local-body',
        url: 'mapbox://planemad.2bqa1pq1',
        sourceLayer: 'goa-local-body-boundaries',
        maxzoom: 10,
        attribution: '<a href="https://onemapgoagis.goa.gov.in/map/?c=0%2C0&s=0">OneMapGoa</a> - Collected by <a href="https://datameet.org">Datameet Community</a>',
        initiallyChecked: true,
        style: {
            'text-field': ['get', 'Name'],
            'text-color': 'white',
            'text-halo-color': 'purple',
            'text-halo-width': 5,
            'text-size': 14,
            'fill-color': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8, 'rgba(0, 0, 0, 0)',
                12, 'rgba(0, 0, 0, 0.1)'
            ],
            'line-color': 'purple',
            'line-dasharray': [6, 6],
            'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    1.5,
                    ['boolean', ['feature-state', 'hover'], false],
                    1,
                    .1
                ],
                12, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    3.5,
                    ['boolean', ['feature-state', 'hover'], false],
                    2.5,
                    1.5
                ]
            ],
        },
        inspect: {
            title: 'Local Body Name',
            label: 'Name',
            id: 'fid',
            fields: ['Village Names', 'Ward Count', 'Subdistrict Name', 'District Name','Code'],
            fieldTitles: ['Villages', 'Ward Count', 'Sub District', 'District','LGD Code']
        }
    },
    {
        title: 'Assembly Constituencies',
        description: 'Members of Legislative Assembly (MLA) constituencies.',
        headerImage: 'assets/map-layer-assembly-boundaries.png',
        type: 'vector',
        id: 'assembly-constituencies',
        url: 'https://indianopenmaps.fly.dev/not-so-open/constituencies/assembly/lgd/{z}/{x}/{y}.pbf ',
        sourceLayer: 'LGD_Assembly_Constituencies',
        maxzoom: 10,
        attribution: '<a href="https://mapservice.gov.in/gismapservice/rest/services/BharatMapService/AC_PC/MapServer/2">LGD/Bharatmaps/ECI</a> - Collected by <a href="https://datameet.org">Datameet Community</a>',
        style: {
            'text-field': ['get', 'ac_name'],
            'text-color': 'white',
            'text-halo-color': 'blue',
            'text-halo-width': 5,
            'text-size': 15,
            'fill-color': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8, 'rgba(0, 0, 0, 0)',
                12, 'rgba(0, 0, 0, 0.1)'
            ],
            'line-color': 'blue',
            'line-dasharray': [6, 6],
            'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    1.5,
                    ['boolean', ['feature-state', 'hover'], false],
                    1,
                    .1
                ],
                12, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    3.5,
                    ['boolean', ['feature-state', 'hover'], false],
                    2.5,
                    1.5
                ]
            ],
        },
        inspect: {
            title: 'Name',
            label: 'ac_name',
            id: 'OBJECTID',
            fields: ['AC_ID', 'pc_name', 'dist_name', 'st_name'],
            fieldTitles: ['Constituency Code', 'Parliamentary Constituency', 'District', 'State']
        }
    },
    {
        title: 'Parliamentary Constituencies',
        description: 'Members of Parliament (MP) constituencies',
        headerImage: 'assets/map-layer-parliament-boundaries.png',
        type: 'vector',
        id: 'parliamentary-constituencies',
        url: 'https://indianopenmaps.fly.dev/not-so-open/constituencies/parliament/lgd/{z}/{x}/{y}.pbf ',
        sourceLayer: 'LGD_Parliament_Constituencies',
        maxzoom: 10,
        attribution: '<a href="https://mapservice.gov.in/gismapservice/rest/services/BharatMapService/AC_PC/MapServer/1">LGD/Bharatmaps/ECI</a> - Collected by <a href="https://datameet.org">Datameet Community</a>',
        style: {
            'text-field': ['get', 'pc_name'],
            'text-color': 'white',
            'text-halo-color': 'blue',
            'text-halo-width': 5,
            'text-size': 18,
            'fill-color': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8, 'rgba(0, 0, 0, 0)',
                12, 'rgba(0, 0, 0, 0.1)'
            ],
            'line-color': 'blue',
            'line-dasharray': [6, 6],
            'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    4,
                    ['boolean', ['feature-state', 'hover'], false],
                    4,
                    3
                ],
                12, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    6,
                    ['boolean', ['feature-state', 'hover'], false],
                    6,
                    5
                ]
            ],
        },
        inspect: {
            title: 'Name',
            label: 'pc_name',
            id: 'OBJECTID',
            fields: ['dist_name', 'st_name'],
            fieldTitles: ['District', 'State']
        }
    },
    {
        title: 'Rivers',
        description: 'Rivers and streams with stream order',
        headerImage: 'assets/map-layer-rivers.png',
        type: 'vector',
        id: 'rivers',
        url: 'https://indianopenmaps.fly.dev/streams/wris/{z}/{x}/{y}.pbf',
        sourceLayer: 'wris_streams',
        maxzoom: 11,
        attribution: '<a href="https://indiawris.gov.in/wris/">India WRIS</a> - Collected by <a href="https://datameet.org">Datameet Community</a>',
        style: {
            'line-color': '#0084f7',
            'line-opacity': 0.8,
            'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8, [
                    'case',
                    ['has', 'ordsh'],
                    ['*', 0.5, ['to-number', ['get', 'ordsh']]],
                    0  // default width for undefined stream order
                ],
                14, [
                    'case',
                    ['has', 'ordsh'],
                    ['*', 2, ['to-number', ['get', 'ordsh']]],
                    1  // default width for undefined stream order
                ],
                18, [
                    'case',
                    ['has', 'ordsh'],
                    ['*', 1, ['to-number', ['get', 'ordsh']]],
                    1  // default width for undefined stream order
                ]
            ]
        },
        inspect: {
            title: 'Name',
            label: 'rivname',
            fields: ['bacode', 'ordsh'],
            fieldTitles: ['Basin Code', 'Stream Order']
        }
    },
    {
        id: 'watershed',
        title: 'Watershed Boundaries',
        headerImage: 'assets/map-layer-watersheds.png',
        description: 'Watershed Boundaries',
        type: 'vector',
        url: 'https://indianopenmaps.fly.dev/watersheds/wris/{z}/{x}/{y}.pbf',
        sourceLayer: 'wris_watershed',
        maxzoom: 10,
        attribution: '<a href="https://indiawris.gov.in/wris/#/riverBasins">India Water Resources Information System, Ministry of Jal Shakti</a> - Collected by <a href="https://datameet.org">Datameet Community</a>',
        style: {
            'fill-color': 'rgba(0, 0, 0, 0)',
            'line-color': 'blue',
            'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                12, 5,
                18, 9
            ]
        },
        inspect: {
            id: 'objectid',
            title: 'Watershed Code',
            label: 'wsconc'
        }
    },
    {
        id: 'micro-watersheds',
        title: 'Micro Watershed Boundaries',
        headerImage: 'assets/map-layer-micro-watersheds.png',
        description: 'Micro Watershed Boundaries',
        type: 'vector',
        url: 'https://indianopenmaps.fly.dev/micro-watersheds/priorities/slusi/{z}/{x}/{y}.pbf',
        sourceLayer: 'SLUSI_Priority_MicroWatersheds',
        maxzoom: 10,
        attribution: '<a href="https://soilhealth.dac.gov.in/slusi-visualisation/">Soil and Land Use Survey of India, Ministry of Agriculture and Farmers Welfare</a> - Collected by <a href="https://datameet.org">Datameet Community</a>',
        style: {
            'fill-color': [
                'match',
                ['get', 'Priority'],
                'Very High', 'rgba(255, 0, 0, 0.8)',      // Bright red - most visible
                'High', 'rgba(255, 140, 0, 0.7)',         // Orange
                'Medium', 'rgba(255, 255, 0, 0.6)',       // Yellow
                'Low', 'rgba(144, 238, 144, 0.5)',        // Light green
                'Very Low', 'rgba(0, 100, 0, 0.4)',       // Dark green - least visible
                'rgba(128, 128, 128, 0.5)'                // Default gray for unknown values
            ],
            'fill-opacity': 0.4,
            'line-color': 'blue',
            'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                12, 2,
                18, 4
            ]
        },
        inspect: {
            title: 'Micro Watershed Code',
            label: 'HYDRO_UNIT',
            fields: ['Priority'],
            fieldTitles: ['Watershed Priority']
        }
    },

    {
        title: 'Water Bodies',
        description: 'Water body boundaries',
        headerImage: 'assets/map-layer-water-bodies.png',
        type: 'geojson',
        id: 'water-bodies',
        url: 'https://gist.githubusercontent.com/planemad/e5ccc47bf2a1aa458a86d6839476f539/raw/6922fcc2d5ffd4d58b0fb069b9f57334f13cd953/goa-water-bodies.geojson',
        attribution: '<a href="https://goawrd.gov.in/">Water Body Atlas Of Goa, Department of Water Resources</a>',
        style: {
            'text-color': 'white',
            'text-halo-color': '#0084f7',
            'text-halo-width': 2,
            'text-size': 12,
            'line-color': '#0084f7',
            'line-width': 2,
            'fill-color': '#0084f7',
            'fill-opacity': 0.3
        },
        inspect: {
            id: 'id',
            title: 'Name',
            label: 'name',
            fields: ['village', 'owner_type', 'condition', 'construction', 'purpose'],
            fieldTitles: ['Village', 'Owner Type', 'Condition', 'Construction', 'Purpose',],
        }
    },
    {
        title: 'Wetlands',
        description: 'Wetlands and low lying estuarine areas classified from remote sensing imagery. For methodological details, see <a href="https://vedas.sac.gov.in/static/downloads/atlas/Wetlands/NWIA_Goa_Atlas.pdf">2009 National Wetland Atlas of Goa, Space Applications Centre, ISRO / Ministry of Environment and Forests</a>.',
        headerImage: 'assets/map-layer-wetland.png',
        type: 'vector',
        id: 'wetland',
        url: 'https://indianopenmaps.fly.dev/not-so-open/wetlands/parivesh/{z}/{x}/{y}.pbf',
        sourceLayer: 'Bharatmaps_Parivesh_Wetland_Boundaries',
        maxzoom: 11,
        attribution: '<a href="https://vedas.sac.gov.in/wetlands/index.html">1:10k Wetland Polygons (2019), Space Applications Centre, ISRO</a> - Collected by <a href="https://datameet.org">Datameet Community</a>',
        style: {
            'line-color': 'blue',
            'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                14, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    4,
                    ['boolean', ['feature-state', 'hover'], false],
                    3,
                    1
                ],
                18, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    8,
                    ['boolean', ['feature-state', 'hover'], false],
                    5,
                    2
                ]
            ],
            'fill-color': [
                'match',
                ['get', 'descr'],
                'Inland - Natural - Waterlogged',
                '#0084f7',
                'Inland - Natural - River/Stream',
                '#0084f7',
                'Inland - Natural - Lake/Pond',
                '#0084f7',
                'Inland - Man-made - Tank/Pond',
                '#0084f7',
                'Inland - Man-made - Reservoir/Barrage',
                '#0084f7',
                'Inland - Man-made - Waterlogged',
                '#0084f7',
                'Coastal - Natural - Creek',
                '#0084f7',
                'Coastal - Natural - Lagoon',
                '#0084f7',
                'Inland - Natural - Ox-bow Lake / Cut-off me',
                '#0084f7',
                'Coastal - Natural - Mangrove',
                'green',
                'Coastal - Natural - Inter-tidal Mud-flat',
                'brown',
                'Coastal - Natural - Salt Marsh',
                'brown',
                'Coastal - Man-made - Salt Pan',
                'cyan',
                'Inland - Man-made - Salt Pan',
                'cyan',
                'Coastal - Man-made - Aquaculture Pond',
                'cyan',
                'Coastal - Natural - Sand/Beach',
                'orange',
                'Others (non-wetland area)',
                'grey',
                'red'  // default color for all other cases
            ],
            'fill-opacity': 0.5
        },
        // Add a filter to exclude "Others (non-wetland area)"
        filter: ['!=', ['get', 'descr'], 'Others (non-wetland area)'],
        inspect: {
            id: 'objectid',
            title: 'Wetland Name',
            label: 'wetname',
            fields: ['descr', 'aqveg', 'turbidity'],
            fieldTitles: ['Description', 'Aquatic Vegetation', 'Turbidity']
        }
    },
    {
        title: 'Private Forests',
        description: 'Private forests identified by Thomas and Arujao expert committees',
        headerImage: 'assets/map-layer-forest.png',
        type: 'geojson',
        id: 'private-forests',
        url: 'https://gist.githubusercontent.com/planemad/54b84c11fc0325889f1127e49b5740db/raw/6b4df018b298f37b1789f1c40405c8d9aee0aadd/goa_private_forest_plots.geojson',
        attribution: '<a href="https://docs.google.com/spreadsheets/d/1OHrd9c61IQ2rE_pKqPrtMgT5AY5Wepru/edit?gid=378361244#gid=378361244">Goa Private Forest Plots</a> - Collected by <a href="https://github.com/publicmap/amche-goa/issues/75">Amche.in Community</a>',
        style: {
            'line-color': '#006400',
            'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                14, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    4,
                    ['boolean', ['feature-state', 'hover'], false],
                    3,
                    1
                ],
                18, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    8,
                    ['boolean', ['feature-state', 'hover'], false],
                    5,
                    2
                ]
            ],
            'fill-color': 'green',
            'fill-opacity': 0.7
        },
        inspect: {
            id: 'id',
            title: 'Reference Number',
            label: 'id',
            fields: ['kide', 'village'],
            fieldTitles: ['Survey Number', 'Village']
        }
    },
    {
        title: 'Reserve Forests',
        description: 'Forest beat boundaries',
        headerImage: 'assets/map-layer-forest.png',
        type: 'vector',
        id: 'forests',
        url: 'https://indianopenmaps.fly.dev/not-so-open/forests/beats/fsi/{z}/{x}/{y}.pbf',
        sourceLayer: 'FSI_Beats',
        maxzoom: 11,
        attribution: '<a href="https://bharatmaps.gov.in/BharatMaps/Home/Map">Bharatmaps/Forest Survey of India</a> - Collected by <a href="https://datameet.org">Datameet Community</a>',
        style: {
            'line-color': '#006400',
            'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                14, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    4,
                    ['boolean', ['feature-state', 'hover'], false],
                    3,
                    1
                ],
                18, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    8,
                    ['boolean', ['feature-state', 'hover'], false],
                    5,
                    2
                ]
            ],
            'fill-color': 'green',
            'fill-opacity': 0.7
        },
        inspect: {
            id: 'OBJECTID_12',
            title: 'Forest Range',
            label: 'Beat_Name',
            fields: ['Range'],
        }
    },
    {
        title: 'Mining Leases',
        description: 'Major mining lease boundaries',
        headerImage: 'assets/map-layer-mines.png',
        type: 'vector',
        id: 'mining',
        url: ' https://indianopenmaps.fly.dev/not-so-open/mining/leases/major/ncog/{z}/{x}/{y}.pbf',
        sourceLayer: 'NCOG_Major_Mining_Leases',
        maxzoom: 11,
        attribution: '<a href="https://mss.ncog.gov.in/login">National Centre of Geo-Informatics(NCOG) Mining Surveillance System</a> - Collected by <a href="https://datameet.org">Datameet Community</a>',
        style: {
            'text-field': [
                "step",
                ["zoom"],
                [
                    "to-string",
                    ['get', 'mineral_na']
                ],
                12,
                ["concat",
                [
                    "to-string",
                    ['get', 'mine_name']
                ],
                '\n',
                [
                    "to-string",
                    ['get', 'mineral_na']
                ]]
                ,
                15,
                ["concat",
                'LEASEE:',
                '\n',
                [
                    "to-string",
                    ['get', 'name_of_le']
                ]
        
            ]
            ],
            'text-color': [
                'match',
                ['get', 'mineral_na'],
                'Gold',
                'black',
                'white'  // default color for all other cases
            ],
            'text-halo-color': [
                'match',
                ['get', 'mineral_na'],
                ['Iron Ore','Iron'],
                'brown',
                ['Bauxite'],
                'blue',
                ['Mangenese','Manganese','Mangnese Ore'],
                'magenta',
                ['Gold'],
                'gold',
                ['Magnesite'],
                'red',
                ['Limestone','Limeshell'],
                'green',
                'black'  // default color for all other cases
            ],
            'text-halo-width': 2,
            'text-size': 14,
            'line-color': [
                'match',
                ['get', 'mineral_na'],
                ['Iron Ore','Iron'],
                'brown',
                ['Bauxite'],
                'blue',
                ['Mangenese','Manganese','Mangnese Ore'],
                'magenta',
                ['Gold'],
                'gold',
                ['Magnesite'],
                'red',
                ['Limestone','Limeshell'],
                'green',
                'black'  // default color for all other cases
            ],
            'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                14, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    4,
                    ['boolean', ['feature-state', 'hover'], false],
                    3,
                    1
                ],
                18, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    8,
                    ['boolean', ['feature-state', 'hover'], false],
                    5,
                    2
                ]
            ],
            'fill-color': [
                'match',
                ['get', 'mineral_na'],
                ['Iron Ore','Iron'],
                'brown',
                ['Bauxite'],
                'blue',
                ['Mangenese','Manganese','Mangnese Ore'],
                'magenta',
                ['Gold'],
                'gold',
                ['Magnesite'],
                'red',
                ['Limestone','Limeshell'],
                'green',
                'black'  // default color for all other cases
            ],
            'fill-opacity': 0.4
        },
        inspect: {
            id: 'mine_code',
            title: 'Mine Name',
            label: 'mine_name',
            fields: ['mineral_na', 'name_of_le', 'reg_no', 'vil_name11', 'mine_code'],
            fieldTitles: ['Mineral Name', 'Name of Leasee', 'Registration Number', 'Village Name', 'Mine Code']
        }
    },
    {
        id: 'slope',
        title: 'Slope Zoning',
        description: 'Slope zone classification using terrain data',
        type: 'layer-group',
        headerImage: 'assets/map-layer-slope.png',
        legendImage: 'assets/map-layer-slope-legend.png',
        groups: [
            {
                id: 'nasadem-30-m',
                title: 'NASA NASADEM 30m',
                attribution: 'https://asterweb.jpl.nasa.gov/gdem.asp',
                location: 'Goa'
            },
            {
                id: 'cartodem-2-5-m',
                title: 'ISRO CartoDEM 2.5m (Bardez)',
                attribution: 'https://bhuvan-app3.nrsc.gov.in/data/',
                location: 'Guirim'
            }
        ]
    },
    {
        title: 'Construction Sites',
        description: 'Construction Project Sites',
        headerImage: 'assets/map-layer-construction.png',
        type: 'geojson',
        id: 'construction-sites',
        url: 'https://gist.githubusercontent.com/planemad/ddca6df1de5ccf1b1663a5b7ab161b93/raw/b15e2dce708ac4e1ef803cb7065527f5f9eb0f0d/goa-construction-project-sites.geojson',
        attribution: 'Construction project sites in Goa',
        style: {
            'line-color': 'red',
            'fill-color': 'red',
            'fill-color-opacity': 0.5,
            'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                14, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    4,
                    ['boolean', ['feature-state', 'hover'], false],
                    3,
                    1
                ],
                18, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    8,
                    ['boolean', ['feature-state', 'hover'], false],
                    5,
                    2
                ]
            ],
            'text-color': 'white',
            'text-halo-color': 'red',
            'text-halo-width': 2,
            'text-size': 12
        }
    },
    {
        title: 'Landuse Development Plans',
        description: 'Regional Development Plan for Goa 2021 (RDP-2021) prepared by the <a href="https://tcp.goa.gov.in/">Goa Town & Country Planning Department</a> and <a href="https://tcp.goa.gov.in/regional-plan-for-goa-2021">notified</a> as per the <a href="https://indiankanoon.org/doc/3192342/">Goa TCP Act</a>',
        headerImage: 'assets/map-layer-rdp.png',
        legendImage: 'assets/map-layer-rdp-legend.jpg',
        type: 'tms',
        id: 'rpg2021',
        url: 'https://mapwarper.net/mosaics/tile/2054/{z}/{x}/{y}.png',
        attribution: 'Regional Development Plan for Goa 2021, <a href="https://tcp.goa.gov.in/">Goa Town & Country Planning Department</a>. Georeferenced using <a href="https://mapwarper.net/layers/2054#Show_tab">Mapwarper</a>',
        initiallyChecked: true
    },
    {
        title: 'Panjim Landuse (AMRUT)',
        description: 'Landuse data for Panajim Urban Agglomeration collected for GIS based Master Plan formulation under Atal Mission for Rejuvenation and Urban Transformation (AMRUT)',
        headerImage: 'assets/map-layer-landuse-amrut.png',
        type: 'vector',
        id: 'landuse-panjim',
        url: 'https://indianopenmaps.fly.dev/not-so-open/goa/urban/land-use/amrut/{z}/{x}/{y}.pbf',
        sourceLayer: 'GA_AMRUT_ULU',
        maxzoom: 14,
        attribution: '<a href="https://www.nrsc.gov.in/readmore_AMRUT">Bhuvan/AMRUT (2015-2023)</a> - Collected by <a href="https://github.com/ramSeraph/indian_land_features/releases/tag/urban-land-use">Datameet Community</a>',
        style: {
            'text-font': ['Open Sans Regular'],
            'text-field': [
                "step",
                ["zoom"],
                "",
                15,
                [
                    "to-string",
                    ['get', 'Sub_Class']
                ]
            ],
            'text-color': [
                'match',
                ['get', 'Sub_Class'],
                ['Cropland', 'Fallow land'],
                'black',
                ['Play Ground', 'Park', 'Sports Centre', 'Stadium'],
                'black',
            'white']
                ,
            'text-halo-color': [
                'match',
                ['get', 'Sub_Class'],
                ['Ponds_filled', 'Stream_filled', 'Lake_filled', 'River_filled'],
                'lightblue',
                ['Aquaculture', 'Salt pan'],
                'cyan',
                ['Tree Clad Area', 'Scrub land', 'Swampy'],
                'green',
                ['Play Ground', 'Park', 'Sports Centre', 'Stadium'],
                'lightgreen',
                ['Major City Road', 'Parking Space / Area', 'Multi-level Parking'],
                'black',
                ['CG_Office', 'SG_Office', 'Bus stand /Terminus', 'Railway Station', 'Railway Track Area', 'Art Gallery & Cultural Centre', 'Public Library', 'Cantonment/Battalion', 'Fire Station', 'University', 'Helipad', 'School', 'Church', 'College', 'Temple', 'Community hall', 'Police Station', 'Govt. Hospital'],
                'red',
                ['General Business', 'Retail', 'Commercial & Industrial', 'Shopping Centre / Mall', 'Hotel / Lodge / Restaurant', 'Resort', 'Banks', 'Residential & Commercial', 'Residential & Health Services', 'Private Hospital'],
                'blue',
                ['Port', 'Jetty', 'Storage Godown', 'Industrial Estate / SEZ', 'Radio/TV Station', 'Quarry'],
                'purple',
                ['Cropland', 'Fallow land'],
                'yellow',
                'transparent'  // default color for all other cases
            ],
            'text-halo-width': 5,
            'text-size': 13,
            'line-color': [
                'match',
                ['get', 'Sub_Class'],
                ['Ponds_filled', 'Stream_filled', 'Lake_filled', 'River_filled'],
                'lightblue',
                ['Aquaculture', 'Salt pan'],
                'cyan',
                ['Tree Clad Area', 'Scrub land', 'Swampy'],
                'green',
                ['Play Ground', 'Park', 'Sports Centre', 'Stadium'],
                'lightgreen',
                ['Major City Road', 'Parking Space / Area', 'Multi-level Parking'],
                'black',
                ['CG_Office', 'SG_Office', 'Bus stand /Terminus', 'Railway Station', 'Railway Track Area', 'Art Gallery & Cultural Centre', 'Public Library', 'Cantonment/Battalion', 'Fire Station', 'University', 'Helipad', 'School', 'Church', 'College', 'Temple', 'Community hall', 'Police Station', 'Govt. Hospital'],
                'red',
                ['General Business', 'Retail', 'Commercial & Industrial', 'Shopping Centre / Mall', 'Hotel / Lodge / Restaurant', 'Resort', 'Banks', 'Residential & Commercial', 'Residential & Health Services', 'Private Hospital'],
                'blue',
                ['Port', 'Jetty', 'Storage Godown', 'Industrial Estate / SEZ', 'Radio/TV Station', 'Quarry'],
                'purple',
                ['Cropland', 'Fallow land'],
                'yellow',
                'orange'  // default color for all other cases
            ],
            'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                14, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    1,
                    ['boolean', ['feature-state', 'hover'], false],
                    1,
                    0.5
                ],
                18, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    2,
                    ['boolean', ['feature-state', 'hover'], false],
                    2,
                    1
                ]
            ],
            'fill-color': [
                'match',
                ['get', 'Sub_Class'],
                ['Ponds_filled', 'Stream_filled', 'Lake_filled', 'River_filled'],
                'lightblue',
                ['Aquaculture', 'Salt pan'],
                'cyan',
                ['Tree Clad Area', 'Scrub land', 'Swampy'],
                'green',
                ['Play Ground', 'Park', 'Sports Centre', 'Stadium'],
                'lightgreen',
                ['Major City Road', 'Parking Space / Area', 'Multi-level Parking'],
                'black',
                ['CG_Office', 'SG_Office', 'Bus stand /Terminus', 'Railway Station', 'Railway Track Area', 'Art Gallery & Cultural Centre', 'Public Library', 'Cantonment/Battalion', 'Fire Station', 'University', 'Helipad', 'School', 'Church', 'College', 'Temple', 'Community hall', 'Police Station', 'Govt. Hospital'],
                'red',
                ['General Business', 'Retail', 'Commercial & Industrial', 'Shopping Centre / Mall', 'Hotel / Lodge / Restaurant', 'Resort', 'Banks', 'Residential & Commercial', 'Residential & Health Services', 'Private Hospital'],
                'blue',
                ['Port', 'Jetty', 'Storage Godown', 'Industrial Estate / SEZ', 'Radio/TV Station', 'Quarry'],
                'purple',
                ['Cropland', 'Fallow land'],
                'yellow',
                'orange'  // default color for all other cases
            ],
            'fill-extrusion-height': ['get', 'No_floors'],
            'fill-extrusion-color': 'brown',
            'fill-extrusion-opacity': [
                "interpolate",
                ["linear"],
                ["zoom"],
                15,
                0,
                17,
                1,
                19,
                0.4
            ],
            'fill-opacity': 0.9
        },
        inspect: {
            id: 'Sub_Class',
            title: 'Description',
            label: 'Sub_Class',
            fields: ['Descr', 'Locality', 'Class', 'Code', 'No_floors'],
            fieldTitles: ['Name', 'Locality', 'Class', 'Code', 'Floors']
        }
    },
    {
        title: 'Landcover',
        description: 'Space based Information Support for Decentralized Planning (SISDP) Phase 2 10k Land Usage Land Cover data. Check the <a href="https://bhuvanpanchayat.nrsc.gov.in/SISDP/BP-lrdpwrdpmanual.pdf">SISDP technical manual</a> for background about the project and <a href="https://bhuvanpanchayat.nrsc.gov.in/SISDP/BP-lrdpwrdpmanual.pdf">Bhuvan Panchayat Portal User Manual</a> for more details.',
        headerImage: 'assets/map-layer-landcover.png',
        type: 'vector',
        id: 'landcover',
        url: 'https://indianopenmaps.fly.dev/not-so-open/landuse/10k/sisdpv2/bhuvan/{z}/{x}/{y}.pbf',
        sourceLayer: 'Bhuvan_SISDP_V2_LULC_10k',
        maxzoom: 13,
        attribution: '<a href="https://bhuvanpanchayat.nrsc.gov.in">Bhuvan Land Use Land Cover (10K):SIS-DP Phase2:2018-23</a> - Collected by <a href="https://github.com/ramSeraph/indian_land_features/releases/tag/landuse">Datameet Community</a>',
        style: {
            'text-font': ['Open Sans Regular'],
            'text-field': [
                "step",
                ["zoom"],
                "",
                13,
                [
                    "to-string",
                    ['get', 'dscr3']
                ]
            ],
            'text-color': [
                'match',
                ['get', 'lc_code'],
                'AGCR',
                'black',
                ['AGAQ', 'WLST'],
                'black',
                ['WBRT', 'WLWL', 'WBRS','WBLP'],
                'black',
            'white'],
            'text-halo-color': [
                'match',
                ['get', 'lc_code'],
                'AGCR',
                'yellow',
                ['BUUR', 'BURV', 'BURM', 'BUUP', 'BURU', 'BURH', 'BUUC'],
                'red',
                ['BUTP'],
                'black',
                ['BUMN'],
                'purple',
                ['WLSP', 'FRDE', 'FRMG', 'FRPL', 'AGPL', 'WLSD'],
                'green',
                ['AGAQ', 'WLST'],
                'cyan',
                ['WBRT', 'WLWL', 'WBRS','WBLP'],
                'lightblue',
                'black'  // default color for all other cases
            ],
            'text-halo-width': 5,
            'text-size': 13,
            'line-color': 'black',
            'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                11, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    1,
                    ['boolean', ['feature-state', 'hover'], false],
                    1,
                    0
                ],
                18, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    8,
                    ['boolean', ['feature-state', 'hover'], false],
                    5,
                    2
                ]
            ],
            'fill-color': [
                'match',
                ['get', 'lc_code'],
                'AGCR',
                'yellow',
                ['BUUR', 'BURV', 'BURM', 'BUUP', 'BURU', 'BURH', 'BUUC'],
                'red',
                ['BUTP'],
                'black',
                ['BUMN'],
                'purple',
                ['WLSP', 'FRDE', 'FRMG', 'FRPL', 'AGPL', 'WLSD'],
                'green',
                ['AGAQ', 'WLST'],
                'cyan',
                ['WBRT', 'WLWL', 'WBRS','WBLP'],
                'lightblue',
                'black'  // default color for all other cases
            ],
            'fill-opacity': 0.8
        },
        inspect: {
            id: 'OBJECTID',
            title: 'Description',
            label: 'dscr3',
            fields: ['dscr2', 'dscr1', 'lc_code'],
            fieldTitles: ['Type', 'Category', 'Land Cover Code']
        }
    },
    {
        title: 'Geomorphological Lineaments',
        description: 'Geomorphological lineaments based on <a href="https://bhuvan-app1.nrsc.gov.in/2dresources/thematic/gm/gm.pdf">genesis based classification schema</a>.',
        headerImage: 'assets/map-layer-lineament.png',
        type: 'vector',
        id: 'lineament',
        url: 'https://indianopenmaps.fly.dev/not-so-open/lineament/50k/bhuvan/{z}/{x}/{y}.pbf',
        sourceLayer: 'Bhuvan_Lineament_50k_0506',
        maxzoom: 8,
        attribution: '<a href="https://bhuvan-app1.nrsc.gov.in/thematic/thematic/index.php">Bhuvan</a> - Collected by <a href="https://datameet.org">Datameet Community</a>',
        style: {
            'line-color': [
                'match',
                ['get', 'Des'],
                ['Geomorphic Lineaments-Drainage Parallel', 'Geomorphic Lineaments-Drainage parallel'],
                'blue',
                'Structural Lineaments-Fault',
                'red',
                'Geomorphic Lineaments-Parallel to Shoreline',
                'brown',
                'black'],
            'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                14, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    3,
                    ['boolean', ['feature-state', 'hover'], false],
                    2.5,
                    2
                ],
                18, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    8,
                    ['boolean', ['feature-state', 'hover'], false],
                    5,
                    4
                ]
            ]
        },
        inspect: {
            id: 'LineaID',
            title: 'Description',
            label: 'Des'
        }
    },
    {
        title: 'Groundwater Prospects',
        description: 'Groundwater prospect maps prepared at 1:50k scale. Refer to the <a href="https://bhuvan-app1.nrsc.gov.in/gwis/docs/GW_Manual.pdf">methodology</a> and <a href="https://www.nrsc.gov.in/sites/default/files/pdf/ebooks/RGNationalDrinkingWater_UserManual.pdf">user manual</a> for more details. Check <a href"https://ingres.iith.ac.in/gecdataonline/gis/INDIA">INDIA-Groundwater Resource Estimation System (IN-GRES)</a> for taluk level groundwater assessment reports.',
        headerImage: 'assets/map-layer-groundwater.png',
        legendImage: 'assets/map-layer-groundwater-legend.pdf',
        type: 'vector',
        id: 'groundwater',
        url: ' https://indianopenmaps.fly.dev/not-so-open/groundwater-prospects/lgeom/bhuvan/{z}/{x}/{y}.pbf',
        sourceLayer: 'Bhuvan_Groundwater_Prospects_LGEOM',
        maxzoom: 11,
        attribution: '<a href="https://bhuvan-app1.nrsc.gov.in/gwis/">Bhuvan - Bhujal, Ministry of Drinking Water and Sanitation</a> - Collected by <a href="https://datameet.org">Datameet Community</a>',
        style: {
            'line-color': 'blue',
            'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                14, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    4,
                    ['boolean', ['feature-state', 'hover'], false],
                    3,
                    1
                ],
                18, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    8,
                    ['boolean', ['feature-state', 'hover'], false],
                    5,
                    2
                ]
            ],
            'fill-color': [
                'match',
                ['get', 'LG_4'],
                'Good', '#03045E',
                'Moderate', '#0077B6',
                'Limited', '#00B4D8',
                'grey'  // default color for all other cases
            ],
            'fill-opacity': 0.95
        },
        inspect: {
            id: 'OBJECTID',
            title: 'Hydrogeomorphic Landform',
            label: 'LG_2',
            fields: ['ALNUM_CODE', 'LG_13', 'LG_1', 'LG_3A', 'LG_3B', 'LG_4', 'LG_5A', 'LG_5B', 'LG_6A', 'LG_6B', 'LG_7A', 'LG_8A', 'LG_9', 'LG_10', 'LG_12A', 'LG_12B'],
            fieldTitles: ['Landform Code', 'Groundwater Prospects', 'Rock Type', 'Water Table Depth (summer avg.)', 'Number of Wells', 'Recharge Condition', 'Aquifier Material 1', 'Aquifier Material 2', 'Suggested Well Type 1', 'Suggested Well Type 2', 'Well Depth Range (m)', 'Expected Well Yield (m³/day)', 'Well Success Rate', 'Quality (Potable/Non-Potable)', 'Suitable Recharge Structures', 'Recharge Level']
        }
    },
    {
        title: 'Geomorphological Ecozones',
        description: 'Geomorphological landforms based on <a href="https://bhuvan-app1.nrsc.gov.in/2dresources/thematic/gm/gm.pdf">genesis based classification schema</a>.',
        headerImage: 'assets/map-layer-geomorphology.png',
        type: 'vector',
        id: 'geomorphology',
        url: 'https://indianopenmaps.fly.dev/not-so-open/geomorphology/50k/bhuvan/{z}/{x}/{y}.pbf',
        sourceLayer: 'Bhuvan_Geomorphology_50k_0506',
        maxzoom: 11,
        attribution: '<a href="https://bhuvan-app1.nrsc.gov.in/thematic/thematic/index.php">Bhuvan</a> - Collected by <a href="https://datameet.org">Datameet Community</a>',
        style: {
            'line-color': 'black',
            'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                14, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    0.5,
                    ['boolean', ['feature-state', 'hover'], false],
                    0.1,
                    0
                ],
                18, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    8,
                    ['boolean', ['feature-state', 'hover'], false],
                    5,
                    2
                ]
            ],
            'fill-color': [
                'match',
                ['get', 'Des'],
                [
                    'Structural Origin-Moderately Dissected Hills and Valleys',
                    'Structural Origin-Highly Dissected Hills and Valleys',
                    'Structural Origin-Low Dissected Hills and Valleys',
                    'Denudational Origin-Moderately Dissected Hills and Valleys',
                    'Denudational Origin-Highly Dissected Hills and Valleys',
                    'Denudational Origin-Piedmont Slope'],
                '#d7ba8c',
                [
                    'Structural Origin-Highly Dissected Lower Plateau',
                    'Structural Origin-Moderately Dissected Lower Plateau',
                    'Structural Origin-Moderately Dissected Upper Plateau',
                    'Structural Origin-Low Dissected Upper Plateau',
                    'Structural Origin-Highly Dissected Upper Plateau',
                    'Denudational Origin-Moderately Dissected Lower Plateau',
                    'Denudational Origin-Moderately Dissected Upper Plateau',
                    'Structural Origin-Low Dissected Lower Plateau',
                    'Denudational Origin-Low Dissected Lower Plateau',
                    'Denudational Origin-Low Dissected Upper Plateau',
                    'Denudational Origin-Highly Dissected Lower Plateau',
                    'Denudational Origin-Highly Dissected Upper Plateau'],
                '#f9f33d',
                ['Coastal Origin-Older Deltaic Plain',
                    'Coastal Origin-Older Coastal Plain',
                    'Denudational Origin-Pediment-PediPlain Complex',
                    'Denudational Origin-Low Dissected Hills and Valleys',
                    'Fluvial Origin-Piedmont Alluvial Plain',
                    'Fluvial Origin-Younger Alluvial Plain',
                    'Fluvial Origin-Bajada',
                    'Fluvial Origin-Older Alluvial Plain',
                    'Denudational Origin-Mass Wasting Products',
                    'Fluvial Origin-Older Flood Plain',
                    'Lacustrine Origin-Lacustrine Terrain',
                    'Aeolian Origin-Aeolian Plain'],
                '#caf1cc',
                ['Coastal Origin-Younger Coastal Plain',
                    'Fluvial Origin-Active Flood Plain',
                    'Coastal Origin-Younger Deltaic Plain',
                    'Coastal Origin-Offshore Island'

                ],
                '#81c8ff',
                ['Water Bodies-River',
                    'Water Bodies-Pond',
                    'Water Bodies-Others',
                    'Water Bodies-Lake'],
                '#0780bd',
                ['Glacial Origin-Snow Cover', 'Glacial Origin-Glacial Terrain'],
                'white',
                ['Anthropogenic Origin-Anthropogenic Terrain'],
                'rgba(0, 0, 0, 0)',
                'red'  // default color for all other cases
            ],
            'fill-opacity': 0.9
        },
        inspect: {
            id: 'test',
            title: 'Description',
            label: 'Des'
        }
    },
    {
        title: 'Goa Mask',
        description: 'Mask for the state of Goa',
        headerImage: 'assets/map-layer-mask.png',
        type: 'vector',
        id: 'mask',
        url: 'https://indianopenmaps.fly.dev/not-so-open/states/lgd/{z}/{x}/{y}.pbf',
        sourceLayer: 'LGD_States',
        maxzoom: 10,
        attribution: '<a href="https://bharatmaps.gov.in/BharatMaps/Home/Map">LGD/Bharatmaps</a> - Collected by <a href="https://datameet.org">Datameet Community</a>',
        initiallyChecked: true,
        style: {
            'fill-color': [
                'interpolate',
                ['linear'],
                ['zoom'],
                0, ['case',
                    ['==', ['get', 'STNAME'], 'GOA'],
                    'rgba(0, 0, 0, 0)',
                    'rgba(255, 255, 255, 1)'
                ],
                8, ['case',
                    ['==', ['get', 'STNAME'], 'GOA'],
                    'rgba(0, 0, 0, 0)',
                    'rgba(255, 255, 255, 1)'
                ],
                12, ['case',
                    ['==', ['get', 'STNAME'], 'GOA'],
                    'rgba(0, 0, 0, 0)',
                    'rgba(255, 255, 255, 0.1)'
                ]
            ],
            'fill-opacity': 0.7
        }
    },
    {
        title: 'SOI Toposheets',
        description: 'Survey of India',
        headerImage: 'assets/map-layer-soi.png',
        legendImage: 'assets/map-layer-soi-legend.png',
        type: 'tms',
        id: 'goa-soi-map',
        url: 'https://indianopenmaps.fly.dev/soi/osm/{z}/{x}/{y}.webp',
        attribution: '<a href="https://onlinemaps.surveyofindia.gov.in/FreeMapSpecification.aspx">Open Series Toposheets from Survey of India</a>',
    },
    {
        title: 'Coastal Zone Management Plan',
        description: 'Coastal Zone Management Plan 2019',
        headerImage: 'assets/map-layer-czmp.png',
        legendImage: 'assets/map-layer-czmp-legend.jpg',
        type: 'tms',
        id: 'goa-czmp-map',
        url: 'https://indianopenmaps.fly.dev/not-so-open/coastal/goa/regulation/ncscm/{z}/{x}/{y}.webp',
        attribution: '<a href="https://czmp.ncscm.res.in/">National Center For Sustainable Coastal Management</a> - Collected by <a href="https://datameet.org">Datameet Community</a>'
    },
    {
        title: 'AMS Maps (1970s)',
        description: '1:250000 maps from the U.S. Army Map Service created 1955-1970s',
        headerImage: 'assets/map-layer-ams.png',
        type: 'tms',
        id: 'goa-ams-map',
        url: 'https://mapwarper.net/maps/tile/89833/{z}/{x}/{y}.png',
        attribution: '<a href="https://maps.lib.utexas.edu/maps/ams/india/">Perry-Castañeda Library Map Collection, The University of Texas at Austin</a> release in public domain'
    },
    {
        id: 'osm',
        title: 'OpenStreetMap',
        description: 'OpenStreetMap Data',
        headerImage: 'assets/map-layer-osm.png',
        type: 'tms',
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        description: 'Map data contributed by the <a href="https://www.openstreetmap.in/">OpenStreetMap India Community.',
        attribution: '© OpenStreetMap contributors'
    },

    {
        title: '3D Terrain',
        description: 'Terrain Controls',
        headerImage: 'assets/map-layer-terrain.png',
        type: 'terrain',
        initiallyChecked: true
    }
];
