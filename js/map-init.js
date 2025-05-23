import { MapLayerControl } from './map-layer-controls.js';

// Function to get URL parameters
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Function to load configuration
async function loadConfiguration() {
    // Check if a specific config is requested via URL parameter
    const configParam = getUrlParameter('config');
    let configPath = 'config/index.json';
    let config;
    
    // If a config parameter is provided, determine how to handle it
    if (configParam) {
        // Check if the config parameter is a JSON string
        if (configParam.startsWith('{') && configParam.endsWith('}')) {
            try {
                config = JSON.parse(configParam); // Parse JSON directly
            } catch (error) {
                console.error('Failed to parse config JSON from URL parameter:', error);
                throw new Error('Invalid JSON in config parameter');
            }
        }
        // Check if the config parameter is a URL
        else if (configParam.startsWith('http://') || configParam.startsWith('https://')) {
            configPath = configParam; // Use the URL directly
        } else {
            configPath = `config/${configParam}.json`; // Treat as local file
        }
    }
    
    // Load the configuration file (only if we didn't parse JSON directly)
    if (!config) {
        const configResponse = await fetch(configPath);
        config = await configResponse.json();
    }

    // Load defaults
    try {
        const configDefaultsResponse = await fetch('config/_defaults.json');
        const configDefaults = await configDefaultsResponse.json();
        
        // Merge defaults with anyoverrides in config
        config.defaults = config.defaults ? 
            deepMerge(configDefaults, config.defaults) : 
            configDefaults;
    } catch (error) {
        console.warn('Default configuration values not found or invalid:', error);
    }

    // Try to load the map layer library
    try {
        const libraryResponse = await fetch('config/_map-layer-presets.json');
        const layerLibrary = await libraryResponse.json();
        
        // Process each layer in the config and merge with library definitions
        if (config.layers && Array.isArray(config.layers)) {
            config.layers = config.layers.map(layerConfig => {
                // If the layer only has an id (or minimal properties), look it up in the library
                if (layerConfig.id && !layerConfig.type) {
                    // Find the matching layer in the library
                    const libraryLayer = layerLibrary.layers.find(lib => lib.id === layerConfig.id);
                    
                    if (libraryLayer) {
                        // Merge the library layer with any custom overrides from config
                        return { ...libraryLayer, ...layerConfig };
                    }
                }
                // If no match found or it's a fully defined layer, return as is
                return layerConfig;
            });
        }
    } catch (error) {
        console.warn('Map layer library not found or invalid, using only config file:', error);
    }
    
    return config;
}

// Helper function to deep merge objects
function deepMerge(target, source) {
    const output = Object.assign({}, target);
    
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    
    return output;
}

function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

// Initialize the map
mapboxgl.accessToken = 'pk.eyJ1Ijoib3NtaW5kaWEiLCJhIjoiY202czRpbWdpMDNyZjJwczJqZXdkMGR1eSJ9.eQQf--msfqtZIamJN-KKVQ';

// Default map options
const defaultMapOptions = {
    container: 'map',
    style: 'mapbox://styles/planemad/cm3gyibd3004x01qz08rohcsg',
    center: [73.9414, 15.4121],
    zoom: 9.99,
    hash: true,
    attributionControl: false
};

// Initialize the map with the configuration
async function initializeMap() {
    const config = await loadConfiguration();
    const layers = config.layers || [];
    
    // Apply map settings from config if available
    const mapOptions = { ...defaultMapOptions };
    if (config.map) {
        // Apply all properties from config.map to mapOptions
        Object.assign(mapOptions, config.map);
    }
    
    const map = new mapboxgl.Map(mapOptions);

    // Make map accessible globally for debugging
    window.map = map;

    // Add attribution control
    map.addControl(new mapboxgl.AttributionControl({
        compact: true
    }), 'bottom-right');

    // Add 3D terrain on map load
    map.on('load', () => {
        // Only add terrain if not already in style
        const style = map.getStyle();
        const hasTerrain = style.sources && style.sources['mapbox-dem'];
        
        if (!hasTerrain) {
            map.addSource('mapbox-dem', {
                'type': 'raster-dem',
                'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
                'tileSize': 512,
                'maxzoom': 14
            });
            
            map.setTerrain({
                'source': 'mapbox-dem',
                'exaggeration': 1.5
            });
        }
        
        // Initialize geolocation
        new GeolocationManager(map);
        
        // Add view control
        map.addControl(new ViewControl(), 'top-right');
        
        // Initialize layer control
        const layerControl = new MapLayerControl(layers);
        const container = document.getElementById('layer-controls-container');
        
        // Hide loader and show controls
        document.getElementById('layer-controls-loader').classList.add('hidden');
        container.classList.remove('hidden');
        
        // Initialize layer control
        layerControl.renderToContainer(container, map);
        
        // Add navigation controls
        map.addControl(new mapboxgl.NavigationControl({
            showCompass: true,
            showZoom: true
        }));
        
        // Only set camera position if there's no hash in URL
        if (!window.location.hash) {
            setTimeout(() => {
                // Use config center and zoom if available, otherwise fallback to hardcoded values
                const flyToOptions = {
                    center: config.map?.center || [73.8274, 15.4406],
                    zoom: config.map?.zoom || 9,
                    pitch: 28,
                    bearing: 0,
                    duration: 3000,
                    essential: true,
                    curve: 1.42,
                    speed: 0.6
                };
                map.flyTo(flyToOptions);
            }, 2000);
        }
    });
}

// Start initialization
window.addEventListener('load', () => {
    // Only call initializeMap() - don't call initializeSearch() directly
    initializeMap().then(() => {
        // Now window.map exists, so we can initialize search
        initializeSearch();
    });
});

// Initialize search box
function initializeSearch() {
    // Note: We now need to use the global map variable
    const searchSetup = () => {
        const searchBox = document.querySelector('mapbox-search-box');
        if (!searchBox) return;

        // Set up mapbox integration
        searchBox.mapboxgl = mapboxgl;
        searchBox.marker = true;
        searchBox.bindMap(window.map);

        // Handle result selection
        searchBox.addEventListener('retrieve', function(e) {
            if (e.detail && e.detail.features && e.detail.features.length > 0) {
                const feature = e.detail.features[0];
                const coordinates = feature.geometry.coordinates;
                
                window.map.flyTo({
                    center: coordinates,
                    zoom: 16,
                    essential: true
                });
            }
        });
    };

    // Wait for style to load before setting up search
    if (window.map) {
        window.map.on('style.load', searchSetup);
    } else {
        // If map isn't available yet, set up a listener to check when it becomes available
        const checkMapInterval = setInterval(() => {
            if (window.map) {
                clearInterval(checkMapInterval);
                window.map.on('style.load', searchSetup);
            }
        }, 100);
    }
} 