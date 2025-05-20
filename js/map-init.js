import { MapLayerControl } from './map-layer-controls.js';

// Function to get URL parameters
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Function to load configuration
async function loadConfiguration() {
    // Check if there's a custom config URL in the URL parameters
    const configUrl = getUrlParameter('config');
    
    // Choose the config source - either from URL parameter or the default JSON file
    const configSource = configUrl || '/config/map-layer-index.json';
    
    try {
        const response = await fetch(configSource);
        if (!response.ok) {
            console.error(`Failed to load configuration from ${configSource}: ${response.statusText}`);
            return [];
        }
        const data = await response.json();
        return data.layersConfig || data;
    } catch (error) {
        console.error(`Error loading configuration from ${configSource}:`, error);
        return [];
    }
}

// Initialize the map
mapboxgl.accessToken = 'pk.eyJ1Ijoib3NtaW5kaWEiLCJhIjoiY202czRpbWdpMDNyZjJwczJqZXdkMGR1eSJ9.eQQf--msfqtZIamJN-KKVQ';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/planemad/cm3gyibd3004x01qz08rohcsg',
    center: [73.9414, 15.4121],
    zoom: 9.99,
    hash: true,
    attributionControl: false
});

// Make map accessible globally for debugging
window.map = map;

// Add attribution control
map.addControl(new mapboxgl.AttributionControl({
    compact: true
}), 'bottom-right');

// Initialize search box
function initializeSearch() {
    map.on('style.load', () => {
        const searchBox = document.querySelector('mapbox-search-box');
        if (!searchBox) return;

        // Set up mapbox integration
        searchBox.mapboxgl = mapboxgl;
        searchBox.marker = true;
        searchBox.bindMap(map);

        // Handle result selection
        searchBox.addEventListener('retrieve', function(e) {
            if (e.detail && e.detail.features && e.detail.features.length > 0) {
                const feature = e.detail.features[0];
                const coordinates = feature.geometry.coordinates;
                
                map.flyTo({
                    center: coordinates,
                    zoom: 16,
                    essential: true
                });
            }
        });
    });
}

// Initialize the map with the configuration
async function initializeMap() {
    const layersConfig = await loadConfiguration();

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
        const layerControl = new MapLayerControl(layersConfig);
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
                map.flyTo({
                    center: [73.8274, 15.4406],
                    zoom: 9,
                    pitch: 28,
                    bearing: 0,
                    duration: 3000,
                    essential: true,
                    curve: 1.42,
                    speed: 0.6
                });
            }, 2000);
        }
    });
}

// Start initialization
window.addEventListener('load', () => {
    initializeSearch();
    initializeMap();
}); 