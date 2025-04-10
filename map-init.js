import { layersConfig } from './layer-config.js';
import { MapLayerControl } from './map-layer-controls.js';

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

// Add attribution control
map.addControl(new mapboxgl.AttributionControl({
    compact: true
}), 'bottom-right');

// Initialize search box
const script = document.getElementById('search-js');
script.onload = function () {
    const searchBox = document.querySelector('mapbox-search-box');
    
    searchBox.options = {
        language: 'en',
        country: 'IN',
        types: 'place,locality,postcode,region,district,street,address,poi',
        proximity: {
            lng: 73.87916,
            lat: 15.26032
        },
        bbox: [73.5, 14.8, 74.2, 15.8] // Bounding box for Goa
    };
    
    searchBox.addEventListener('input', (e) => {
        if (e.target !== e.currentTarget) return;
        
        // Update proximity with input map location
        const center = map.getCenter();
        searchBox.options.proximity = {
            lng: center.lng,
            lat: center.lat
        };
    });
    
    // Set up mapbox integration
    searchBox.mapboxgl = mapboxgl;
    searchBox.marker = true;
    searchBox.bindMap(map);
};

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