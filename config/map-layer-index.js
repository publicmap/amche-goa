export const layersConfig = [
    {
        id: 'mapbox-streets',
        title: 'Street Map रस्त्याचो नकासो',
        description: 'Detailed street map sourced from <a href="https://www.openstreetmap.org/#map=11/15.4054/73.9280" target="_blank">OpenStreetMap contributors</a> and other data sources via <a href="https://docs.mapbox.com/data/tilesets/reference/mapbox-streets-v8/" target="_blank">Mapbox Streets</a> vector tiles.',
        type: 'style',
        headerImage: 'assets/map-layers/map-layer-mapbox-streets.png',
        initiallyChecked: true,
        layers: [
            { title: 'Places Labels', sourceLayer: 'place_label' },
            { title: 'Natural Labels', sourceLayer: 'natural_label' },
            { title: 'Airport Labels', sourceLayer: 'airport_label' },
            { title: 'Transit Labels', sourceLayer: 'transit_stop_label' },
            { title: 'Landmark Labels', sourceLayer: 'poi_label' },
            { title: 'Buildings', sourceLayer: 'building' },
            { title: 'Structures', sourceLayer: 'structure' },
            { title: 'Roads & Railways', sourceLayer: 'road' },
            { title: 'Runways', sourceLayer: 'aeroway' },
            { title: 'Hillshading', sourceLayer: 'hillshade' },
            { title: 'Landcover', sourceLayer: 'landcover' },
            { title: 'Landuse', sourceLayer: 'landuse' },
            { title: 'Wetlands & National Parks', sourceLayer: 'landuse_overlay' },
            { title: 'Waterways', sourceLayer: 'waterway' },
            { title: 'Waterbodies', sourceLayer: 'water' },
            { title: 'Boundaries', sourceLayer: 'admin' },
        ]
    },
    {
        id: 'traffic',
        title: 'Traffic',
        description: 'Live traffic map via <a href="https://docs.mapbox.com/data/tilesets/reference/mapbox-traffic-v1/" target="_blank">Mapbox Traffic</a> vector tiles. Updated every 10 minutes.',
        type: 'style',
        headerImage: 'assets/map-layers/map-layer-traffic.png',
        layers: [
            { title: 'Traffic', sourceLayer: 'traffic' },
        ]
    },
    {
        title: 'Motorable Roads',
        description: 'Road network data from the OpenStreetMap project. See <a href="https://wiki.openstreetmap.org/wiki/India/Tags/Highway">OpenStreetMap India Wiki</a> for details.',
        headerImage: 'assets/map-layers/map-layer-osm-roads.png',
        type: 'vector',
        id: 'osm-roads',
        url: 'https://vector.openstreetmap.org/shortbread_v1/{z}/{x}/{y}.mvt',
        sourceLayer: 'streets',
        maxzoom: 15,
        attribution: '<a href="https://www.openstreetmap.org/#map=16/15.49493/73.82864">© OpenStreetMap contributors</a> via <a href="https://shortbread-tiles.org/schema/1.0/">Shortbread vector tiles</a>',
        filter:     [
            "match",
            ["get", "kind"],
            ['pedestrian', 'footway', 'path', 'track','rail'],
            false,
            true
          ],
        style: {
            'line-opacity': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                0.95,
                ['boolean', ['feature-state', 'hover'], false],
                0.6,
                0.5
            ],
            'line-color': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                'yellow',
                ['boolean', ['feature-state', 'hover'], false],
                'yellow',
                [
                    'match',
                    ['get', 'kind'],
                    ['motorway','trunk'],
                    'black',
                    ['primary','secondary','tertiary'],
                    'darkred',
                    ['residential','living_street','unclassified','service'],
                    'brown',
                    ['pedestrian','footway','path','track'],
                    'red',
                    'black'
                ]
            ],
            'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                11, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    5,
                    ['boolean', ['feature-state', 'hover'], false],
                    5,
                    [
                        'match',
                        ['get', 'kind'],
                        ['motorway'],
                        5,
                        ['trunk'],
                        3,
                        ['primary'],
                        3,
                        ['secondary'],
                        3,
                        ['tertiary'],
                        2,
                        ['residential','unclassified',],
                        1.5,
                        1
                    ]
                ]
            ],
        },
        inspect: {
            id: 'kind',
            title: 'OSM Type',
            label: 'kind',
            fields: ['surface'],
            fieldTitles: ['Surface']
        }
    },
    {
        title: 'Community Pins',
        description: 'Pin your notes on the map for the rest of the community to see',
        headerImage: 'assets/map-layers/map-layer-pins.png',
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
        headerImage: 'assets/map-layers/map-layer-community-maps.png',
        type: 'tms',
        id: 'community-maps',
        url: 'https://mapwarper.net/mosaics/tile/2157/{z}/{x}/{y}.png',
        attribution: '<a href="https://mapwarper.net/layers/2157">CC-BY-SA Mapwarper community maps of Goa</a>'
    },
    {
        title: 'Live Fire Trucks',
        description: 'Live locations of fire trucks from the Directorate of Fire Emergency Services. Location updated every 5 minutes from <a href="https://github.com/publicmap/goa-fire-trucks-geojson/">Goa Fire Trucks API</a>.',
        headerImage: 'assets/map-layers/map-layer-fire-trucks.png',
        type: 'geojson',
        id: 'firetrucks',
        url: 'https://raw.githubusercontent.com/publicmap/goa-fire-trucks-geojson/refs/heads/main/data/goa-fire-trucks.geojson',
        refresh: 30000, // Update every 30 seconds
        attribution: '<a href="https://dfes.goa.gov.in/dashboard/">Directorate of Fire & Emergency Services, Govt. of Goa</a>',
        style: {
            'circle-radius': 6,
            'circle-color': [
                'match',
                ['get', 'Status'],
                'RUNNING', 'green',
                'IDLE', 'yellow',
                'STOP', 'red',
                'INACTIVE', 'grey',
                'black'  // default color for all other cases
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
            'text-font': ['Open Sans Regular'],
            'text-field': [
                "step",
                ["zoom"],
                "",
                7,
                [
                    "to-string",
                    ['get', 'POI']
                ]
            ],
        },
        inspect: {
            id: 'Vehicle_No',
            title: 'Current Location',
            label: 'Location',
            fields: ['Status', 'Vehicle_No', 'Branch', 'POI', 'Speed', 'Datetime'],
            fieldTitles: ['Status', 'Vehicle No', 'Station', 'Location', 'Speed', 'Last Updated']
        }
    },
    {
        title: 'Schools',
        description: 'Schools locations by capacity',
        headerImage: 'assets/map-layers/map-layer-schools.png',
        type: 'csv',
        id: 'schools',
        url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQAjIaxmEf4dv9eGjASL9YSlVGJLsmvfggZpGApiUP4YD6uexFG4otpwy0wQAWUFW4De4Pz4QKy79yV/pub?gid=1786282296&single=true&output=csv',
        cache: 'data/dfes/goa-schools.csv',
        attribution: '<a href="https://docs.google.com/spreadsheets/d/11jYu-XsKEDH65W9Q_zy8_pKyYYlyzsdh8FwS7kd-CEM/edit?usp=sharing">Disaster Management Resources and Contacts/Schools, Directorate of Fire & Emergency Services, Govt. of Goa</a>',
        style: {
            'circle-radius': [
                'case',
                ['>', ['get', 'Capacity'], 500], 5,
                ['>', ['get', 'Capacity'], 100], 3,
                2
            ],
            'circle-color': '#4c7fff',
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff'
        },
        inspect: {
            id: 'Name',
            title: 'School',
            label: 'Name',
            fields: ['Principal', 'Mobile', 'Email', 'Capacity', 'Gr_Panchayat', 'Gr_Taluka'],
            fieldTitles: ['Principal', 'Mobile', 'Email', 'Capacity', 'Panchayat', 'Taluka']
        }
    },
    {
        id: 'pincode',
        title: 'Pincode Boundaries',
        headerImage: 'assets/map-layers/map-layer-pincode.png',
        description: 'Government open data of pincode boundaries published May 2025.',
        type: 'vector',
        url: 'https://indianopenmaps.fly.dev/pincodes/datagovin/{z}/{x}/{y}.pbf',
        sourceLayer: 'Datagov_Pincode_Boundaries',
        maxzoom: 10,
        attribution: '<a href="https://www.data.gov.in/resource/delivery-post-office-pincode-boundary">Ministry of Communications Department of Posts</a> - Collected by <a href="https://github.com/ramSeraph/indian_admin_boundaries/releases/tag/postal">Datameet Community</a>',
        style: {
            'text-field': [
                "step",
                ["zoom"],
                [
                    "to-string",
                    ['get', 'Pincode']
                ],
                10,
                ["concat",
                    [
                        "to-string",
                        ['get', 'Office_Name']
                    ],
                    '\n',
                    [
                        "to-string",
                        ['get', 'Pincode']
                    ]

                ]
            ],
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
                    .5
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
            title: 'Pincode',
            label: 'Pincode',
            id: 'Pincode',
            fields: ['Office_Name', 'Division', 'Region', 'Circle'],
            fieldTitles: ['Post Office Name', 'Division', 'Region', 'Circle']
        }
    },
    {
        title: 'Plots with No Development Slopes',
        description: 'Survey numbers with No Development Slopes (NDS). The output location of plots having atleast 25% of the plot area with NDS or slopes greater than 1:4 (25% slope).<br>Processed using slope computed with NASADEM 30m data and cadastral boundaries from OneMapGoa GIS. See <a href="https://github.com/publicmap/amche-goa/tree/main/data/slope">processing code</a> for details.',
        headerImage: 'assets/map-layers/map-layer-nds-plots.png',
        legendImage: 'assets/map-layers/map-layer-slope-legend.png',
        type: 'geojson',
        id: 'steep-plots',
        url: 'https://gist.githubusercontent.com/planemad/f378d37b120b0ffc93db27d9541baa70/raw/56ecc74a6fdd3ea8170ee58a4cd2a87ba4f83f3d/goa-steep-plots.geojson',
        attribution: '<a href="https://gist.github.com/planemad/f378d37b120b0ffc93db27d9541baa70">CC-BY Plots with No Development Slopes by amche.in community</a>',
        style: {
            'text-font': ['Open Sans Bold'],
            'text-field': [
                "step",
                ["zoom"],
                "",
                14,
                [
                    "to-string",
                    ['get', 'plot']
                ]
            ],
            'text-color': 'white',
            'text-halo-color': [
                'case',
                ['>', ['get', 'slope_35_inf_pct'], 30], 'purple',
                ['>', ['get', 'slope_25_35_pct'], 30], 'red',
                'orange'
            ],
            'text-halo-width': 2,
            'text-halo-blur': 0,
            'text-size': 13,
            'circle-color': [
                'case',
                ['>', ['get', 'slope_35_inf_pct'], 30], 'purple',
                ['>', ['get', 'slope_25_35_pct'], 30], 'red',
                'orange'
            ],
            'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                9, [
                    'interpolate',
                    ['linear'],
                    ['get', 'steep_slope_area'],
                    0, 0,
                    1000, 0.1,
                    10000, 1,
                    1000000, 10
                ],
                14, [
                    'interpolate',
                    ['linear'],
                    ['get', 'steep_slope_area'],
                    0, 0,
                    10000, 3,
                    100000, 6,
                    1000000, 30
                ]
            ],
            'circle-opacity': 0.2,
            'circle-stroke-width': [
                'interpolate',
                ['linear'],
                ['get', 'steep_slope_pct'],
                25, 1,
                70, 2,
                100, 4
            ],
            'circle-stroke-color': [
                'case',
                ['>', ['get', 'slope_35_inf_pct'], 30], 'purple',
                ['>', ['get', 'slope_25_35_pct'], 30], 'red',
                'orange'
            ]
        },
        inspect: {
            id: 'plot',
            title: '% plot area with NDS',
            label: 'steep_slope_pct',
            fields: ['slope_10_20_pct', 'slope_20_25_pct', 'slope_25_35_pct', 'slope_35_inf_pct', 'steep_slope_area', 'total_area_m2', 'plot', 'village'],
            fieldTitles: ['RDS-1 % (10-20% slope)', 'RDS-2 % (20-25% slope)', 'NDS-1 % (25-35% slope)', 'NDS-2 % (35%+ slope)', 'NDS Area (m2)', 'Total Area (m2)', 'Plot', 'Village']
        }
    },
    {
        title: 'Cadastral Plot Boundaries',
        description: 'Cadastral Boundaries from the <a href="Directorate of Settlement & Land Records">Department of Land Records</a>. The map is provided for information purpose only. An official copy can be obtained from <a href="https://goaonline.gov.in" target="_blank" rel="noopener noreferrer">Goa Online</a>',
        headerImage: 'assets/map-layers/map-layer-survey.png',
        type: 'vector',
        id: 'plot',
        url: 'https://indianopenmaps.fly.dev/not-so-open/cadastrals/goa/onemapgoagis/{z}/{x}/{y}.pbf',
        sourceLayer: 'Onemapgoa_GA_Cadastrals',
        maxzoom: 15,
        attribution: '<a href="https://onemapgoagis.goa.gov.in/map/?l=gp_police_station_a9c73118_2035_466c_9f5d_8888580816a0%21%2Cdma_garbage_treatment_plant_fc46bf4b_245c_4856_be7b_568b46a117c4%21%2Cdma_mrf_faciltiy_polygon_93c1ae1a_ea42_46c5_bbec_ed589e08d8c0%21%2Cdma_bio_methanation_plant_polygon_bdeb7c4d_17ec_4d9f_9e4a_3bf702905e1a%21%2Cdma_weighing_bridge_54e8be7c_e105_4098_a5fa_fb939eeba75e%21%2Cdma_mrf_faciltiy_95b4b5a3_a2ce_481b_9711_7f049ca1e244%21%2Cdma_incinerator_2d57ae07_9b3e_4168_ac8b_7f2187d5681a%21%2Cdma_ccp_biodigester_84960e2a_0ddf_465a_9bca_9bb35c4abcb4%21%2Cdma_bio_methanation_plant__f0edd163_cf6b_4084_9122_893ebc83d4fe%21%2Cdma_waste_management_sities_fa8b2c94_d4cd_4533_9c7e_8cf0d3b30b87%21%2Cdgm_leases_f7677297_2e19_4d40_850f_0835388ecf18%21%2Cdgm_lease_names_fdb18573_adc9_4a60_9f1e_6c22c04d7871%21%2Cgdms_landslide_vulnerable_ced97822_2753_4958_9edc_7f221a6b52c9%21%2Cgdm_flooding_areas_1be469a8_af9d_46cf_953e_49256db7fe1d%21%2Cgsidc_sewerage_line_bddff132_f998_4be1_be43_b0fb71520499%21%2Cgsidc_sewerage_manhole_0654846e_5144_4d1f_977e_58d9c2c9a724%21%2Cged_division_boundary_04fe437b_405f_45fa_8357_02f0d564bdd4%21%2Cged_substation_4c686ea3_95a6_43e8_b136_e338a3a47e79%21%2Cged_rmu_2f2632f4_6ced_4eae_8ff8_6c2254697f13%21%2Cged_lv_wire_ca1f9541_7be0_4230_a760_a3b66507fc06%21%2Cged_lv_cable_9b8d0330_64e5_4bbf_bdb5_4927b39b2ef2%21%2Cged_hv_wire_a60bb861_6972_4f27_86a4_21492b59ede2%21%2Cged_hv_cable_54dae74c_08af_44f0_af49_ec3b5fcab581%21%2Cged_ehv_wire_68331f46_1c8f_4f85_99b0_151656c3b0c8%21%2Cged_ehv_cable_04580bfe_0d1c_4422_bec6_4093984ffa6d%21%2Cged_transformer_a967dbae_dbc2_487f_9fff_14865a65d8d6%21%2Cged_solar_generation_bbeed839_8737_421d_b5bc_277357dcd727%21%2Cged_towers_3c2b9c53_8aa0_4538_b969_731b66b98189%21%2Cged_protective_equipment_fa242976_c97c_4006_aeb1_8c32669f3477%21%2Cged_pole_240bac2f_8d3b_4989_bc0b_b34d9d78e018%21%2Cged_govt_connection__b89e0eff_2812_425e_aa29_4039e1489126%21%2Cged_cabinet_e3e83e28_cff8_4acc_855e_5572b21a8302%21%2Cgbbn_24F_150a4ba3_5e6e_4490_87cd_9a67a51f9a95%21%2Cgbbn_6F_7d67c332_14a0_433b_9036_d3edb7acfe1f%21%2Cgbbn_48F_87fa8495_0a7b_4a37_9154_5d749eb826e6%21%2Cgbbn_vgp_ce657914_2bc0_437a_b558_d614529d0d70%21%2Cgbbn_vgp1_da280706_4a39_4581_98f6_76a4a8258ee2%21%2Cgbbn_olt_afb08f2e_83de_4493_a04a_4eeee53cdabb%21%2Cgwrd_reservoirs_806646ae_e1d3_4b00_9afb_0659fea342cf%21%2Cgwrd_jackwell_casarwali_ad327886_70e4_4b98_bf5e_41da1e9240d0%21%2Cgwrd_pump_house_49ad2817_feb7_4bd4_beaa_2b8908823881%21%2Cgwrd_pumping_sub_station_219578a4_9fba_4c21_bfdf_6793c0e2ec9e%21%2Cgwrd_floodplains_0178162a_bedc_4875_bc74_c2eeba2a040b%21%2Cgwrd_floodembankments_6de30dc4_675b_4ef9_b204_cf2352c1fe9b%21%2Cgpwd_waterline_ffe24b0d_7e83_43e7_8d7f_e5bd2a0d49da%21%2Cgwrd_pipeline_82478411_6595_487b_b524_abb8931946a6%21%2Cgwrd_canal_c36fddaf_564b_43c5_ba74_86e46ca22995%21%2Cgwrd_end_of_pipeline_5518b446_8ff1_4d17_a28f_344dfa3e7901%21%2Cgwrd_tapping_point_401aac7c_77a1_47e2_8470_71a4880294a7%21%2Cgwrd_rain_guages___flood_monitors_ae6547a5_6eca_4932_a1c8_f80c8e04551b%21%2Cgsa_goa_sports_complex_3e450e4c_9a69_4cf7_94ac_2c9082e5388a%21%2Cgie_verna_industrial_estate_81926f17_e182_42a7_9614_0160bf19fa34%21%2Cgie_quittol_industrial_estate_5d5aadba_071c_432d_b424_6c3644c29338%21%2Cgie_latambarcem_industrail_estate_919dd4d4_d8ae_44cc_aff0_bd27fbe1e0a3%21%2Cgcsca_fps_godowns_a3b498e8_fda8_4249_b17b_8c0acbb444d7%21%2Cgcsca_fps_shops_debfb1ee_0fb9_4cfe_95a7_8d9880d22deb%21%2Cgargi_seed_farm_519a1d9c_7a62_4906_a44c_7f7a6d8744b4%21%2Cdfg_ramps_8fb28e3c_4344_409b_9e47_b19c1b8c5fe0%21%2Cdfg_jetty_6a70f09c_fc73_4c48_be61_c35b9f2a7094%21%2Cdfg_fish_landing_centers_b5f571c3_5a64_4ae9_8413_289a912e2f37%21%2Cdfg_aqua_culture_005788c0_d630_42c1_a61f_178234cc61f4%21%2Cdah_cattle_feed_factory_d4f517d5_db91_493c_8b8c_d3cb1062d369%21%2Cdah_egg_production_ff7dac52_5c84_4f17_96eb_2621f7ed01c4%21%2Cdah_veterinary_centres_b9b0b3ac_35e7_4973_a175_f515fbc0efd5%21%2Cdah_sumul_dairy_a0d775d5_8048_4858_869b_3083b34c0bcf%21%2Cdah_production_cattle_244945b5_f092_4644_a585_1601ce097c6c%21%2Cdah_milk_production_70534439_ebaa_4c88_bbb9_f44cae179078%21%2Cdah_milk_processing_unit_8d3ff9f8_387c_4d52_b5a5_ad0ab020fc10%21%2Cdah_farms_e208fb45_f1d4_4489_ae7b_753fc32d4b07%21%2Cgagri_landform_1b36389a_a5c2_4307_8515_beb0e49ceef6%21%2Cdslr_goa_villages_c9939cd5_f3c8_4e94_8125_38adb10e6f45%2Cdaa_asi_sites_9b100a72_f84f_4114_b81f_42f5e46334b1%21%2Ctdc_gurudwara_e1ff2fde_1fbd_41aa_b1af_0f844ebdbee8%21%2Ctdc_mosque_05493477_4f6f_4973_8edc_ae8d6e1dc2ef%21%2Ctdc_church_ca9f3144_cca2_402a_bb7c_85126a42a69b%21%2Ctdc_temple_33d6e141_2ae9_4a43_909a_f252ef6f27d6%21%2Cgfd_range_ac0c898d_b912_43e5_8641_cc8d558b96c2%21%2Cgfd_wls_29b8d326_2d60_4bde_b743_6a239516c86c%21%2Cgfd_eco_sensitive_zone_451208a2_46f8_45aa_ba54_a5e5278aa824%21%2Cdhs_institute_63eb16bc_7d5c_4804_b7c3_99b9481eae1d%21%2Cdhs_hospital_c90b25e4_f64d_49f5_8696_410dfe8b18bd%21%2Cdhs_uhc_882ec1f1_633e_4411_b223_c0fe874575b2%21%2Cdhs_phc_771cb209_c40a_4786_ab15_122f5b8caf7f%21%2Cdhs_chc_43f53098_e034_404f_a7c4_bbc949038e5a%21%2Cdhs_ayurvedic___homeopathic_dispensaries_339b4c62_c1a7_4b6b_b8c6_272ec8a7e46a%21%2Cdhs_hsc_0e3ffe3f_21f5_4201_8596_d6b37a1d8f10%21%2Cdot_bus_stop_9a5e21ba_b562_45bc_a372_dfe71301af16%21%2Cgkr_railway_line_943f6fe0_5c1d_461e_bf1f_e914b2991191%21%2Cdot_rto_checkpost__af7f50e9_7412_4658_a40a_5d88d303d3ab%21%2Cdot_traffic_signal_b29280ac_53eb_4207_b713_5d965dd36f5c%21%2Cdot_depot_c46b1f5c_d838_4bab_bac3_6f9eb54bd7e5%21%2Cgkr_railway_station_eeffd0d6_ac46_4f69_a6b3_952cf2687ea2%21%2Cktc_bus_stops_1272f729_fbe6_49fb_9873_5d2d6fb2f99d%21%2Cgdte_schools_a53455c4_c969_4bc6_af70_e0403df19623%21%2Cdtw_ashram_school_8e3e826e_8cc5_4ebb_b7b6_e159a591143d%21%2Cgdte_iti_college_5c51844a_d03d_4745_9a27_dfc44351d160%21%2Cgdte_government_institute_976db146_84af_4c70_80cf_625726d858bf%21%2Cgdte_college_26d0511b_5a9d_4c94_983a_4d99d24ee293%21%2Cgoa_villages_f7a04d50_013c_4d33_b3f0_45e1cd5ed8fc%21%2Cgoa_taluka_boundary_9e52e7ed_a0ef_4390_b5dc_64ab281214f5%21%2Cgoa_district_boundary_81d4650d_4cdd_42c3_bd42_03a4a958b5dd%21%2Cgoa_boundary_ae71ccc6_6c5c_423a_b4fb_42f925d7ddc0%21&bl=mmi&t=goa_default&c=8217465%2C1742894&s=10000">OneMapGoa GIS</a> - Collected by <a href="https://datameet.org">Datameet Community</a>',
        style: {
            'text-font': ['Open Sans Bold'],
            'text-field': [
                "step",
                ["zoom"],
                "",
                15,
                [
                    "to-string",
                    ['get', 'plot']
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
                    1,
                    0
                ],
                18, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    6,
                    ['boolean', ['feature-state', 'hover'], false],
                    5,
                    1
                ]
            ]
        },
        initiallyChecked: false,
        inspect: {
            id: 'id',
            title: 'Survey Number',
            label: 'plot',
            fields: ['villagenam', 'talname'],
            fieldTitles: ['Village', 'Taluk'],
            customHtml: '<a href="https://bhunaksha.goa.gov.in/bhunaksha/" target="_blank">View in Bhunaksha Goa</a> | <a href="https://goaonline.gov.in/Appln/Uil/DeptServices?__DocId=REV&__ServiceId=REV31" target="_blank">View RoR</a>'
        }
    },
    {
        id: 'village',
        title: 'Village Boundaries',
        headerImage: 'assets/map-layers/map-layer-village.png',
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
        headerImage: 'assets/map-layers/map-layer-ulb-wards.png',
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
                    .5
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
        headerImage: 'assets/map-layers/map-layer-local-boundaries.png',
        type: 'vector',
        id: 'local-body',
        url: 'mapbox://planemad.2bqa1pq1',
        sourceLayer: 'goa-local-body-boundaries',
        maxzoom: 10,
        attribution: '<a href="https://onemapgoagis.goa.gov.in/map/?c=0%2C0&s=0">OneMapGoa</a> - Collected by <a href="https://datameet.org">Datameet Community</a>',
        initiallyChecked: true,
        style: {
            'text-field': [
                "step",
                ["zoom"],
                "",
                13,
                [
                    "to-string",
                    ['get', 'Name']
                ]
            ],
            'text-color': 'white',
            'text-halo-color': 'purple',
            'text-halo-width': 5,
            'text-transform': 'uppercase',
            'text-size': 14,
            'text-opacity': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                1,
                ['boolean', ['feature-state', 'hover'], false],
                0.9,
                0.7
            ],
            'fill-color': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                'rgba(0, 0, 0, 0)',
                ['boolean', ['feature-state', 'hover'], false],
                'rgba(0, 0, 0, 0.05)',
                'rgba(118, 118, 118, 0.4)'
            ],
            'fill-opacity': 1,
            'line-color': 'purple',
            'line-dasharray': [6, 6],
            'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                11, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    1.5,
                    ['boolean', ['feature-state', 'hover'], false],
                    1,
                    0
                ],
                14, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    4,
                    ['boolean', ['feature-state', 'hover'], false],
                    3,
                    1
                ]
            ],
        },
        inspect: {
            title: 'Local Body Name',
            label: 'Name',
            id: 'fid',
            fields: ['Village Names', 'Ward Count', 'Subdistrict Name', 'District Name', 'Code'],
            fieldTitles: ['Villages', 'Ward Count', 'Sub District', 'District', 'LGD Code']
        }
    },
    {
        title: 'Assembly Constituencies',
        description: 'Members of Legislative Assembly (MLA) constituencies.',
        headerImage: 'assets/map-layers/map-layer-assembly-boundaries.png',
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
        headerImage: 'assets/map-layers/map-layer-parliament-boundaries.png',
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
        headerImage: 'assets/map-layers/map-layer-rivers.png',
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
        headerImage: 'assets/map-layers/map-layer-watersheds.png',
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
        headerImage: 'assets/map-layers/map-layer-micro-watersheds.png',
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
        headerImage: 'assets/map-layers/map-layer-water-bodies.png',
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
        headerImage: 'assets/map-layers/map-layer-wetland.png',
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
        headerImage: 'assets/map-layers/map-layer-forest.png',
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
        description: 'Forest areas notified and protectedunder the <a href="http://nbaindia.org/uploaded/Biodiversityindia/Legal/3.%20Indian%20forest%20act.pdf">Indian Forest Act, 1927</a>',
        headerImage: 'assets/map-layers/map-layer-forest.png',
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
        title: 'Eco Sensitive Zones',
        description: 'Eco Sensitive Zones as defined in the <a href="https://moef.gov.in/eco-sensitive-zone-esz">National Environment Policy, MoEF</a>',
        headerImage: 'assets/map-layers/map-layer-esz.png',
        type: 'vector',
        id: 'esz',
        url: 'https://indianopenmaps.fly.dev/not-so-open/forests/esz/parivesh/{z}/{x}/{y}.pbf',
        sourceLayer: 'Bharatmaps_Parivesh_Eco_Sensitive_Zones',
        maxzoom: 9,
        attribution: '<a href="https://bharatmaps.gov.in/BharatMaps/Home/Map">Bharatmaps/Parivesh</a> - Collected by <a href="https://datameet.org">Datameet Community</a>',
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
            'fill-opacity': 0.2
        },
        inspect: {
            id: 'FID',
            title: 'ESZ Name',
            label: 'Name',
            fields: ['Zone_Type', 'Map_Name', 'Set_No', 'Page_No', 'Remark'],
        }
    },
    {
        title: 'Wildlife Reserves and Corridors',
        description: 'National parks, wildlife sanctuaries and <a href="https://ntca.gov.in/assets/map-layers/uploads/Reports/corridor/connecting_tiger_populations.pdf">tiger conservations corridors</a>',
        headerImage: 'assets/map-layers/map-layer-wildlife-reserve.png',
        type: 'vector',
        id: 'wildlife-reserve',
        url: 'https://indianopenmaps.fly.dev/not-so-open/forests/wildlife/reserves-and-corridors/parivesh/{z}/{x}/{y}.pbf ',
        sourceLayer: 'Bharatmaps_Parivesh_Wildlife_Reserves_and_Corridors',
        maxzoom: 10,
        attribution: '<a href="https://bharatmaps.gov.in/BharatMaps/Home/Map">Bharatmaps/Parivesh</a> - Collected by <a href="https://datameet.org">Datameet Community</a>',
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
            id: 'objectid',
            title: 'ESZ Name',
            label: 'name',
            fields: ['type'],
        }
    },
    {
        title: 'Mining Leases',
        description: 'Major mining lease boundaries',
        headerImage: 'assets/map-layers/map-layer-mines.png',
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
                ['Iron Ore', 'Iron'],
                'brown',
                ['Bauxite'],
                'blue',
                ['Mangenese', 'Manganese', 'Mangnese Ore'],
                'magenta',
                ['Gold'],
                'gold',
                ['Magnesite'],
                'red',
                ['Limestone', 'Limeshell'],
                'green',
                'black'  // default color for all other cases
            ],
            'text-halo-width': 2,
            'text-size': 14,
            'line-color': [
                'match',
                ['get', 'mineral_na'],
                ['Iron Ore', 'Iron'],
                'brown',
                ['Bauxite'],
                'blue',
                ['Mangenese', 'Manganese', 'Mangnese Ore'],
                'magenta',
                ['Gold'],
                'gold',
                ['Magnesite'],
                'red',
                ['Limestone', 'Limeshell'],
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
                ['Iron Ore', 'Iron'],
                'brown',
                ['Bauxite'],
                'blue',
                ['Mangenese', 'Manganese', 'Mangnese Ore'],
                'magenta',
                ['Gold'],
                'gold',
                ['Magnesite'],
                'red',
                ['Limestone', 'Limeshell'],
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
        description: 'Slope zone classification using <a href="https://asterweb.jpl.nasa.gov/gdem.asp">NASA NASADEM 30m</a> for entire Goa and <a href="https://bhuvan-app3.nrsc.gov.in/data/">ISRO CartoDEM 2.5m (Bardez)</a> terrain data for Bardez taluka.<br>The output is a 30x30m grid indicating the minimum gradient within that cell. Details of the algorithm are in the <a href="https://github.com/publicmap/amche-goa/blob/main/data/slope/dem_slope_processor.py">slope processor script</a>.',
        type: 'layer-group',
        headerImage: 'assets/map-layers/map-layer-slope.png',
        legendImage: 'assets/map-layers/map-layer-slope-legend.png',
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
        headerImage: 'assets/map-layers/map-layer-construction.png',
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
        title: 'Current Landuse Map (Panjim)',
        description: 'Current Land-Use data for Panaji Urban Agglomeration collected in 2020-2023 under <a http://164.100.87.10/DocumentOMs.aspx">Atal Mission for Rejuvenation and Urban Transformation (AMRUT)</a> at 1:4000 scale.',
        headerImage: 'assets/map-layers/map-layer-landuse-amrut.png',
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
                ['Port', 'Jetty', 'Storage Godown', 'Industrial Estate / SEZ', 'Manufacturing', 'Radio/TV Station', 'Quarry'],
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
                ['Port', 'Jetty', 'Storage Godown', 'Industrial Estate / SEZ', 'Manufacturing', 'Radio/TV Station', 'Quarry'],
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
                ['Port', 'Jetty', 'Storage Godown', 'Industrial Estate / SEZ', 'Manufacturing', 'Radio/TV Station', 'Quarry'],
                'purple',
                ['Cropland', 'Fallow land'],
                'lightgreen',
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
        title: 'OSM Landuse Sites',
        description: 'High resolution landuse polygons for institutional sites and amenities from the OpenStreetMap project.',
        headerImage: 'assets/map-layers/map-layer-osm-landuse.png',
        type: 'vector',
        id: 'osm-sites',
        url: 'https://vector.openstreetmap.org/shortbread_v1/{z}/{x}/{y}.mvt',
        sourceLayer: 'sites',
        maxzoom: 15,
        attribution: '<a href="https://www.openstreetmap.org/#map=16/15.49493/73.82864">© OpenStreetMap contributors</a> via <a href="https://shortbread-tiles.org/schema/1.0/">Shortbread OSMF vector tiles</a>',
        style: {
            'text-font': ['Open Sans Regular'],
            'text-field': [
                "step",
                ["zoom"],
                "",
                14,
                [
                    "to-string",
                    ['get', 'kind']
                ]
            ],
            'text-color': [
                'match',
                ['get', 'kind'],
                ['sports_centre'],
                'black',
                'white'
            ]
            ,
            'text-halo-color': [
                'match',
                ['get', 'kind'],
                ['parking','bicycle_parking'],
                'red',
                ['construction'],
                'brown',
                ['school','college','university','hospital','prison'],
                'red',
                'grey'
            ],
            'text-halo-width': 5,
            'text-size': 13,
            'fill-color': [
                'match',
                ['get', 'kind'],
                ['parking','bicycle_parking'],
                'red',
                ['construction'],
                'brown',
                ['school','college','university','hospital','prison'],
                'red',
                'grey'
            ],
            'fill-opacity': 0.7,
            'line-color': 'black',
            'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                11, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    1.5,
                    ['boolean', ['feature-state', 'hover'], false],
                    0.5,
                    0
                ],
                14, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    2,
                    ['boolean', ['feature-state', 'hover'], false],
                    1,
                    0
                ]
            ],
        },
        inspect: {
            id: 'kind',
            title: 'OSM Type',
            label: 'kind'
        }
    },
    {
        title: 'OSM Landuse',
        description: 'High resolution landuse polygons from the OpenStreetMap project.',
        headerImage: 'assets/map-layers/map-layer-osm-landuse.png',
        type: 'vector',
        id: 'osm-landuse',
        url: 'https://vector.openstreetmap.org/shortbread_v1/{z}/{x}/{y}.mvt',
        sourceLayer: 'land',
        maxzoom: 17,
        attribution: '<a href="https://www.openstreetmap.org/#map=16/15.49493/73.82864">© OpenStreetMap contributors</a> via <a href="https://shortbread-tiles.org/schema/1.0/">Shortbread OSMF vector tiles</a>',
        style: {
            'text-font': ['Open Sans Regular'],
            'text-field': [
                "step",
                ["zoom"],
                "",
                14,
                [
                    "to-string",
                    ['get', 'kind']
                ]
            ],
            'text-color': [
                'match',
                ['get', 'kind'],
                ['farmland','allotments'],
                'black',
                ['recreation_ground','park','playground','garden','golf_course','village_green'],
                'black',
                ['beach'],
                'black',
                'white']
            ,
            'text-halo-color': [
                'match',
                ['get', 'kind'],
                ['landfill','quarry','brownfield'],
                'brown',
                ['railway'],
                'maroon',
                ['industrial'],
                'purple',
                ['commercial'],
                'blue',
                ['retail'],
                'navy',
                ['residential'],
                'orange',
                ['farmland','allotments'],
                'lightgreen',
                ['recreation_ground','park','playground','garden','golf_course','village_green'],
                'lime',
                ['cemetery'],
                'teal',
                ['orchard','scrub','grassland','grass','meadow'],
                'green',
                ['forest'],
                'darkgreen',
                ['swamp'],
                'seagreen',
                ['marsh','wet_meadow'],
                'lightblue',
                ['beach'],
                'gold',
                'grey'
            ],
            'text-halo-width': 5,
            'text-size': 13,
            'fill-color': [
                'match',
                ['get', 'kind'],
                ['landfill','quarry','brownfield'],
                'brown',
                ['railway'],
                'maroon',
                ['industrial'],
                'purple',
                ['commercial'],
                'blue',
                ['retail'],
                'navy',
                ['residential'],
                'orange',
                ['farmland','allotments'],
                'lightgreen',
                ['recreation_ground','park','playground','garden','golf_course','village_green'],
                'lime',
                ['cemetery'],
                'teal',
                ['orchard','scrub','grassland','grass','meadow'],
                'green',
                ['forest'],
                'darkgreen',
                ['swamp'],
                'seagreen',
                ['marsh','wet_meadow'],
                'lightblue',
                ['beach'],
                'gold',
                'grey'
            ],
            'fill-opacity': 0.7,
            'line-color': 'black',
            'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                11, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    1.5,
                    ['boolean', ['feature-state', 'hover'], false],
                    0.5,
                    0
                ],
                14, [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                    2,
                    ['boolean', ['feature-state', 'hover'], false],
                    1,
                    0
                ]
            ],
        },
        inspect: {
            id: 'kind',
            title: 'OSM Type',
            label: 'kind'
        }
    },
    {
        title: 'Landcover',
        description: 'Space based Information Support for Decentralized Planning (SISDP) Phase 2 10k Land Usage Land Cover data. Check the <a href="https://bhuvanpanchayat.nrsc.gov.in/SISDP/BP-lrdpwrdpmanual.pdf">SISDP technical manual</a> for background about the project and <a href="https://bhuvanpanchayat.nrsc.gov.in/SISDP/BP-lrdpwrdpmanual.pdf">Bhuvan Panchayat Portal User Manual</a> for more details.',
        headerImage: 'assets/map-layers/map-layer-landcover.png',
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
                ['WBRT', 'WLWL', 'WBRS', 'WBLP', 'WLSA'],
                'black',
                'white'],
            'text-halo-color': [
                'match',
                ['get', 'lc_code'],
                'AGCR',
                'lightgreen',
                ['BUUR', 'BURV', 'BURM', 'BUUP', 'BURU', 'BURH', 'BUUC'],
                'orange',
                ['BUTP'],
                'red',
                ['BUMN'],
                'purple',
                ['WLSP','AGPL', 'WLSD','FRPL'],
                'green',
                ['FRDE'],
                'darkgreen',
                ['AGAQ', 'WLST'],
                'cyan',
                ['FRMG'],
                'seagreen',
                ['WBRT', 'WLWL', 'WBRS', 'WBLP'],
                'lightblue',
                ['WLSA'],
                'gold',
                ['WLBR'],
                'grey',
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
                    0.1
                ]
            ],
            'fill-color': [
                'match',
                ['get', 'lc_code'],
                'AGCR',
                'lightgreen',
                ['BUUR', 'BURV', 'BURM', 'BUUP', 'BURU', 'BURH', 'BUUC'],
                'orange',
                ['BUTP'],
                'red',
                ['BUMN'],
                'purple',
                ['WLSP','AGPL', 'WLSD','FRPL'],
                'green',
                ['FRDE'],
                'darkgreen',
                ['FRMG'],
                'seagreen',
                ['AGAQ', 'WLST'],
                'cyan',
                ['WBRT', 'WLWL', 'WBRS', 'WBLP'],
                'lightblue',
                ['WLSA'],
                'gold',
                ['WLBR','WLGU'],
                'grey',
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
        headerImage: 'assets/map-layers/map-layer-lineament.png',
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
        description: 'Groundwater prospect maps prepared at 1:50k scale. Refer to the <a href="https://bhuvan-app1.nrsc.gov.in/gwis/docs/GW_Manual.pdf">methodology</a> and <a href="https://www.nrsc.gov.in/sites/default/files/pdf/ebooks/RGNationalDrinkingWater_UserManual.pdf">user manual</a> for more details. Check <a href"https://ingres.iith.ac.in/gecdataonline/gis/INDIA">INDIA-Groundwater Resource Estimation System (IN-GRES)</a> for taluk level groundwater assessment reports.<br>View  <a href="https://www.cgwb.gov.in/old_website/GW-Assessment/GWR-2022-Reports%20State/Goa.pdf">Dynamic Groundwater Report of Goa State 2022</a> | <a href="https://www.cgwb.gov.in/cgwbpnm/public/uploads/documents/1705640315968744698file.pdf">2024</a>.',
        headerImage: 'assets/map-layers/map-layer-groundwater.png',
        legendImage: 'assets/map-layers/map-layer-groundwater-legend.pdf',
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
        headerImage: 'assets/map-layers/map-layer-geomorphology.png',
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
        headerImage: 'assets/map-layers/map-layer-mask.png',
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
        headerImage: 'assets/map-layers/map-layer-soi.png',
        legendImage: 'assets/map-layers/map-layer-soi-legend.png',
        type: 'tms',
        id: 'goa-soi-map',
        url: 'https://indianopenmaps.fly.dev/soi/osm/{z}/{x}/{y}.webp',
        attribution: '<a href="https://onlinemaps.surveyofindia.gov.in/FreeMapSpecification.aspx">Open Series Toposheets from Survey of India</a>',
    },
    {
        title: 'Landuse Development Plans',
        description: 'Regional Development Plan for Goa 2021 (RDP-2021) prepared by the <a href="https://tcp.goa.gov.in/">Goa Town & Country Planning Department</a> and <a href="https://tcp.goa.gov.in/regional-plan-for-goa-2021">notified</a> as per the <a href="https://indiankanoon.org/doc/3192342/">Goa TCP Act</a>',
        headerImage: 'assets/map-layers/map-layer-rdp.png',
        legendImage: 'assets/map-layers/map-layer-rdp-legend.jpg',
        type: 'tms',
        id: 'regional-plan',
        url: 'https://mapwarper.net/mosaics/tile/2054/{z}/{x}/{y}.png',
        attribution: 'Regional Development Plan for Goa 2021, <a href="https://tcp.goa.gov.in/">Goa Town & Country Planning Department</a>. Georeferenced using <a href="https://mapwarper.net/layers/2054#Show_tab">Mapwarper</a>',
        initiallyChecked: true
    },
    {
        title: 'Coastal Zone Management Plan',
        description: 'Coastal Zone Management Plan 2019',
        headerImage: 'assets/map-layers/map-layer-czmp.png',
        legendImage: 'assets/map-layers/map-layer-czmp-legend.jpg',
        type: 'tms',
        id: 'goa-czmp-map',
        url: 'https://indianopenmaps.fly.dev/not-so-open/coastal/goa/regulation/ncscm/{z}/{x}/{y}.webp',
        attribution: '<a href="https://czmp.ncscm.res.in/">National Center For Sustainable Coastal Management</a> - Collected by <a href="https://datameet.org">Datameet Community</a>'
    },
    {
        title: 'AMS Maps (1970s)',
        description: '1:250000 maps from the U.S. Army Map Service created 1955-1970s',
        headerImage: 'assets/map-layers/map-layer-ams.png',
        type: 'tms',
        id: 'goa-ams-map',
        url: 'https://mapwarper.net/maps/tile/89833/{z}/{x}/{y}.png',
        attribution: '<a href="https://maps.lib.utexas.edu/maps/ams/india/">Perry-Castañeda Library Map Collection, The University of Texas at Austin</a> released in public domain'
    },
    {
        title: 'Goa Admiralty Chart (1914)',
        description: 'Nautical chart of the West Coast of India from Achra River to Cape Ramas. Surveyed by Lieut. A.D. Taylor 1853-4 for Eat India Company. Not current - not to be used for navigation!',
        headerImage: 'assets/map-layers/map-layer-1914-admiralty-chart.png',
        type: 'tms',
        id: '1914-admiralty-chart',
        url: 'https://warper.wmflabs.org/maps/tile/4749/{z}/{x}/{y}.png',
        attribution: '<a href="https://commons.wikimedia.org/wiki/File:Admiralty_Chart_No_740_West_Coast_of_India,_Published_1858,_New_Edition_1914.jpg">Wikimedia Commons: Admiralty Chart No 740 West Coast of India, Published 1858, New Edition 1914</a> via <a href="https://warper.wmflabs.org/maps/4749">Wikimaps Warper</a> released in public domain'
    },
    {
        title: 'Atlas of India (1827-1906)',
        description: 'Historical atlas of India published in 1827-1906 by Survey of India',
        headerImage: 'assets/map-layers/map-layer-1906-india-atlas.png',
        type: 'tms',
        id: '1906-india-atlas',
        url: 'https://warper.wmflabs.org/mosaics/tile/15/{z}/{x}/{y}.png',
        attribution: '<a href="https://commons.wikimedia.org/wiki/Category:Atlas_of_India_(1827-1906)">Wikimedia Commons: Atlas of India (1827-1906)</a> via <a href="https://warper.wmflabs.org/mosaics/15#Show_tab">Wikimaps Warper</a> released in public domain'
    },
    {
        title: 'Geological Map of India (1855)',
        description: 'General sketch of the physical and geological features of British India. Compiled by Greenough, George Bellas (1778-1855)',
        headerImage: 'assets/map-layers/map-layer-1855-geology.png',
        type: 'tms',
        id: '1855-geology',
        url: 'https://warper.wmflabs.org/maps/tile/2258/{z}/{x}/{y}.png',
        attribution: '<a href=https://commons.wikimedia.org/wiki/File:Greenough_Geology_India_1855.jpg">Wikimedia Commons: Greenough Geology India 1855</a> via <a href="https://warper.wmflabs.org/maps/2258">Wikimaps Warper</a> released in public domain'
    },
    {
        title: 'Lambtons Peninsular Survey  (1802-1814)',
        description: 'Historical trignometrical survey plans by Colnel William Lambton of the Peninsula of India',
        headerImage: 'assets/map-layers/map-layer-1814-lambton-survey.png',
        type: 'tms',
        id: '1814-lambton-survey',
        url: 'https://warper.wmflabs.org/mosaics/tile/13/{z}/{x}/{y}.png',
        attribution: '<a href="https://commons.wikimedia.org/wiki/Category:Lambton%27s_peninsular_survey">Wikimedia Commons: Lambtons peninsular survey</a> via <a href="https://warper.wmflabs.org/mosaics/13#Show_tab">Wikimaps Warper</a> released in public domain'
    },
    {
        title: 'Robert Wilkinsons General Atlas  (1792)',
        description: 'Engraved by Thomas Conder and issued as plate no. 37 in the 1792 edition of Robert Wilkinsons General Atlas',
        headerImage: 'assets/map-layers/map-layer-1792-general-atlas.png',
        type: 'tms',
        id: '1792-general-atlas',
        url: 'https://warper.wmflabs.org/maps/tile/7050/{z}/{x}/{y}.png',
        attribution: '<a href="https://commons.wikimedia.org/wiki/File:Southern_India_Wilkinson.png">Wikimedia Commons: 1792 General Atlas/Southern India </a> via <a href="https://warper.wmflabs.org/mosaics/13#Show_tab">Wikimaps Warper</a> released in public domain'
    },
    {
        title: 'Goa Harbour Admiralty Chart (1775)',
        description: 'Nautical chart of the West Coast of India from Achra River to Cape Ramas. Surveyed by Lieut. A.D. Taylor 1853-4 for Eat India Company. Not current - not to be used for navigation!',
        headerImage: 'assets/map-layers/map-layer-1775-admiralty-chart.png',
        type: 'tms',
        id: '1775-admiralty-chart',
        url: 'https://warper.wmflabs.org/maps/tile/8717/{z}/{x}/{y}.png',
        attribution: '<a href="https://commons.wikimedia.org/wiki/File:Admiralty_Chart_No_793_Goa_Harbour,_with_a_View,_Published_1775.jpg">Wikimedia Commons: Admiralty Chart No 793 Goa Harbour, with a View, Published 1775</a> via <a href="https://warper.wmflabs.org/maps/8717#Show_tab">Wikimaps Warper</a> released in public domain'
    },
    {
        id: 'osm',
        title: 'OpenStreetMap',
        description: 'OpenStreetMap Data',
        headerImage: 'assets/map-layers/map-layer-osm.png',
        type: 'tms',
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        description: 'Map data contributed by the <a href="https://www.openstreetmap.in/">OpenStreetMap India Community.</a>',
        attribution: '<a href="https://www.openstreetmap.org/#map=16/15.49493/73.82864">© OpenStreetMap contributors</a>'
    },
    {
        title: 'Public Transport',
        id: 'bus',
        description: 'Bus route network operated by Kadamba Transport Corporation Limited (KTCL) in Goa as on January 2025.Bus route lines are scaled by trip count.',
        headerImage: 'assets/map-layers/map-layer-bus.png',
        type: 'img',
        url: 'https://upload.wikimedia.org/wikipedia/commons/4/43/Goa_Bus_Network_Map_2025.png',
        bbox: [73.657, 14.863, 74.362, 15.861],
        attribution: '<a href="https://commons.wikimedia.org/wiki/File:Goa_Bus_Network_Map_2025.png">CC-BY Wikipedia/user:Planemad</a>, CC-by <a href="https://ktclgoa.com/gtfs/">Kadamba Transport Corporation Limited GTFS updated Jan 2025</a>'
    },
    {
        title: '3D Terrain',
        description: 'Terrain Controls',
        headerImage: 'assets/map-layers/map-layer-terrain.png',
        type: 'terrain',
        initiallyChecked: true
    }
    
];