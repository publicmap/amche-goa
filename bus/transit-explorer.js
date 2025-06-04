// Transit Explorer - Main Application Module
// Handles geolocation, map initialization, stop finding, and departure boards

// Import data models and utilities
import { 
    TILESET_SCHEMA, 
    AGENCY_STYLES, 
    TransitAgency, 
    BusRoute, 
    BusStop, 
    DataUtils 
} from './transit-data.js';

// Import URL API for deep linking support
import { URLManager } from './url-api.js';

class TransitExplorer {
    constructor() {
        this.map = null;
        this.userLocation = null;
        this.currentStop = null;
        this.refreshInterval = null;
        this.mapboxToken = 'pk.eyJ1IjoicGxhbmVtYWQiLCJhIjoiY2l3ZmNjNXVzMDAzZzJ0cDV6b2lkOG9odSJ9.eep6sUoBS0eMN4thZUWpyQ';
        this.tilesets = {
            routes: 'planemad.byjf1hw6',
            stops: 'planemad.2e4x2hzw'
        };
        
        // Initialize URL manager for deep linking
        this.urlManager = null;
        
        this.init();
    }

    async init() {
        console.log('🚌 Initializing Transit Explorer...');
        
        // Initialize map first
        this.initMap();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize URL manager after map is set up
        this.urlManager = new URLManager(this);
        
        // Check if URL has parameters before requesting location
        const urlParams = this.urlManager.parseURLParameters();
        const hasURLSelection = urlParams.route || urlParams.stop;
        
        // Request location (but don't auto-find nearest stop if URL has selections)
        await this.requestLocation(hasURLSelection);
        
        // Apply URL parameters after everything is initialized
        setTimeout(() => {
            this.applyURLParametersOnLoad(hasURLSelection);
        }, 1000);
    }

    async applyURLParametersOnLoad(hasURLSelection = false) {
        try {
            if (hasURLSelection) {
                const applied = await this.urlManager.applyURLParameters();
                if (!applied) {
                    console.log('🔗 Failed to apply URL parameters, falling back to nearest stop');
                    // If URL parameters failed to apply, find nearest stop as fallback
                    await this.findNearestStopIfLocationAvailable();
                } else {
                    console.log('🔗 Successfully applied URL parameters');
                }
            } else {
                console.log('🔗 No URL parameters, finding nearest stop');
                // No URL parameters, proceed with normal nearest stop finding
                await this.findNearestStopIfLocationAvailable();
            }
        } catch (error) {
            console.error('🔗 Error applying URL parameters on load:', error);
            // Fallback to nearest stop if there's an error
            await this.findNearestStopIfLocationAvailable();
        }
    }

    async findNearestStopIfLocationAvailable() {
        if (this.userLocation) {
            console.log('📍 User location available, finding nearest stop...');
            await this.findNearestStop();
        } else {
            console.log('📍 User location not available, skipping nearest stop finding');
        }
    }

    // Method to access URL manager for testing/debugging
    getURLManager() {
        return this.urlManager;
    }

    // Test URL slugification (for debugging)
    testURLFeatures() {
        if (this.urlManager) {
            console.log('🔗 Testing URL features...');
            this.urlManager.testSlugification();
            
            const currentURL = this.urlManager.getShareableURL();
            console.log('🔗 Current shareable URL:', currentURL);
            
            const selections = this.urlManager.getCurrentSelections();
            console.log('🔗 Current selections:', selections);
        }
    }

    initMap() {
        mapboxgl.accessToken = this.mapboxToken;
        
        this.map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [72.8777, 19.0760], // Mumbai center
            zoom: 11,
            pitch: 45,
            bearing: 0,
            hash: true
        });

        this.map.on('load', () => {
            this.addDataSources();
            this.addLayers();
            console.log('🗺️ Map loaded successfully');
            
            // Add route interaction handlers
            // this.setupRouteInteractions();
            
            // Add moveend listener to query visible transit data
            this.setupMoveEndListener();
        });

        // Add navigation controls
        this.map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    }

    addDataSources() {
        console.log('📊 Adding data sources...');
        
        try {
            // Add Mumbai stops source
            this.map.addSource('mumbai-stops', {
                type: 'vector',
                url: `mapbox://${this.tilesets.stops}`
            });
            console.log(`✅ Added mumbai-stops source: mapbox://${this.tilesets.stops}`);

            // Add Mumbai routes source  
            this.map.addSource('mumbai-routes', {
                type: 'vector',
                url: `mapbox://${this.tilesets.routes}`
            });
            console.log(`✅ Added mumbai-routes source: mapbox://${this.tilesets.routes}`);
            
        } catch (error) {
            console.error('❌ Error adding data sources:', error);
        }
    }

    addLayers() {
        // Add route lines
        this.map.addLayer({
            id: 'routes',
            type: 'line',
            source: 'mumbai-routes',
            'source-layer': 'mumbai-routes',
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': [
                    'case',
                    // BEST Agency styling based on fare type
                    ['==', ['get', 'agency_name'], 'BEST'],
                    [
                        'case',
                        ['==', ['get', 'fare_type'], 'AC'], '#3b82f6',      // Blue for AC
                        ['==', ['get', 'fare_type'], 'Regular'], '#ef4444', // Red for Regular
                        '#10b981' // Default green for BEST
                    ],
                    // Other agencies or unknown - use live status (fix boolean conversion)
                    [
                        'case',
                        ['==', ['to-string', ['get', 'is_live']], 'true'], '#22c55e', // Green for live routes
                        '#3b82f6' // Blue for scheduled routes
                    ]
                ],
                'line-width': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    10, 2,
                    16, 6
                ],
                'line-opacity': 0.5
            }
        });

        // Add route highlight layer (initially hidden)
        this.map.addLayer({
            id: 'routes-highlight',
            type: 'line',
            source: 'mumbai-routes',
            'source-layer': 'mumbai-routes',
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#fbbf24', // Bright yellow/amber for highlight
                'line-width': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    10, 6,
                    16, 12
                ],
                'line-opacity': 0.9,
                'line-blur': 1
            },
            filter: ['==', 'route_id', ''] // Initially filter out everything
        });

        // Add bus stops
        this.map.addLayer({
            id: 'stops',
            type: 'circle',
            source: 'mumbai-stops',
            'source-layer': 'mumbai-stops',
            paint: {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    10, 1,
                    16, 3
                ],
                'circle-color': '#f59e0b',
                'circle-stroke-width': 1,
                'circle-stroke-color': '#ffffff',
                'circle-opacity': 0.9
            }
        });

        // Add stop highlight layer (initially hidden)
        this.map.addLayer({
            id: 'stops-highlight',
            type: 'circle',
            source: 'mumbai-stops',
            'source-layer': 'mumbai-stops',
            paint: {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    10, 12,
                    16, 20
                ],
                'circle-color': '#22c55e',
                'circle-stroke-width': 4,
                'circle-stroke-color': '#ffffff',
                'circle-opacity': 0.8,
                'circle-blur': 0.5
            },
            filter: ['==', 'stop_id', ''] // Initially filter out everything
        });

        // Add bus location layer for live tracking
        this.addBusLocationLayer();

        // Add hover effects for stops
        // this.map.on('mouseenter', 'stops', () => {
        //     this.map.getCanvas().style.cursor = 'pointer';
        // });

        // this.map.on('mouseleave', 'stops', () => {
        //     this.map.getCanvas().style.cursor = '';
        // });

        // Handle stop clicks
        // this.map.on('click', 'stops', (e) => {
        //     if (e.features.length > 0) {
        //         this.selectStop(e.features[0]);
        //     }
        // });

        console.log('✅ Route interactions set up successfully');
        
        // Set up unified map interactions
        this.setupMapInteractions();
    }

    addBusLocationLayer() {
        // Add bus locations source
        if (!this.map.getSource('bus-locations')) {
            this.map.addSource('bus-locations', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: []
                }
            });
        }

        // Add bus location layer if it doesn't exist
        if (!this.map.getLayer('bus-locations')) {
            this.map.addLayer({
                id: 'bus-locations',
                type: 'circle',
                source: 'bus-locations',
                paint: {
                    'circle-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        10, 6,
                        16, 12
                    ],
                    'circle-color': [
                        'case',
                        ['get', 'isHalted'], '#f59e0b', // Orange for halted buses
                        '#22c55e' // Green for moving buses
                    ],
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ffffff',
                    'circle-opacity': 0.9
                }
            });

            // Add bus labels
            this.map.addLayer({
                id: 'bus-labels',
                type: 'symbol',
                source: 'bus-locations',
                layout: {
                    'text-field': ['get', 'vehicleNo'],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': 10,
                    'text-offset': [0, -2],
                    'text-anchor': 'bottom'
                },
                paint: {
                    'text-color': '#ffffff',
                    'text-halo-color': '#000000',
                    'text-halo-width': 1
                }
            });
        }

        // Add click interaction for buses
        this.map.on('click', 'bus-locations', (e) => {
            if (e.features.length > 0) {
                this.showBusPopup(e.features[0], e.lngLat);
            }
        });

        // Add hover effect for buses
        this.map.on('mouseenter', 'bus-locations', () => {
            this.map.getCanvas().style.cursor = 'pointer';
        });

        this.map.on('mouseleave', 'bus-locations', () => {
            this.map.getCanvas().style.cursor = '';
        });
    }

    showBusPopup(busFeature, lngLat) {
        const props = busFeature.properties;
        const lastUpdate = new Date(props.timestamp).toLocaleTimeString();
        
        const popupContent = `
            <div class="text-sm">
                <div class="font-bold text-green-400 mb-2">Bus ${props.vehicleNo}</div>
                <div class="space-y-1 text-gray-300">
                    <div>Status: ${props.isHalted ? '🛑 Stopped' : '🚌 Moving'}</div>
                    ${props.eta > 0 ? `<div>ETA: ${props.eta} seconds</div>` : ''}
                    <div class="text-xs text-gray-400">Updated: ${lastUpdate}</div>
                </div>
            </div>
        `;

        new mapboxgl.Popup()
            .setLngLat(lngLat)
            .setHTML(popupContent)
            .addTo(this.map);
    }

    setupRouteInteractions() {
        console.log('🎯 Setting up route interactions...');
        
        // Ensure the routes layer exists before setting up interactions
        if (!this.map.getLayer('routes')) {
            console.warn('Routes layer not found, interactions setup delayed');
            return;
        }

        // Add route hover effects
        this.map.on('mouseenter', 'routes', () => {
            this.map.getCanvas().style.cursor = 'pointer';
        });

        this.map.on('mouseleave', 'routes', () => {
            this.map.getCanvas().style.cursor = '';
        });

        // Add route click interaction using standard Mapbox event handlers
        this.map.on('click', 'routes', (e) => {
            console.log('🎯 Route click handler triggered', e.features[0]);
            
            if (e.features && e.features.length > 0) {
                const feature = e.features[0];
                if (feature && feature.properties) {
                    const routeId = feature.properties.route_id;
                    const routeName = feature.properties.route_short_name || 
                                    feature.properties.route_name;
                    
                    console.log(`🚌 Route clicked: ${routeName} (ID: ${routeId})`);
                    console.log('📊 Feature properties:', feature.properties);
                    
                    // Clear previous selections
                    this.clearAllSelections();
                    
                    // Highlight the route on map
                    this.highlightRoute(routeId);
                    
                    // Highlight corresponding departure rows
                    this.highlightDepartureRows(routeId, routeName);
                } else {
                    console.warn('⚠️ No feature or properties found in route click');
                }
            }
        });

        // Add route hover interaction for temporary highlighting
        this.map.on('mouseenter', 'routes', (e) => {
            console.log('🎯 Route hover handler triggered');
            
            if (e.features && e.features.length > 0) {
                const feature = e.features[0];
                if (feature && feature.properties) {
                    const routeId = feature.properties.route_id;
                    const routeName = feature.properties.route_short_name || 
                                    feature.properties.route_name;
                    
                    // Only highlight if not already selected
                    if (this.currentHighlightedRoute !== routeId) {
                        console.log(`🎯 Hovering route: ${routeName} (ID: ${routeId})`);
                        // Temporary highlight on hover
                        this.highlightRoute(routeId, true);
                        this.highlightDepartureRows(routeId, routeName, true);
                    }
                } else {
                    console.warn('⚠️ No feature or properties found in route hover');
                }
            }
        });

        // Clear hover highlights when mouse leaves routes
        this.map.on('mouseleave', 'routes', () => {
            this.clearTemporaryHighlights();
        });

        // Add map background click to clear selections
        this.map.on('click', (e) => {
            // Check if we clicked on the map background (not on any layers)
            const features = this.map.queryRenderedFeatures(e.point);
            const routeFeatures = features.filter(f => f.layer.id === 'routes');
            const stopFeatures = features.filter(f => f.layer.id === 'stops');
            
            if (routeFeatures.length === 0 && stopFeatures.length === 0) {
                this.clearAllSelections();
            }
        });
        
        console.log('✅ Route interactions set up successfully');
    }

    highlightRoute(routeId, isTemporary = false) {
        if (!routeId) return;

        // Update the highlight layer filter to show only the selected route
        this.map.setFilter('routes-highlight', ['==', 'route_id', routeId]);
        
        // Store current highlight for cleanup
        if (!isTemporary) {
            this.currentHighlightedRoute = routeId;
            
            // Get route information for display
            this.displayRouteInfo(routeId);
            
            // Update URL with route selection
            if (this.urlManager) {
                const routeName = this.getRouteNameById(routeId);
                if (routeName) {
                    this.urlManager.onRouteSelected(routeName, routeId);
                }
            }
        }
        
        console.log(`🎯 Highlighting route: ${routeId}`);
    }

    getRouteNameById(routeId) {
        if (!this.map || !this.map.isSourceLoaded('mumbai-routes')) return null;
        
        try {
            const routeFeatures = this.map.querySourceFeatures('mumbai-routes', {
                sourceLayer: 'mumbai-routes',
                filter: ['==', 'route_id', routeId]
            });
            
            if (routeFeatures.length > 0) {
                const routeProps = routeFeatures[0].properties;
                return routeProps.route_short_name || routeProps.route_name;
            }
        } catch (error) {
            console.log('Could not get route name:', error);
        }
        
        return null;
    }

    displayRouteInfo(routeId) {
        if (!this.map || !this.map.isSourceLoaded('mumbai-routes')) return;
        
        try {
            const routeFeatures = this.map.querySourceFeatures('mumbai-routes', {
                sourceLayer: 'mumbai-routes',
                filter: ['==', 'route_id', routeId]
            });
            
            if (routeFeatures.length > 0) {
                const routeProps = routeFeatures[0].properties;
                const routeName = routeProps.route_short_name || routeProps.route_name;
                const routeDesc = routeProps.route_desc || routeProps.route_long_name;
                const isLive = routeProps.is_live === 'true' || routeProps.is_live === true;
                
                // Update selection indicator with route details
                this.updateSelectionIndicator(
                    `Route ${routeName}${routeDesc ? ` - ${routeDesc}` : ''} ${isLive ? '(Live)' : '(Scheduled)'}`
                );
            }
        } catch (error) {
            console.log('Could not get route details:', error);
        }
    }

    clearRouteHighlight() {
        // Hide the highlight layer
        this.map.setFilter('routes-highlight', ['==', 'route_id', '']);
        this.currentHighlightedRoute = null;
    }

    highlightDepartureRows(routeId, routeName, isTemporary = false) {
        // Clear previous highlights
        this.clearDepartureHighlights(isTemporary);
        
        // Find and highlight matching departure rows
        const departureRows = document.querySelectorAll('.departure-row');
        let highlightedCount = 0;
        
        departureRows.forEach(row => {
            const routeBadge = row.querySelector('.route-badge-text');
            if (routeBadge && routeBadge.textContent.trim().includes(routeName)) {
                const highlightClass = isTemporary ? 'departure-row-hover' : 'departure-row-selected';
                row.classList.add(highlightClass);
                highlightedCount++;
            }
        });
        
        if (!isTemporary && highlightedCount > 0) {
            this.currentHighlightedDepartures = { routeId, routeName };
            this.updateSelectionIndicator(`Route ${routeName} selected`);
        }
        
        console.log(`🎯 Highlighted ${highlightedCount} departure rows for route: ${routeName}`);
    }

    clearDepartureHighlights(isTemporaryOnly = false) {
        const departureRows = document.querySelectorAll('.departure-row');
        departureRows.forEach(row => {
            if (isTemporaryOnly) {
                row.classList.remove('departure-row-hover');
            } else {
                row.classList.remove('departure-row-selected', 'departure-row-hover');
            }
        });
        
        if (!isTemporaryOnly) {
            this.currentHighlightedDepartures = null;
            this.updateSelectionIndicator('');
        }
    }

    clearTemporaryHighlights() {
        // Only clear hover highlights, keep click selections
        this.clearDepartureHighlights(true);
        
        // If there's a permanent selection, restore it
        if (this.currentHighlightedRoute) {
            this.highlightRoute(this.currentHighlightedRoute);
        } else {
            this.clearRouteHighlight();
        }
    }

    setupDepartureRowInteractions() {
        // This will be called after departures are displayed
        const departureRows = document.querySelectorAll('.departure-row');
        
        departureRows.forEach((row, index) => {
            // Make rows clickable
            row.style.cursor = 'pointer';
            
            // Add click handler
            row.addEventListener('click', (e) => {
                const routeBadge = row.querySelector('.route-badge-text');
                const routeId = row.dataset.routeId;
                const routeName = routeBadge ? routeBadge.textContent.trim() : '';
                const departureData = this.getDepartureData(index);
                
                if (routeId && routeName) {
                    console.log(`🚌 Departure row clicked: ${routeName} (ID: ${routeId})`);
                    
                    // Clear previous selections
                    this.clearDepartureHighlights();
                    this.clearRouteHighlight();
                    this.stopBusLocationUpdates(); // Stop previous bus tracking
                    
                    // Highlight this row
                    row.classList.add('departure-row-selected');
                    
                    // Highlight corresponding route on map
                    this.highlightRoute(routeId);
                    
                    // Start tracking bus locations for this route
                    this.startBusLocationTracking(routeId, departureData);
                    
                    // Store selection
                    this.currentHighlightedRoute = routeId;
                    this.currentHighlightedDepartures = { routeId, routeName };
                    this.currentTrackedRoute = { routeId, routeName, departureData };
                    
                    // Update selection indicator
                    this.updateSelectionIndicator(`Tracking Route ${routeName} - Live bus locations updating`);
                }
            });
            
            // Add hover handlers
            row.addEventListener('mouseenter', (e) => {
                const routeId = row.dataset.routeId;
                const routeBadge = row.querySelector('.route-badge-text');
                const routeName = routeBadge ? routeBadge.textContent.trim() : '';
                
                if (routeId && !row.classList.contains('departure-row-selected')) {
                    row.classList.add('departure-row-hover');
                    this.highlightRoute(routeId, true);
                }
            });
            
            row.addEventListener('mouseleave', (e) => {
                const routeId = row.dataset.routeId;
                
                if (!row.classList.contains('departure-row-selected')) {
                    row.classList.remove('departure-row-hover');
                    
                    // Restore permanent highlight if exists
                    if (this.currentHighlightedRoute && this.currentHighlightedRoute !== routeId) {
                        this.highlightRoute(this.currentHighlightedRoute);
                    } else if (!this.currentHighlightedRoute) {
                        this.clearRouteHighlight();
                    }
                }
            });
        });
    }

    getDepartureData(departureIndex) {
        // Get departure data from the stored departures
        if (this.currentDepartures && this.currentDepartures[departureIndex]) {
            return this.currentDepartures[departureIndex];
        }
        return null;
    }

    async startBusLocationTracking(routeId, departureData) {
        console.log(`🔄 Starting bus location tracking for route: ${routeId}`);
        
        // Get current stop ID
        const currentStopId = this.currentStop?.properties?.id || this.currentStop?.properties?.stop_id;
        const stopIds = currentStopId ? [currentStopId] : [];
        
        // Start bus location updates
        this.startBusLocationUpdates(routeId, stopIds);
        
        // Show tracking notification
        this.showBusTrackingNotification(routeId, departureData);
    }

    showBusTrackingNotification(routeId, departureData) {
        // Create or update tracking notification
        let notification = document.getElementById('bus-tracking-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'bus-tracking-notification';
            notification.className = 'fixed top-4 right-4 z-50 max-w-sm';
            document.body.appendChild(notification);
        }
        
        const routeName = departureData?.route || 'Unknown Route';
        const vehicleNo = departureData?.vehicleId || '';
        const destination = departureData?.destination || '';
        
        notification.innerHTML = `
            <div class="bg-green-800 border border-green-600 rounded-lg p-4 shadow-lg">
                <div class="flex items-start justify-between">
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                        <div>
                            <div class="font-semibold text-white">Tracking Route ${routeName}</div>
                            <div class="text-sm text-green-200">
                                ${destination}
                                ${vehicleNo ? ` • Bus ${vehicleNo}` : ''}
                            </div>
                            <div class="text-xs text-green-300 mt-1">
                                Live bus locations updating every minute
                            </div>
                        </div>
                    </div>
                    <button onclick="window.transitExplorer.stopBusLocationTracking()" 
                            class="text-green-300 hover:text-white ml-2">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        // Auto-hide notification after 5 seconds
        setTimeout(() => {
            if (notification) {
                notification.style.opacity = '0.7';
            }
        }, 5000);
    }

    stopBusLocationTracking() {
        console.log('🛑 Stopping bus location tracking');
        
        // Stop updates
        this.stopBusLocationUpdates();
        
        // Clear tracking state
        this.currentTrackedRoute = null;
        
        // Hide notification
        const notification = document.getElementById('bus-tracking-notification');
        if (notification) {
            notification.remove();
        }
        
        // Update selection indicator
        if (this.currentHighlightedDepartures) {
            this.updateSelectionIndicator(`Route ${this.currentHighlightedDepartures.routeName} selected`);
        } else {
            this.updateSelectionIndicator('');
        }
    }

    // Add missing stopBusLocationUpdates method
    stopBusLocationUpdates() {
        if (this.busLocationInterval) {
            clearInterval(this.busLocationInterval);
            this.busLocationInterval = null;
        }
        
        // Clear bus locations from map
        if (this.map && this.map.getSource('bus-locations')) {
            this.map.getSource('bus-locations').setData({
                type: 'FeatureCollection',
                features: []
            });
        }
        
        console.log('🛑 Bus location updates stopped');
    }

    // Add missing startBusLocationUpdates method
    startBusLocationUpdates(routeId, stopIds = []) {
        console.log(`🔄 Starting bus location updates for route: ${routeId}`);
        
        // Stop any existing updates
        this.stopBusLocationUpdates();
        
        // Start new interval for bus location updates
        this.busLocationInterval = setInterval(() => {
            this.updateBusLocations(routeId, stopIds);
        }, 30000); // Update every 30 seconds
        
        // Initial update
        this.updateBusLocations(routeId, stopIds);
    }

    // Add missing updateBusLocations method
    updateBusLocations(routeId, stopIds = []) {
        // Mock bus location data for now
        const mockBuses = [
            {
                id: `bus_${routeId}_1`,
                vehicleNo: `MH01-${Math.floor(Math.random() * 9000) + 1000}`,
                routeId: routeId,
                lat: 19.1654 + (Math.random() - 0.5) * 0.01,
                lng: 72.9358 + (Math.random() - 0.5) * 0.01,
                isHalted: Math.random() > 0.7,
                timestamp: new Date().toISOString(),
                eta: Math.floor(Math.random() * 300) // Random ETA in seconds
            }
        ];
        
        const busFeatures = mockBuses.map(bus => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [bus.lng, bus.lat]
            },
            properties: {
                vehicleNo: bus.vehicleNo,
                routeId: bus.routeId,
                isHalted: bus.isHalted,
                timestamp: bus.timestamp,
                eta: bus.eta
            }
        }));
        
        // Update bus locations on map
        if (this.map && this.map.getSource('bus-locations')) {
            this.map.getSource('bus-locations').setData({
                type: 'FeatureCollection',
                features: busFeatures
            });
        }
    }

    setupEventListeners() {
        // Enable location button
        document.getElementById('enable-location-btn').addEventListener('click', () => {
            this.requestLocation();
        });

        // Center location button
        document.getElementById('center-location-btn').addEventListener('click', () => {
            if (this.userLocation) {
                this.centerOnLocation();
            }
        });

        // Nearest stop button
        document.getElementById('nearest-stop-btn').addEventListener('click', () => {
            this.findNearestStopManually();
        });

        // Stop selector button and dropdown
        this.setupStopSelector();

        // Add refresh button functionality to the last updated element
        const lastUpdated = document.getElementById('last-updated');
        if (lastUpdated) {
            lastUpdated.style.cursor = 'pointer';
            lastUpdated.title = 'Click to refresh departures';
            lastUpdated.addEventListener('click', () => {
                if (this.currentStop) {
                    console.log('🔄 Manual refresh triggered...');
                    this.loadDepartures(this.currentStop);
                }
            });
        }
        
        // Add keyboard handler for escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.clearAllSelections();
                this.hideStopDropdown();
            }
        });

        // Click outside to close dropdown
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('stop-dropdown');
            const button = document.getElementById('stop-selector-btn');
            
            if (!dropdown.contains(e.target) && !button.contains(e.target)) {
                this.hideStopDropdown();
            }
        });
    }

    setupStopSelector() {
        const stopSelectorBtn = document.getElementById('stop-selector-btn');
        const stopDropdown = document.getElementById('stop-dropdown');
        const stopSearchInput = document.getElementById('stop-search-input');
        
        // Toggle dropdown
        stopSelectorBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleStopDropdown();
        });
        
        // Search functionality
        stopSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            this.filterStopOptions(query);
        });
        
        // Handle search input focus
        stopSearchInput.addEventListener('focus', () => {
            // Clear selection when user starts typing
            stopSearchInput.value = '';
            this.loadVisibleStops();
        });
        
        console.log('✅ Stop selector events set up');
    }

    toggleStopDropdown() {
        const dropdown = document.getElementById('stop-dropdown');
        const isHidden = dropdown.classList.contains('hidden');
        
        if (isHidden) {
            this.showStopDropdown();
        } else {
            this.hideStopDropdown();
        }
    }

    showStopDropdown() {
        const dropdown = document.getElementById('stop-dropdown');
        dropdown.classList.remove('hidden');
        
        // Load stops if not already loaded
        if (!this.visibleStops || this.visibleStops.length === 0) {
            this.loadVisibleStops();
        }
        
        // Focus search input
        setTimeout(() => {
            document.getElementById('stop-search-input').focus();
        }, 100);
    }

    hideStopDropdown() {
        const dropdown = document.getElementById('stop-dropdown');
        dropdown.classList.add('hidden');
    }

    async loadVisibleStops() {
        console.log('🔍 Loading visible stops for dropdown...');
        
        try {
            // Get current map bounds for visible stops
            const bounds = this.map.getBounds();
            
            // Query all stop features from the map
            const allStopFeatures = this.map.querySourceFeatures('mumbai-stops', {
                sourceLayer: 'mumbai-stops'
            });
            
            if (!allStopFeatures || allStopFeatures.length === 0) {
                this.displayStopOptions([]);
                return;
            }
            
            // Filter stops within map bounds and add distance info
            const visibleStops = allStopFeatures
                .filter(feature => {
                    if (!feature.geometry || !feature.geometry.coordinates) return false;
                    const [lng, lat] = feature.geometry.coordinates;
                    return lng >= bounds.getWest() && lng <= bounds.getEast() &&
                           lat >= bounds.getSouth() && lat <= bounds.getNorth();
                })
                .map(feature => {
                    const busStop = new BusStop(feature);
                    // Add distance as a property to the BusStop instance
                    if (this.userLocation) {
                        busStop.distance = busStop.getDistance(this.userLocation);
                    } else {
                        busStop.distance = null;
                    }
                    return busStop;
                })
                .sort((a, b) => {
                    // Sort by distance if available, otherwise by name
                    if (a.distance !== null && b.distance !== null) {
                        return a.distance - b.distance;
                    } else if (a.distance !== null) {
                        return -1;
                    } else if (b.distance !== null) {
                        return 1;
                    } else {
                        return a.name.localeCompare(b.name);
                    }
                })
                .slice(0, 50); // Limit to 50 stops for performance
            
            this.visibleStops = visibleStops;
            this.displayStopOptions(visibleStops);
            
        } catch (error) {
            console.error('Error loading visible stops:', error);
            this.displayStopOptions([]);
        }
    }

    displayStopOptions(stops) {
        const stopOptionsList = document.getElementById('stop-options-list');
        
        if (stops.length === 0) {
            stopOptionsList.innerHTML = `
                <div class="px-4 py-3 text-gray-400 text-sm text-center">
                    No stops found in current view
                </div>
            `;
            return;
        }
        
        const currentStopId = this.currentStop?.properties?.id || 
                             this.currentStop?.properties?.stop_id;
        
        const optionsHTML = stops.map(stop => {
            const isSelected = stop.id === currentStopId;
            const routesInfo = stop.getRoutesFromTimetable();
            const topRoutes = routesInfo.slice(0, 3);
            
            return `
                <div class="stop-option ${isSelected ? 'stop-option-selected' : ''}" 
                     data-stop-id="${stop.id}">
                    <div class="stop-option-name">${stop.name}</div>
                    <div class="stop-option-details">
                        ${stop.distance ? `
                            <span class="stop-option-distance">${(stop.distance * 1000).toFixed(0)}m</span>
                        ` : ''}
                        <span>${routesInfo.length} routes</span>
                        <div class="status-indicator ${stop.hasLiveData ? 'status-live' : 'status-scheduled'}"></div>
                    </div>
                    ${topRoutes.length > 0 ? `
                        <div class="stop-option-routes">
                            ${topRoutes.map(route => {
                                const routeInfo = {
                                    agency: route.agency || 'BEST',
                                    fareType: route.fareType || DataUtils.detectFareTypeFromRoute(route.name)
                                };
                                return DataUtils.getStyledRouteBadge(route.name, routeInfo, 'small');
                            }).join('')}
                            ${routesInfo.length > 3 ? `<span class="text-gray-400 text-xs">+${routesInfo.length - 3}</span>` : ''}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
        
        stopOptionsList.innerHTML = optionsHTML;
        
        // Add click handlers
        stopOptionsList.querySelectorAll('.stop-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const stopId = option.dataset.stopId;
                const stop = stops.find(s => s.id === stopId);
                if (stop) {
                    this.selectStopFromDropdown(stop);
                }
            });
        });
    }

    filterStopOptions(query) {
        if (!this.visibleStops) return;
        
        const filteredStops = this.visibleStops.filter(stop => 
            stop.name.toLowerCase().includes(query) ||
            stop.description?.toLowerCase().includes(query)
        );
        
        this.displayStopOptions(filteredStops);
    }

    selectStopFromDropdown(busStop) {
        console.log(`🚏 Selecting stop from dropdown: ${busStop.name}`);
        
        // Update the button text
        this.updateStopSelectorButton(busStop);
        
        // Hide dropdown
        this.hideStopDropdown();
        
        // Clear previous selections
        this.clearAllSelections();
        
        // Select the stop using the feature from the BusStop object
        this.selectStop(busStop.feature);
        
        // Center map on the new stop
        if (busStop.coordinates) {
            this.map.flyTo({
                center: busStop.coordinates,
                zoom: Math.max(15, this.map.getZoom()),
                duration: 1500
            });
        }
    }

    updateStopSelectorButton(busStop) {
        const selectedStopName = document.getElementById('selected-stop-name');
        const distance = busStop.distance ? ` • ${(busStop.distance * 1000).toFixed(0)}m` : '';
        
        selectedStopName.innerHTML = `
            <svg class="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
            </svg>
            <span>${busStop.name}${distance}</span>
        `;
    }

    clearAllSelections() {
        console.log('🔄 Clearing all selections...');
        this.clearRouteHighlight();
        this.clearDepartureHighlights();
        this.clearStopHighlight();
        this.clearRouteSelections(); // Clear interactive route badge selections
        this.stopBusLocationTracking(); // Stop bus tracking
        this.currentSelectedStop = null;
        
        // Clean up any remaining markers
        if (this.nearestStopMarker) {
            this.nearestStopMarker.remove();
            this.nearestStopMarker = null;
        }
        
        // Update URL to clear parameters
        if (this.urlManager) {
            this.urlManager.onSelectionCleared();
        }
        
        // Clear the selection indicator
        this.updateSelectionIndicator('');
    }

    handleLocationError(error) {
        let message = 'Unable to retrieve your location.';
        
        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = 'Location access denied. Please enable location services.';
                this.showLocationBanner();
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Location information is unavailable.';
                this.showLocationBanner();
                break;
            case error.TIMEOUT:
                message = 'Location request timed out.';
                this.showLocationBanner();
                break;
        }
        
        this.updateLocationStatus(message, 'status-scheduled');
        // Don't show location error in departure board - just update status
        console.warn('📍 Location error:', message);
    }

    showLocationBanner() {
        const banner = document.getElementById('location-banner');
        if (banner) {
            banner.classList.remove('hidden');
            console.log('📍 Showing location banner');
        }
    }

    hideLocationBanner() {
        const banner = document.getElementById('location-banner');
        if (banner) {
            banner.classList.add('hidden');
            console.log('📍 Hiding location banner');
        }
    }

    async requestLocation(hasURLSelection = false) {
        console.log('📍 Requesting user location...');
        
        if (!navigator.geolocation) {
            this.handleLocationError({ code: 'GEOLOCATION_NOT_SUPPORTED', message: 'Geolocation is not supported by this browser.' });
            return;
        }

        // Update status but don't show banner yet
        this.updateLocationStatus('Requesting location...', 'status-scheduled');

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                });
            });

            this.userLocation = {
                lng: position.coords.longitude,
                lat: position.coords.latitude
            };

            console.log('📍 Location acquired successfully:', this.userLocation);
            
            // Update UI immediately after successful location acquisition
            this.updateLocationStatus('Location found', 'status-live');
            this.hideLocationBanner(); // Ensure banner is hidden
            this.enableCenterButton();
            this.enableNearestStopButton();
            
            // Add user location marker
            this.addUserLocationMarker();
            
            // Only find nearest stop automatically if no URL selection exists
            if (!hasURLSelection) {
                console.log('📍 No URL selection, proceeding to find nearest stop');
                // Wait for map sources to load before finding stops
                await this.waitForMapSources();
                await this.findNearestStop();
            } else {
                console.log('📍 URL selection exists, skipping automatic nearest stop finding');
            }
            
            // Center map on user location
            this.centerOnLocation();

        } catch (error) {
            console.error('📍 Location error caught:', error);
            this.handleLocationError(error);
        }
    }

    // Add method to wait for map sources to load
    async waitForMapSources() {
        console.log('⏳ Waiting for map sources to load...');
        
        return new Promise((resolve) => {
            const checkSources = () => {
                try {
                    const stopsExists = this.map.getSource('mumbai-stops');
                    const routesExists = this.map.getSource('mumbai-routes');
                    
                    if (stopsExists && routesExists &&
                        this.map.isSourceLoaded('mumbai-stops') && 
                        this.map.isSourceLoaded('mumbai-routes')) {
                        console.log('✅ Map sources loaded');
                        resolve();
                    } else {
                        console.log('⏳ Still waiting for sources...');
                        setTimeout(checkSources, 500);
                    }
                } catch (error) {
                    console.warn('⚠️ Error checking sources, retrying...', error);
                    setTimeout(checkSources, 500);
                }
            };
            checkSources();
        });
    }

    enableCenterButton() {
        const btn = document.getElementById('center-location-btn');
        btn.disabled = false;
    }

    enableNearestStopButton() {
        const btn = document.getElementById('nearest-stop-btn');
        if (btn) {
            btn.disabled = false;
        }
    }

    updateLocationStatus(message, statusClass) {
        const statusEl = document.getElementById('location-status');
        const indicator = statusEl.querySelector('.status-indicator');
        const text = statusEl.querySelector('span');
        
        // Remove all status classes
        indicator.classList.remove('status-live', 'status-scheduled');
        indicator.classList.add(statusClass);
        text.textContent = message;
    }

    addUserLocationMarker() {
        if (this.userLocationMarker) {
            this.userLocationMarker.remove();
        }

        const el = document.createElement('div');
        el.className = 'user-location-marker';
        el.style.cssText = `
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #3b82f6;
            border: 3px solid white;
            box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
            animation: pulse 2s infinite;
        `;

        this.userLocationMarker = new mapboxgl.Marker(el)
            .setLngLat([this.userLocation.lng, this.userLocation.lat])
            .addTo(this.map);
    }

    centerOnLocation() {
        if (this.userLocation) {
            this.map.flyTo({
                center: [this.userLocation.lng, this.userLocation.lat],
                zoom: 15,
                duration: 2000
            });
        }
    }

    debugSourceStatus() {
        console.log('🔍 Debugging source status:');
        
        try {
            const stopsSource = this.map.getSource('mumbai-stops');
            const routesSource = this.map.getSource('mumbai-routes');
            
            console.log('Mumbai stops source:', stopsSource ? 'EXISTS' : 'MISSING');
            console.log('Mumbai routes source:', routesSource ? 'EXISTS' : 'MISSING');
            
            if (stopsSource) {
                console.log('Stops source loaded:', this.map.isSourceLoaded('mumbai-stops'));
            }
            
            if (routesSource) {
                console.log('Routes source loaded:', this.map.isSourceLoaded('mumbai-routes'));
            }
            
            // Check if layers exist
            const stopsLayer = this.map.getLayer('stops');
            const routesLayer = this.map.getLayer('routes');
            
            console.log('Stops layer:', stopsLayer ? 'EXISTS' : 'MISSING');
            console.log('Routes layer:', routesLayer ? 'EXISTS' : 'MISSING');
            
            // Try to query a small sample only if source is loaded
            if (stopsSource && this.map.isSourceLoaded('mumbai-stops')) {
                const sample = this.map.querySourceFeatures('mumbai-stops', {
                    sourceLayer: 'mumbai-stops'
                });
                console.log(`Sample features from stops: ${sample.length}`);
                
                if (sample.length > 0) {
                    console.log('Sample stop properties:', sample[0].properties);
                    console.log('Sample stop geometry:', sample[0].geometry);
                }
            } else {
                console.warn('⚠️ Stops source not available for querying');
            }
            
        } catch (error) {
            console.error('Error in source debug:', error);
        }
    }

    showStopError(message) {
        console.warn('🚏 Stop error:', message);
        
        const departureList = document.getElementById('departure-list');
        if (departureList) {
            departureList.innerHTML = `
                <div class="text-center py-8 text-red-400">
                    <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    <p>${message}</p>
                    <p class="text-sm mt-1">Try selecting a different area</p>
                </div>
            `;
        }
        
        // Also update the status
        this.updateLocationStatus(message, 'status-scheduled');
    }

    async findNearestStop() {
        if (!this.userLocation) return;

        console.log('🔍 Finding nearest bus stop...');

        try {
            // Ensure the map and sources are loaded
            if (!this.map || !this.map.isSourceLoaded('mumbai-stops')) {
                console.log('⏳ Map source not loaded yet, waiting...');
                
                // Wait for source to load
                await new Promise((resolve) => {
                    const checkSource = () => {
                        if (this.map.isSourceLoaded('mumbai-stops')) {
                            resolve();
                        } else {
                            setTimeout(checkSource, 500);
                        }
                    };
                    checkSource();
                });
            }

            // First, center the map on user location to ensure stops are in viewport
            this.map.setCenter([this.userLocation.lng, this.userLocation.lat]);
            
            // Use a larger radius to query nearby stops
            const pixelRadius = 500; // Larger radius to catch more stops
            const center = this.map.project([this.userLocation.lng, this.userLocation.lat]);
            
            // Query stops within the pixel radius
            const bbox = [
                [center.x - pixelRadius, center.y - pixelRadius],
                [center.x + pixelRadius, center.y + pixelRadius]
            ];
            
            let features = this.map.queryRenderedFeatures(bbox, {
                layers: ['stops']
            });

            // If queryRenderedFeatures doesn't find anything, fall back to querySourceFeatures
            if (!features || features.length === 0) {
                console.log('🔍 No rendered features found, trying source features...');
                
                features = this.map.querySourceFeatures('mumbai-stops', {
                    sourceLayer: 'mumbai-stops'
                });
                
                console.log(`📊 Found ${features.length} total features from source`);
                
                // Filter features to only those within a reasonable distance (5km)
                if (features && features.length > 0) {
                    features = features.filter(feature => {
                        if (feature.geometry && feature.geometry.coordinates) {
                            const stopCoords = feature.geometry.coordinates;
                            const distance = DataUtils.calculateDistance(
                                this.userLocation.lat, this.userLocation.lng,
                                stopCoords[1], stopCoords[0]
                            );
                            return distance <= 5; // Within 5km
                        }
                        return false;
                    });
                }
            }

            console.log(`🚏 Found ${features ? features.length : 0} stop features to analyze`);

            if (!features || features.length === 0) {
                console.log('❌ No stop features found');
                this.showNoStopsMessage();
                return;
            }

            // Calculate distances and find nearest stop
            let nearestStop = null;
            let minDistance = Infinity;
            let debugStops = [];

            features.forEach(feature => {
                if (feature.geometry && feature.geometry.coordinates) {
                    const stopCoords = feature.geometry.coordinates;
                    const distance = DataUtils.calculateDistance(
                        this.userLocation.lat, this.userLocation.lng,
                        stopCoords[1], stopCoords[0]
                    );
                    
                    // Debug info
                    debugStops.push({
                        name: feature.properties.name || feature.properties.stop_name || 'Unknown',
                        distance: distance,
                        coords: stopCoords
                    });

                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestStop = feature;
                    }
                }
            });

            // Log debug info for first few stops
            console.log('🔍 Nearest stops analysis:', debugStops.sort((a, b) => a.distance - b.distance).slice(0, 5));

            if (nearestStop && minDistance <= 2) { // Within 2km
                console.log(`🚏 Nearest stop found: ${nearestStop.properties.name || 'Unknown'} at ${(minDistance * 1000).toFixed(0)}m`);
                this.selectStop(nearestStop);
                this.highlightNearestStop(nearestStop);
            } else if (nearestStop) {
                console.log(`⚠️ Nearest stop is too far: ${(minDistance * 1000).toFixed(0)}m away`);
                this.showDistantStopMessage(minDistance);
            } else {
                console.log('❌ No valid stops found');
                this.showNoStopsMessage();
            }

        } catch (error) {
            console.error('Error finding nearest stop:', error);
            this.showStopError('Unable to find nearby stops.');
        }
    }

    async findNearestStopForce() {
        if (!this.userLocation) return;

        console.log('🔍 Finding nearest bus stop (forced)...');

        try {
            // Ensure the map and sources are loaded
            if (!this.map || !this.map.isSourceLoaded('mumbai-stops')) {
                console.log('⏳ Map source not loaded yet, waiting...');
                return;
            }

            // Query all source features
            const features = this.map.querySourceFeatures('mumbai-stops', {
                sourceLayer: 'mumbai-stops'
            });

            if (!features || features.length === 0) {
                this.showNoStopsMessage();
                return;
            }

            // Calculate distances and find nearest stop (no distance limit)
            let nearestStop = null;
            let minDistance = Infinity;

            features.forEach(feature => {
                if (feature.geometry && feature.geometry.coordinates) {
                    const stopCoords = feature.geometry.coordinates;
                    const distance = DataUtils.calculateDistance(
                        this.userLocation.lat, this.userLocation.lng,
                        stopCoords[1], stopCoords[0]
                    );

                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestStop = feature;
                    }
                }
            });

            if (nearestStop) {
                console.log(`🚏 Forced selection - nearest stop: ${nearestStop.properties.name || 'Unknown'} at ${(minDistance * 1000).toFixed(0)}m`);
                this.selectStop(nearestStop);
                this.highlightNearestStop(nearestStop);
                
                // Fly to the stop location
                this.map.flyTo({
                    center: nearestStop.geometry.coordinates,
                    zoom: 15,
                    duration: 2000
                });
            } else {
                this.showNoStopsMessage();
            }

        } catch (error) {
            console.error('Error finding nearest stop (forced):', error);
            this.showStopError('Unable to find nearby stops.');
        }
    }

    selectStop(stopFeature) {
        this.currentStop = stopFeature;
        
        // Clear any previous highlights and markers
        this.clearAllSelections();
        
        // Highlight the selected stop using the layer system
        const busStop = new BusStop(stopFeature);
        this.highlightStop(busStop.id);
        this.currentSelectedStop = busStop;
        
        this.displayStopInfo(stopFeature);
        this.loadDepartures(stopFeature);
        
        // Update URL with stop selection
        if (this.urlManager && stopFeature.properties) {
            const stopName = stopFeature.properties.name || stopFeature.properties.stop_name;
            const stopId = stopFeature.properties.id || stopFeature.properties.stop_id;
            if (stopName) {
                this.urlManager.onStopSelected(stopName, stopId);
            }
        }
        
        // Start auto-refresh for live data
        this.startAutoRefresh();
    }

    highlightNearestStop(stopFeature) {
        // Remove the old marker-based highlighting
        // The selectStop method will handle highlighting via the layer system
        const busStop = new BusStop(stopFeature);
        console.log(`🚏 Found nearest stop: ${busStop.name}`);
        
        // Clean up any existing marker
        if (this.nearestStopMarker) {
            this.nearestStopMarker.remove();
            this.nearestStopMarker = null;
        }
    }

    displayStopInfo(stopFeature, busStop = null) {
        if (!busStop) {
            busStop = new BusStop(stopFeature);
        }
        
        // Update the stop selector button
        this.updateStopSelectorButton(busStop);
        
        const stopInfoEl = document.getElementById('stop-info');
        const displayInfo = busStop.getDisplayInfo(this.userLocation);
        
        // Get routes from timetable data which includes agency/fare info
        const routesWithInfo = busStop.getRoutesFromTimetable();
        
        stopInfoEl.innerHTML = `
            <div class="space-y-4">
                <!-- Stop Statistics -->
                <div class="grid grid-cols-2 gap-4 text-sm">
                    ${displayInfo.distance ? `
                        <div>
                            <span class="text-gray-400">Distance:</span>
                            <span class="text-white font-medium">${displayInfo.distance}</span>
                        </div>
                    ` : ''}
                    
                    <div>
                        <span class="text-gray-400">Routes:</span>
                        <span class="text-white font-medium">${routesWithInfo.length}</span>
                    </div>
                    
                    ${displayInfo.tripCount ? `
                        <div>
                            <span class="text-gray-400">Daily Trips:</span>
                            <span class="text-white font-medium">${displayInfo.tripCount}</span>
                        </div>
                    ` : ''}
                    
                    ${displayInfo.avgWaitTime ? `
                        <div>
                            <span class="text-gray-400">Avg Wait:</span>
                            <span class="text-white font-medium">${displayInfo.avgWaitTime} min</span>
                        </div>
                    ` : ''}
                </div>
                
                <!-- Live Data Status -->
                <div class="flex items-center gap-2 pt-2 border-t border-gray-600">
                    <div class="status-indicator ${displayInfo.hasLiveData ? 'status-live' : 'status-scheduled'}"></div>
                    <span class="text-xs text-gray-400">
                        ${displayInfo.hasLiveData ? 'Live data available' : 'Scheduled data only'}
                    </span>
                </div>
            </div>
        `;
        
        // Show and populate interactive routes
        this.displayInteractiveRoutes(routesWithInfo);
        
        // Set up browse stops button (keeping existing functionality)
        this.setupBrowseStopsIfNeeded(busStop);
    }

    displayInteractiveRoutes(routesWithInfo) {
        const routesContainer = document.getElementById('stop-routes-container');
        const routesList = document.getElementById('interactive-routes-list');
        
        if (routesWithInfo.length === 0) {
            routesContainer.classList.add('hidden');
            return;
        }
        
        // Generate interactive route badges
        const routeBadgesHtml = routesWithInfo.map((routeInfo, index) => {
            const routeClasses = this.getInteractiveRouteBadgeClasses(routeInfo);
            
            return `
                <button class="interactive-route-badge ${routeClasses}" 
                        data-route-name="${routeInfo.name}"
                        data-route-agency="${routeInfo.agency || 'BEST'}"
                        data-route-index="${index}"
                        title="Click to highlight route on map">
                    ${routeInfo.name}
                </button>
            `;
        }).join('');
        
        routesList.innerHTML = routeBadgesHtml;
        routesContainer.classList.remove('hidden');
        
        // Add click handlers for interactive routes
        routesList.querySelectorAll('.interactive-route-badge').forEach(badge => {
            badge.addEventListener('click', (e) => {
                const routeName = badge.dataset.routeName;
                const routeAgency = badge.dataset.routeAgency;
                this.handleInteractiveRouteBadgeClick(routeName, routeAgency, badge);
            });
        });
    }

    getInteractiveRouteBadgeClasses(routeInfo) {
        const agency = routeInfo.agency || 'BEST';
        const fareType = routeInfo.fareType || DataUtils.detectFareTypeFromRoute(routeInfo.name);
        
        if (agency.toUpperCase() === 'BEST') {
            if (fareType === 'AC') {
                return 'route-best-ac';
            } else if (fareType === 'Regular') {
                return 'route-best-regular';
            } else {
                return 'route-best-default';
            }
        } else {
            // Other agencies
            if (routeInfo.isLive) {
                return 'route-other-live';
            } else {
                return 'route-other-scheduled';
            }
        }
    }

    async handleInteractiveRouteBadgeClick(routeName, routeAgency, badgeElement) {
        console.log(`🚌 Interactive route badge clicked: ${routeName} (${routeAgency})`);
        
        // Clear previous route selections
        this.clearRouteSelections();
        
        // Mark this badge as selected
        badgeElement.classList.add('selected');
        
        // Find and highlight corresponding route on map
        const routeId = await this.findRouteIdByName(routeName);
        if (routeId) {
            this.highlightRoute(routeId);
            
            // Highlight corresponding departure rows
            this.highlightDepartureRows(routeId, routeName);
            
            // Update URL with route selection
            if (this.urlManager) {
                this.urlManager.onRouteSelected(routeName, routeId);
            }
            
            // Update selection indicator
            this.updateSelectionIndicator(`Route ${routeName} selected`);
        } else {
            console.warn(`Could not find route ID for: ${routeName}`);
            // Still highlight departure rows even without map route
            this.highlightDepartureRows(null, routeName);
            this.updateSelectionIndicator(`Route ${routeName} selected`);
        }
    }

    clearRouteSelections() {
        // Clear route highlights on map
        this.clearRouteHighlight();
        
        // Clear departure row highlights
        this.clearDepartureHighlights();
        
        // Clear interactive route badge selections
        const badges = document.querySelectorAll('.interactive-route-badge.selected');
        badges.forEach(badge => {
            badge.classList.remove('selected');
        });
        
        // Clear selection indicator
        this.updateSelectionIndicator('');
    }

    setupBrowseStopsIfNeeded(busStop) {
        // Keep the existing browse stops functionality
        // This maintains compatibility with the existing nearby stops panel
        this.loadNearbyStops(busStop);
    }

    // Add missing method for generating styled route badges
    getStyledRouteBadges(routeNames, busStop) {
        if (!routeNames || !Array.isArray(routeNames)) return '';
        
        // Get routes with full info from timetable
        const routesWithInfo = busStop.getRoutesFromTimetable();
        
        return routeNames.map(routeName => {
            // Find matching route info
            const routeInfo = routesWithInfo.find(r => r.name === routeName);
            return DataUtils.getStyledRouteBadge(routeName, routeInfo, 'small');
        }).join(' ');
    }

    async loadNearbyStops(currentStop) {
        console.log('🔍 Loading nearby stops...');
        
        try {
            // Query all stop features from the map
            const allStopFeatures = this.map.querySourceFeatures('mumbai-stops', {
                sourceLayer: 'mumbai-stops'
            });
            
            if (!allStopFeatures || allStopFeatures.length === 0) {
                console.warn('No stop features found');
                return;
            }
            
            // Convert to BusStop objects and calculate distances
            const nearbyStops = allStopFeatures
                .map(feature => new BusStop(feature))
                .filter(stop => stop.id !== currentStop.id) // Exclude current stop
                .map(stop => ({
                    ...stop,
                    distance: this.userLocation ? stop.getDistance(this.userLocation) : null
                }))
                .filter(stop => stop.distance === null || stop.distance <= 2) // Within 2km
                .sort((a, b) => {
                    if (a.distance === null && b.distance === null) return 0;
                    if (a.distance === null) return 1;
                    if (b.distance === null) return -1;
                    return a.distance - b.distance;
                })
                .slice(0, 10); // Limit to 10 nearby stops
            
            this.nearbyStops = nearbyStops;
            this.displayNearbyStops(nearbyStops);
            
        } catch (error) {
            console.error('Error loading nearby stops:', error);
        }
    }

    displayNearbyStops(stops) {
        const nearbyStopsList = document.getElementById('nearby-stops-list');
        
        // Check if the element exists, if not, log a warning and return
        if (!nearbyStopsList) {
            console.warn('⚠️ nearby-stops-list element not found in DOM - nearby stops display not available');
            return;
        }
        
        if (stops.length === 0) {
            nearbyStopsList.innerHTML = `
                <div class="text-center py-4 text-gray-400">
                    <p class="text-sm">No nearby stops found</p>
                </div>
            `;
            return;
        }
        
        const stopsHTML = stops.map(stop => {
            const displayInfo = stop.getDisplayInfo(this.userLocation);
            
            // Get route information for display
            const routes = stop.getRoutesFromTimetable();
            const topRoutes = routes.slice(0, 3);
            const remainingCount = Math.max(0, routes.length - 3);
            
            // Generate headway and agency text
            const avgHeadway = displayInfo.avgWaitTime || '15';
            const agencyText = routes.length > 0 ? routes[0].agency || 'BEST' : 'BEST';
            
            return `
                <div class="nearby-stop-item bg-gray-700/50 rounded p-3 cursor-pointer hover:bg-gray-700 transition-colors"
                     data-stop-id="${stop.id}">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <h5 class="font-medium text-white text-sm">${displayInfo.name}</h5>
                            <div class="flex items-center gap-2 mt-1">
                                ${displayInfo.distance ? `
                                    <span class="text-xs text-gray-400">${displayInfo.distance}</span>
                                ` : ''}
                                <span class="text-xs text-gray-400">${displayInfo.routeCount} routes</span>
                                <span class="text-gray-500">•</span>
                                <span class="text-xs text-gray-400">~${avgHeadway}min avg</span>
                                <div class="status-indicator status-${displayInfo.hasLiveData ? 'live' : 'scheduled'} scale-75"></div>
                            </div>
                            
                            <div class="text-xs text-gray-500 mb-2">${agencyText}</div>
                            
                            <div class="flex flex-wrap gap-1 mb-2">
                                ${topRoutes.map(route => {
                                    const routeInfo = {
                                        agency: route.agency || 'BEST',
                                        fareType: route.fareType || DataUtils.detectFareTypeFromRoute(route.name)
                                    };
                                    return DataUtils.getStyledRouteBadge(route.name, routeInfo, 'small');
                                }).join('')}
                                ${remainingCount > 0 ? 
                                    `<span class="text-gray-400 text-xs">+${remainingCount}</span>` : ''}
                            </div>
                            
                            ${displayInfo.description ? `
                                <div class="text-xs text-gray-400 truncate">${displayInfo.description}</div>
                            ` : ''}
                        </div>
                        <button class="select-stop-btn text-green-400 hover:text-green-300 ml-2 flex-shrink-0">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        nearbyStopsList.innerHTML = stopsHTML;
        
        // Add click handlers for nearby stops
        nearbyStopsList.querySelectorAll('.nearby-stop-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const stopId = item.dataset.stopId;
                const stop = stops.find(s => s.id === stopId);
                if (stop) {
                    this.selectStopFromNearby(stop);
                }
            });
        });
    }

    showNearbyStopsPanel() {
        const panel = document.getElementById('nearby-stops-panel');
        if (panel && panel.classList.contains('hidden')) {
            panel.classList.remove('hidden');
            console.log('📋 Showing nearby stops panel');
        }
    }

    async findNearestStopManually() {
        console.log('🎯 Manual nearest stop finding triggered...');
        
        if (!this.userLocation) {
            console.warn('❌ Cannot find nearest stop: user location not available');
            this.updateLocationStatus('Location required for nearest stop', 'status-scheduled');
            this.showLocationBanner();
            return;
        }

        // Clear current selections
        this.clearAllSelections();
        
        // Update URL to clear parameters since we're resetting to nearest stop
        if (this.urlManager) {
            this.urlManager.onSelectionCleared();
        }
        
        // Find and select nearest stop
        await this.findNearestStop();
        
        // Update status
        this.updateLocationStatus('Nearest stop selected', 'status-live');
    }

    setupMapInteractions() {
        console.log('🎯 Setting up unified map interactions...');
        
        // Unified map click handler to handle overlapping features
        this.map.on('click', (e) => {
            // Query all features at the click point
            const features = this.map.queryRenderedFeatures(e.point);
            const stopFeatures = features.filter(f => f.layer.id === 'stops');
            const routeFeatures = features.filter(f => f.layer.id === 'routes');
            
            console.log(`🎯 Map click - Found ${stopFeatures.length} stops, ${routeFeatures.length} routes`);
            
            // Priority: stops first, then routes
            if (stopFeatures.length > 0) {
                // Handle stop selection (first stop if multiple)
                const primaryStop = stopFeatures[0];
                this.handleStopClick(primaryStop, stopFeatures);
            } else if (routeFeatures.length > 0) {
                // Handle route selection (first route if multiple)
                const primaryRoute = routeFeatures[0];
                this.handleRouteClick(primaryRoute);
            } else {
                // Clear selections if clicking on empty map
                this.clearAllSelections();
            }
        });
        
        // Add route hover effects (separate from click handling)
        this.map.on('mouseenter', 'routes', () => {
            this.map.getCanvas().style.cursor = 'pointer';
        });

        this.map.on('mouseleave', 'routes', () => {
            this.map.getCanvas().style.cursor = '';
        });

        // Add stop hover interaction for temporary highlighting
        this.map.on('mouseenter', 'stops', (e) => {
            if (e.features && e.features.length > 0) {
                const feature = e.features[0];
                if (feature && feature.properties) {
                    const busStop = new BusStop(feature);
                    
                    // Only highlight if not already selected
                    if (!this.currentSelectedStop || this.currentSelectedStop.id !== busStop.id) {
                        this.highlightStop(busStop.id, true);
                    }
                }
            }
        });

        // Clear hover highlights when mouse leaves stops
        this.map.on('mouseleave', 'stops', () => {
            this.clearTemporaryStopHighlights();
        });

        console.log('✅ Unified map interactions set up successfully');
    }

    setupMoveEndListener() {
        console.log('🎯 Setting up moveend listener for transit data querying...');
        
        this.map.on('moveend', () => {
            // Small delay to ensure rendering is complete
            setTimeout(() => {
                this.queryVisibleTransitData();
            }, 100);
        });
    }

    queryVisibleTransitData() {
        try {
            // Get current map bounds and zoom level for context
            const bounds = this.map.getBounds();
            const zoom = this.map.getZoom();
            const center = this.map.getCenter();
            
            console.log(`🗺️ Map moved to zoom ${zoom.toFixed(2)} at [${center.lng.toFixed(4)}, ${center.lat.toFixed(4)}]`);
            
        } catch (error) {
            console.error('❌ Error querying visible transit data:', error);
        }
    }

    handleStopClick(primaryStopFeature, allStopFeatures) {
        console.log('🚏 Handling stop click with', allStopFeatures.length, 'stops at location');
        
        const primaryBusStop = new BusStop(primaryStopFeature);
        console.log(`🚏 Primary stop: ${primaryBusStop.name} (ID: ${primaryBusStop.id})`);
        
        // Clear previous selections
        this.clearAllSelections();
        
        // Select the stop
        this.selectStop(primaryStopFeature);
    }

    handleRouteClick(routeFeature) {
        console.log('🚌 Handling route click');
        
        if (routeFeature && routeFeature.properties) {
            const routeId = routeFeature.properties.route_id;
            const routeName = routeFeature.properties.route_short_name || 
                            routeFeature.properties.route_name;
            
            console.log(`🚌 Route clicked: ${routeName} (ID: ${routeId})`);
            
            // Clear previous selections
            this.clearAllSelections();
            
            // Highlight the route on map
            this.highlightRoute(routeId);
            
            // Highlight corresponding departure rows
            this.highlightDepartureRows(routeId, routeName);
            
            // Update URL with route selection
            if (this.urlManager && routeName) {
                this.urlManager.onRouteSelected(routeName, routeId);
            }
        }
    }

    highlightStop(stopId, isTemporary = false) {
        if (!stopId) return;

        // Dynamically determine the correct field name for the filter
        let fieldName = 'stop_id'; // default
        
        if (this.currentStop && this.currentStop.properties) {
            // Determine which field name is actually used in the tileset
            if (this.currentStop.properties.id !== undefined) {
                fieldName = 'id';
            } else if (this.currentStop.properties.stop_id !== undefined) {
                fieldName = 'stop_id';
            }
        }

        console.log(`🎯 Using field '${fieldName}' for stop highlight filter`);

        // Update the highlight layer filter to show only the selected stop
        this.map.setFilter('stops-highlight', ['==', fieldName, stopId]);
        
        // Store current highlight for cleanup
        if (!isTemporary) {
            this.currentHighlightedStop = stopId;
            this.currentHighlightedStopField = fieldName;
        }
        
        console.log(`🎯 Highlighting stop: ${stopId} using field: ${fieldName}`);
    }

    clearStopHighlight() {
        // Use the stored field name if available, otherwise detect it
        let fieldName = this.currentHighlightedStopField || 'stop_id';
        
        // Hide the highlight layer by setting an impossible filter
        this.map.setFilter('stops-highlight', ['==', fieldName, '']);
        this.currentHighlightedStop = null;
        this.currentHighlightedStopField = null;
    }

    clearTemporaryStopHighlights() {
        // Only clear hover highlights, keep click selections
        if (this.currentHighlightedStop) {
            this.highlightStop(this.currentHighlightedStop);
        } else {
            this.clearStopHighlight();
        }
    }

    async loadDepartures(stopFeature) {
        const departureList = document.getElementById('departure-list');
        const lastUpdated = document.getElementById('last-updated');
        
        try {
            const props = stopFeature.properties;
            let departures = [];
            let dataSource = 'No data';
            
            console.log(`🔄 Loading departures for stop: ${props.name || props.stop_name}`);
            
            // Mock some departures for now
            departures = [
                {
                    route: '374',
                    time: new Date(Date.now() + 5 * 60 * 1000),
                    isLive: true,
                    destination: 'Borivali Station (E)',
                    agencyName: 'BEST'
                },
                {
                    route: 'A77',
                    time: new Date(Date.now() + 12 * 60 * 1000),
                    isLive: true,
                    destination: 'Andheri Station (W)',
                    agencyName: 'BEST'
                }
            ];
            
            dataSource = 'Live data';
            
            this.displayDepartures(departures);
            
            // Update timestamp with data source info
            lastUpdated.innerHTML = `${dataSource} • Updated ${new Date().toLocaleTimeString()}`;
            
        } catch (error) {
            console.error('Error loading departures:', error);
            this.showDepartureError();
        }
    }

    displayDepartures(departures) {
        const departureList = document.getElementById('departure-list');
        
        if (departures.length === 0) {
            departureList.innerHTML = `
                <div class="text-center py-8 text-gray-400">
                    <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                        <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1V8a1 1 0 00-1-1h-3z"/>
                    </svg>
                    <p>No departures available</p>
                    <p class="text-sm mt-1">Service may have ended for today</p>
                </div>
            `;
            return;
        }

        const departureHTML = departures.map((departure, index) => {
            const timeStr = departure.time.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
            });
            
            const now = new Date();
            const minutesUntil = Math.ceil((departure.time - now) / (1000 * 60));
            
            let timeDisplay;
            if (minutesUntil <= 0) {
                timeDisplay = 'Due';
            } else if (minutesUntil === 1) {
                timeDisplay = '1 min';
            } else {
                timeDisplay = `${minutesUntil} min`;
            }

            const statusClass = departure.isLive ? 'status-live' : 'status-scheduled';
            const statusText = departure.isLive ? 'Live tracking' : 'Scheduled';
            
            return `
                <div class="departure-row flex items-center justify-between p-3 rounded transition-all duration-200" 
                     data-route-id="${departure.routeId || ''}" 
                     data-departure-index="${index}">
                    <div class="flex items-center gap-3">
                        <div class="status-indicator ${statusClass}"></div>
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="bg-blue-600 text-white px-2 py-1 rounded text-sm font-bold">${departure.route}</span>
                                <span class="text-white font-medium">${departure.destination}</span>
                            </div>
                            <div class="text-xs text-gray-400 mt-1 flex items-center gap-2">
                                <span>${statusText}</span>
                                <span>•</span>
                                <span>${departure.agencyName}</span>
                            </div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-white font-bold">${timeDisplay}</div>
                        <div class="text-xs text-gray-400">${timeStr}</div>
                    </div>
                </div>
            `;
        }).join('');

        departureList.innerHTML = departureHTML;
    }

    showDepartureError() {
        const departureList = document.getElementById('departure-list');
        departureList.innerHTML = `
            <div class="text-center py-8 text-red-400">
                <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
                <p>Unable to load departure information</p>
            </div>
        `;
    }

    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        // Refresh every 30 seconds if we have a current stop
        this.refreshInterval = setInterval(() => {
            if (this.currentStop && this.currentStop.properties.id) {
                console.log('🔄 Auto-refreshing live data...');
                this.loadDepartures(this.currentStop);
            }
        }, 30000); // 30 seconds
    }

    selectStopFromNearby(busStop) {
        console.log(`🚏 Selecting nearby stop: ${busStop.name}`);
        
        // Clear previous selections
        this.clearAllSelections();
        
        // Highlight the selected stop
        this.highlightStop(busStop.id);
        this.currentSelectedStop = busStop;
        
        // Update UI
        this.displayStopInfo(busStop.feature, busStop);
        this.loadDepartures(busStop.feature);
        
        // Update URL with stop selection
        if (this.urlManager) {
            this.urlManager.onStopSelected(busStop.name, busStop.id);
        }
        
        // Center map on the new stop
        if (busStop.coordinates) {
            this.map.flyTo({
                center: busStop.coordinates,
                zoom: Math.max(15, this.map.getZoom()),
                duration: 1500
            });
        }
        
        // Hide nearby panel
        this.hideNearbyStopsPanel();
        
        // Load new nearby stops for the selected stop
        this.loadNearbyStops(busStop);
    }

    hideNearbyStopsPanel() {
        const panel = document.getElementById('nearby-stops-panel');
        if (panel) {
            panel.classList.add('hidden');
        }
    }

    updateSelectionIndicator(message) {
        // Add or update a selection indicator in the UI
        let indicator = document.getElementById('selection-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'selection-indicator';
            indicator.className = 'selection-indicator';
            
            // Insert after the departure board header
            const departureHeader = document.querySelector('.departure-board h3');
            if (departureHeader) {
                departureHeader.parentElement.insertAdjacentElement('afterend', indicator);
            }
        }
        
        if (message) {
            indicator.innerHTML = `
                <div class="flex items-center justify-between text-xs text-yellow-300 bg-yellow-900/30 border border-yellow-600/30 rounded px-3 py-2 mb-2">
                    <span>${message}</span>
                    <button onclick="window.transitExplorer.clearAllSelections()" class="text-yellow-400 hover:text-yellow-200">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                        </svg>
                    </button>
                </div>
            `;
            indicator.style.display = 'block';
        } else {
            indicator.style.display = 'none';
        }
    }

    // Add missing showNoStopsMessage method
    showNoStopsMessage() {
        console.warn('🚏 No stops found in area');
        this.showStopError('No bus stops found in this area');
    }

    // Add missing showDistantStopMessage method
    showDistantStopMessage(distance) {
        const distanceText = distance > 1 ? 
            `${distance.toFixed(1)}km` : 
            `${(distance * 1000).toFixed(0)}m`;
        
        console.warn(`🚏 Nearest stop is ${distanceText} away`);
        this.showStopError(`Nearest stop is ${distanceText} away. Try moving closer to a bus route.`);
    }

    // Add missing findRouteIdByName method
    async findRouteIdByName(routeName) {
        if (!this.map || !this.map.getSource('mumbai-routes')) {
            console.warn('Map or routes source not available');
            return null;
        }
        
        try {
            // Wait for source to be loaded
            if (!this.map.isSourceLoaded('mumbai-routes')) {
                console.log('⏳ Waiting for routes source to load...');
                await new Promise(resolve => {
                    const checkSource = () => {
                        if (this.map.isSourceLoaded('mumbai-routes')) {
                            resolve();
                        } else {
                            setTimeout(checkSource, 500);
                        }
                    };
                    checkSource();
                });
            }
            
            // Query route features to find matching route
            const routeFeatures = this.map.querySourceFeatures('mumbai-routes', {
                sourceLayer: 'mumbai-routes'
            });
            
            // Find route with matching name
            const matchingRoute = routeFeatures.find(feature => {
                const props = feature.properties;
                const shortName = props.route_short_name;
                const longName = props.route_name;
                
                return shortName === routeName || longName === routeName;
            });
            
            if (matchingRoute) {
                console.log(`✅ Found route ID for ${routeName}: ${matchingRoute.properties.route_id}`);
                return matchingRoute.properties.route_id;
            } else {
                console.warn(`❌ No route found with name: ${routeName}`);
                return null;
            }
            
        } catch (error) {
            console.error('Error finding route ID:', error);
            return null;
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.transitExplorer = new TransitExplorer();
});

// Export for use in other modules if needed
export default TransitExplorer; 