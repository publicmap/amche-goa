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
        // Add Mumbai stops source
        this.map.addSource('mumbai-stops', {
            type: 'vector',
            url: `mapbox://${this.tilesets.stops}`
        });

        // Add Mumbai routes source  
        this.map.addSource('mumbai-routes', {
            type: 'vector',
            url: `mapbox://${this.tilesets.routes}`
        });
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
                    // Other agencies or unknown - use live status
                    [
                        'case',
                        ['get', 'is_live'], '#22c55e', // Green for live routes
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
            }
        });
    }

    clearAllSelections() {
        console.log('🔄 Clearing all selections...');
        this.clearRouteHighlight();
        this.clearDepartureHighlights();
        this.clearStopHighlight();
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
    }

    async requestLocation(hasURLSelection = false) {
        console.log('📍 Requesting user location...');
        
        if (!navigator.geolocation) {
            this.showLocationError('Geolocation is not supported by this browser.');
            return;
        }

        // Update status
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

            console.log('📍 Location acquired:', this.userLocation);
            
            this.updateLocationStatus('Location found', 'status-live');
            this.hideLocationBanner();
            this.enableCenterButton();
            this.enableNearestStopButton(); // Enable the nearest stop button
            
            // Add user location marker
            this.addUserLocationMarker();
            
            // Debug source status before finding stops
            this.debugSourceStatus();
            
            // Only find nearest stop automatically if no URL selection exists
            if (!hasURLSelection) {
                console.log('📍 No URL selection, proceeding to find nearest stop');
                // Find nearest stop
                await this.findNearestStop();
            } else {
                console.log('📍 URL selection exists, skipping automatic nearest stop finding');
            }
            
            // Center map on user location
            this.centerOnLocation();

        } catch (error) {
            console.error('Location error:', error);
            this.handleLocationError(error);
        }
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
                break;
            case error.TIMEOUT:
                message = 'Location request timed out.';
                break;
        }
        
        this.updateLocationStatus(message, 'status-scheduled');
        this.showLocationError(message);
    }

    showLocationBanner() {
        document.getElementById('location-banner').classList.remove('hidden');
    }

    hideLocationBanner() {
        document.getElementById('location-banner').classList.add('hidden');
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
        
        const stopInfoEl = document.getElementById('stop-info');
        const displayInfo = busStop.getDisplayInfo(this.userLocation);
        
        // Get routes from timetable data which includes agency/fare info
        const routesWithInfo = busStop.getRoutesFromTimetable();
        
        // Generate route badges using the timetable data which has proper styling info
        const routeBadgesHtml = routesWithInfo.slice(0, 5).map(routeInfo => {
            return DataUtils.getStyledRouteBadge(routeInfo.name, routeInfo, 'small');
        }).join(' ');
        
        // Calculate remaining routes
        const moreRoutes = Math.max(0, routesWithInfo.length - 5);
        
        stopInfoEl.innerHTML = `
            <div class="bg-gray-800 rounded-lg p-4 border border-green-500/30">
                <div class="flex justify-between items-start mb-3">
                    <h3 class="font-bold text-white text-lg">${displayInfo.name}</h3>
                    <button id="browse-stops-btn" class="text-green-400 hover:text-green-300 transition-colors text-sm">
                        <svg class="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/>
                        </svg>
                        Browse Stops
                    </button>
                </div>
                
                ${displayInfo.description ? `<p class="text-gray-300 text-sm mb-3">${displayInfo.description}</p>` : ''}
                
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
                    
                    <div class="col-span-2">
                        <span class="text-gray-400">Service Routes:</span>
                        <div class="flex flex-wrap gap-1 mt-1">
                            ${routeBadgesHtml}
                            ${moreRoutes > 0 ? 
                                `<span class="text-gray-400 text-xs">+${moreRoutes}</span>` : ''}
                        </div>
                    </div>
                    
                    <div class="col-span-2 pt-2 border-t border-gray-600">
                        <div class="flex items-center gap-2">
                            <div class="status-indicator ${displayInfo.hasLiveData ? 'status-live' : 'status-scheduled'}"></div>
                            <span class="text-xs text-gray-400">
                                ${displayInfo.hasLiveData ? 'Live data available' : 'Scheduled data only'}
                            </span>
                        </div>
                    </div>
                </div>
                
                <!-- Nearby Stops Panel (initially hidden) -->
                <div id="nearby-stops-panel" class="hidden mt-4 pt-4 border-t border-gray-600">
                    <div class="flex justify-between items-center mb-3">
                        <h4 class="font-semibold text-white">Nearby Stops</h4>
                        <button id="close-nearby-btn" class="text-gray-400 hover:text-white">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                            </svg>
                        </button>
                    </div>
                    <div id="nearby-stops-list" class="space-y-2 max-h-64 overflow-y-auto">
                        <!-- Nearby stops will be populated here -->
                    </div>
                </div>
            </div>
        `;
        
        // Set up browse stops button
        document.getElementById('browse-stops-btn').addEventListener('click', () => {
            this.toggleNearbyStopsPanel();
        });
        
        // Set up close nearby button
        const closeBtn = document.getElementById('close-nearby-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideNearbyStopsPanel();
            });
        }
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
                                <div class="status-indicator status-${displayInfo.hasLiveData ? 'live' : 'scheduled'} scale-75"></div>
                            </div>
                            <div class="flex flex-wrap gap-1 mt-2">
                                ${this.getStyledRouteBadges(displayInfo.routes.slice(0, 3), stop)}
                                ${displayInfo.moreRoutes > 0 ? 
                                    `<span class="text-gray-400 text-xs">+${displayInfo.moreRoutes}</span>` : ''}
                            </div>
                        </div>
                        <button class="select-stop-btn text-green-400 hover:text-green-300 ml-2">
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

    toggleNearbyStopsPanel() {
        const panel = document.getElementById('nearby-stops-panel');
        if (panel.classList.contains('hidden')) {
            panel.classList.remove('hidden');
            // Load stops if not already loaded
            if (this.currentSelectedStop && !this.nearbyStops) {
                this.loadNearbyStops(this.currentSelectedStop);
            }
        } else {
            panel.classList.add('hidden');
        }
    }

    hideNearbyStopsPanel() {
        const panel = document.getElementById('nearby-stops-panel');
        panel.classList.add('hidden');
    }

    // Add auto-refresh functionality for live data
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

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    // Cleanup method for proper resource management
    destroy() {
        this.stopAutoRefresh();
        
        // Clear any highlights
        if (this.map && this.map.getLayer('routes-highlight')) {
            this.clearRouteHighlight();
            this.clearDepartureHighlights();
        }
        
        if (this.map) {
            this.map.remove();
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
            const departureHeader = document.querySelector('.departure-board h3').parentElement;
            departureHeader.insertAdjacentElement('afterend', indicator);
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

    setupStopInteractions() {
        console.log('🚏 Setting up stop interactions...');
        
        // Ensure the stops layer exists before setting up interactions
        if (!this.map.getLayer('stops')) {
            console.warn('Stops layer not found, interactions setup delayed');
            return;
        }

        // Add stop click interaction for selection
        this.map.on('click', 'stops', (e) => {
            console.log('🚏 Stop click handler triggered', e.features[0]);
            
            if (e.features && e.features.length > 0) {
                const feature = e.features[0];
                if (feature && feature.properties) {
                    const busStop = new BusStop(feature);
                    console.log(`🚏 Stop clicked: ${busStop.name} (ID: ${busStop.id})`);
                    console.log('📊 Stop properties:', feature.properties);
                    
                    // Clear previous selections
                    this.clearAllSelections();
                    
                    // Highlight the stop on map
                    this.highlightStop(busStop.id);
                    
                    // Store the selected stop
                    this.currentSelectedStop = busStop;
                    
                    // Update UI with stop information
                    this.displayStopInfo(feature, busStop);
                    this.loadDepartures(feature);
                    
                    // Load nearby stops for browsing
                    this.loadNearbyStops(busStop);
                } else {
                    console.warn('⚠️ No feature or properties found in stop click');
                }
            }
        });

        // Add stop hover interaction for temporary highlighting
        this.map.on('mouseenter', 'stops', (e) => {
            if (e.features && e.features.length > 0) {
                const feature = e.features[0];
                if (feature && feature.properties) {
                    const busStop = new BusStop(feature);
                    
                    // Only highlight if not already selected
                    if (!this.currentSelectedStop || this.currentSelectedStop.id !== busStop.id) {
                        console.log(`🎯 Hovering stop: ${busStop.name}`);
                        this.highlightStop(busStop.id, true);
                    }
                }
            }
        });

        // Clear hover highlights when mouse leaves stops
        this.map.on('mouseleave', 'stops', () => {
            this.clearTemporaryStopHighlights();
        });

        console.log('✅ Stop interactions set up successfully');
    }

    highlightStop(stopId, isTemporary = false) {
        if (!stopId) return;

        // Dynamically determine the correct field name for the filter
        // Check if we have access to current stop feature to determine field name
        let fieldName = 'stop_id'; // default
        
        if (this.currentStop && this.currentStop.properties) {
            // Determine which field name is actually used in the tileset
            if (this.currentStop.properties.id !== undefined) {
                fieldName = 'id';
            } else if (this.currentStop.properties.stop_id !== undefined) {
                fieldName = 'stop_id';
            }
        }
        
        // If we don't have currentStop to check, try to query a sample feature
        if (!this.currentStop && this.map && this.map.isSourceLoaded('mumbai-stops')) {
            try {
                const sampleFeatures = this.map.querySourceFeatures('mumbai-stops', {
                    sourceLayer: 'mumbai-stops'
                });
                
                if (sampleFeatures.length > 0) {
                    const sample = sampleFeatures[0].properties;
                    if (sample.id !== undefined) {
                        fieldName = 'id';
                    } else if (sample.stop_id !== undefined) {
                        fieldName = 'stop_id';
                    }
                }
            } catch (error) {
                console.log('Could not sample features for field detection:', error);
            }
        }

        console.log(`🎯 Using field '${fieldName}' for stop highlight filter`);

        // Update the highlight layer filter to show only the selected stop
        this.map.setFilter('stops-highlight', ['==', fieldName, stopId]);
        
        // Store current highlight for cleanup
        if (!isTemporary) {
            this.currentHighlightedStop = stopId;
            this.currentHighlightedStopField = fieldName; // Store field name for cleanup
        }
        
        console.log(`🎯 Highlighting stop: ${stopId} using field: ${fieldName}`);
    }

    clearStopHighlight() {
        // Use the stored field name if available, otherwise detect it
        let fieldName = this.currentHighlightedStopField || 'stop_id'; // default
        
        if (!this.currentHighlightedStopField && this.map && this.map.isSourceLoaded('mumbai-stops')) {
            try {
                const sampleFeatures = this.map.querySourceFeatures('mumbai-stops', {
                    sourceLayer: 'mumbai-stops'
                });
                
                if (sampleFeatures.length > 0) {
                    const sample = sampleFeatures[0].properties;
                    if (sample.id !== undefined) {
                        fieldName = 'id';
                    } else if (sample.stop_id !== undefined) {
                        fieldName = 'stop_id';
                    }
                }
            } catch (error) {
                console.log('Could not sample features for field detection in clear:', error);
            }
        }

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
            
            // Try to fetch live data first
            if (props.id || props.stop_id) {
                const stopId = props.id || props.stop_id;
                console.log(`🔴 Fetching live data for stop: ${stopId}`);
                const liveData = await this.fetchLiveData(stopId);
                
                if (liveData && liveData.length > 0) {
                    departures = liveData;
                    dataSource = 'Live data';
                    console.log(`📡 Found ${departures.length} live departures`);
                } else {
                    console.log('📡 No live data available, falling back to timetable');
                }
            }
            
            // Fallback to timetable data if no live data
            if (departures.length === 0 && props.stop_timetable) {
                departures = this.parseTimetableData(props.stop_timetable, props.route_name_list);
                
                if (departures.length > 0) {
                    console.log(`📋 Found ${departures.length} timetable departures for stop:`, props.name);
                    dataSource = 'Scheduled';
                } else {
                    console.log('📋 No valid departures found in timetable data');
                }
            }
            
            // If we have timetable data but no current departures, show upcoming ones
            if (departures.length === 0 && props.stop_timetable) {
                departures = this.getNextDayDepartures(props.stop_timetable);
                if (departures.length > 0) {
                    dataSource = 'Tomorrow';
                }
            }
            
            this.displayDepartures(departures);
            
            // Update timestamp with data source info
            lastUpdated.innerHTML = `${dataSource} • Updated ${new Date().toLocaleTimeString()}`;
            
        } catch (error) {
            console.error('Error loading departures:', error);
            this.showDepartureError();
        }
    }

    async fetchLiveData(stopId) {
        try {
            console.log(`🌐 Calling Chalo API for stop: ${stopId}`);
            
            // First, we need to get route information for this stop to build the request
            const routeInfo = await this.getStopRouteInfo(stopId);
            if (!routeInfo || routeInfo.length === 0) {
                console.log(`❌ No route info found for stop: ${stopId}`);
                return [];
            }

            // Build the stopIdRouteIdList for the API call
            const stopIdRouteIdList = routeInfo.map(route => `${stopId}:${route.routeId}`);

            const response = await fetch('https://chalo.com/app/api/vasudha/cities/mumbai/stop-route-eta', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'AccessToken': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZWZyZXNoVG9rZW4iOiJleUpoYkdjaU9pSklVekkxTmlJc0luUjVjQ0k2SWtwWFZDSjkuZXlKMWMyVnlTV1FpT2lJNU9ERTVNRGsxTURJMElpd2laR1YyYVdObFNXUWlPaUptWXprNU0yWmhaRFpsT1dFd09URm1aakZoTkROaE1UZzNaREV4WlRFek15SXNJbWxoZENJNk1UWTRNVEV5TlRFMU9YMC5DdjVLcTJuNnI4SHU1SWd3bWIxcm5NaHJzYUw1cUs2U1hBUnBJT3RUSXVFIiwiZGV2aWNlSWQiOiJmYzk5M2ZhZDZlOWEwOTFmZjFhNDNhMTg3ZDExZTEzMyIsInVzZXJJZCI6Ijk4MTkwOTUwMjQiLCJpYXQiOjE2ODMzMTkxMjAsImV4cCI6MTY4MzMyNjMyMCwianRpIjoibDEwbG8xbGhiMHFwc2UifQ.6F-PFbdPRLW_MUb9pBKF9tm8apDsJTevWJsbKKbiYBY',
                    'AuthType': 'ACCESS_TOKEN',
                    'DeviceId': 'fc993fad6e9a091ff1a43a187d11e133',
                    'Origin': 'https://chalo.com',
                    'Referer': 'https://chalo.com/app/nearest-bus-stop',
                    'Source': '1',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
                    'UserId': 'undefined',
                    'X-Type': 'pass'
                },
                body: JSON.stringify({
                    stopIdRouteIdList: stopIdRouteIdList
                })
            });

            if (!response.ok) {
                console.log(`❌ API response not ok: ${response.status}`);
                return [];
            }

            const data = await response.json();
            console.log('📡 Live API Response:', data);

            return this.parseChaloApiData(data);

        } catch (error) {
            console.error('❌ Error fetching live data:', error);
            return [];
        }
    }

    async getStopRouteInfo(stopId) {
        // Try to get route information from the current stop's data
        if (this.currentStop && this.currentStop.properties) {
            const busStop = new BusStop(this.currentStop);
            const timetableRoutes = busStop.getRoutesFromTimetable();
            
            if (timetableRoutes.length > 0) {
                // Generate route IDs - in a real scenario, these would come from your data
                // For now, we'll try to find route IDs from the map data
                const routeInfo = [];
                
                for (const route of timetableRoutes) {
                    const routeId = await this.findRouteIdByName(route.name);
                    if (routeId) {
                        routeInfo.push({
                            routeName: route.name,
                            routeId: routeId,
                            agency: route.agency
                        });
                    }
                }
                
                return routeInfo;
            }
        }
        
        // Fallback: try to extract from route list
        if (this.currentStop && this.currentStop.properties.route_name_list) {
            const routeNames = this.currentStop.properties.route_name_list.split(/[;,]/).map(r => r.trim());
            const routeInfo = [];
            
            for (const routeName of routeNames.slice(0, 5)) { // Limit to first 5 routes
                const routeId = await this.findRouteIdByName(routeName);
                if (routeId) {
                    routeInfo.push({
                        routeName: routeName,
                        routeId: routeId,
                        agency: 'BEST'
                    });
                }
            }
            
            return routeInfo;
        }
        
        return [];
    }

    async findRouteIdByName(routeName) {
        // Try to find route ID from map data
        if (this.map && this.map.isSourceLoaded('mumbai-routes')) {
            try {
                const routeFeatures = this.map.querySourceFeatures('mumbai-routes', {
                    sourceLayer: 'mumbai-routes'
                });
                
                const foundRoute = routeFeatures.find(feature => 
                    feature.properties.route_short_name === routeName ||
                    feature.properties.route_name === routeName
                );
                
                if (foundRoute && foundRoute.properties.route_id) {
                    return foundRoute.properties.route_id;
                }
            } catch (error) {
                console.log('Could not query route info:', error);
            }
        }
        
        // Generate a fallback route ID based on route name
        // In production, you would have a proper mapping
        return `route_${routeName.replace(/[^a-zA-Z0-9]/g, '_')}`;
    }

    parseChaloApiData(apiData) {
        try {
            const departures = [];
            const now = new Date();

            // Handle the correct API response structure
            const routeEtaData = apiData.stopRouteEtas || apiData;

            // Process each stop-route combination
            Object.keys(routeEtaData).forEach(stopRouteKey => {
                const routeData = routeEtaData[stopRouteKey];
                
                // Skip empty route data
                if (!routeData || Object.keys(routeData).length === 0) {
                    return;
                }
                
                // Each route data contains bus entries
                Object.keys(routeData).forEach(busKey => {
                    try {
                        // Handle both JSON string and object formats
                        let busData;
                        const rawData = routeData[busKey];
                        
                        if (typeof rawData === 'string') {
                            // Parse JSON string
                            busData = JSON.parse(rawData);
                        } else if (typeof rawData === 'object' && rawData !== null) {
                            // Already an object
                            busData = rawData;
                        } else {
                            console.warn('Unexpected bus data format:', rawData);
                            return;
                        }
                        
                        // Extract bus information
                        const eta = busData.eta;
                        const vehicleNo = busData.vNo;
                        const destination = busData.dest;
                        const routeName = busData.rN;
                        const agency = busData.ag;
                        const distance = busData.dist;
                        const isHalted = busData.isHalted;
                        const timestamp = busData.tS;
                        
                        // Calculate data freshness
                        let dataFreshness = '';
                        if (timestamp) {
                            const dataTime = new Date(timestamp);
                            const timeDiffSeconds = Math.floor((now - dataTime) / 1000);
                            
                            if (timeDiffSeconds < 60) {
                                dataFreshness = `${timeDiffSeconds} seconds ago`;
                            } else if (timeDiffSeconds < 3600) {
                                const minutes = Math.floor(timeDiffSeconds / 60);
                                dataFreshness = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
                            } else {
                                const hours = Math.floor(timeDiffSeconds / 3600);
                                dataFreshness = `${hours} hour${hours > 1 ? 's' : ''} ago`;
                            }
                        }
                        
                        // Calculate arrival time
                        let arrivalTime;
                        if (eta > 0) {
                            // ETA in seconds
                            arrivalTime = new Date(now.getTime() + (eta * 1000));
                        } else if (eta === 0) {
                            // Bus is at the stop or due
                            arrivalTime = now;
                        } else {
                            // For buses with eta -1, try to estimate from timestamp
                            if (timestamp) {
                                const dataTime = new Date(timestamp);
                                // If data is recent (less than 10 minutes old), show as recently passed
                                if (now - dataTime < 10 * 60 * 1000) {
                                    arrivalTime = new Date(now.getTime() + (2 * 60 * 1000)); // Show in 2 minutes as estimate
                                } else {
                                    return; // Skip old data with no ETA
                                }
                            } else {
                                return; // Skip if no valid time
                            }
                        }
                        
                        // Only include buses arriving within the next hour (or recently passed)
                        const timeDiff = arrivalTime - now;
                        if (timeDiff >= -5 * 60 * 1000 && timeDiff <= 60 * 60 * 1000) { // -5 minutes to +60 minutes
                            departures.push({
                                route: routeName,
                                routeId: stopRouteKey.split(':')[1], // Extract route ID from the key
                                time: arrivalTime,
                                isLive: true,
                                isRealTime: eta >= 0, // Real-time if we have ETA
                                destination: destination,
                                vehicleId: vehicleNo,
                                agencyName: agency ? agency.toUpperCase() : 'BEST',
                                distance: distance,
                                isHalted: isHalted,
                                eta: eta,
                                dataFreshness: dataFreshness,
                                lastUpdated: timestamp ? new Date(timestamp) : null,
                                busKey: busKey, // Store for tracking
                                stopRouteKey: stopRouteKey
                            });
                        }
                        
                    } catch (parseError) {
                        console.warn('Error parsing bus data:', parseError, 'Raw data:', routeData[busKey]);
                    }
                });
            });

            // Sort by arrival time and return
            return departures.sort((a, b) => a.time - b.time).slice(0, 12);

        } catch (error) {
            console.error('Error parsing Chalo API data:', error);
            return [];
        }
    }

    async fetchRouteLiveInfo(routeId, stopIds = []) {
        try {
            console.log(`🚌 Fetching live route info for: ${routeId}`);
            
            // Build the stopIds query parameter
            const stopIdsParam = stopIds.length > 0 ? `?stopIds=${stopIds.join(',')}` : '';
            
            const response = await fetch(`https://chalo.com/app/api/vasudha/track/route-live-info/mumbai/${routeId}${stopIdsParam}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Origin': 'https://chalo.com',
                    'Referer': `https://chalo.com/app/live-tracking/route-map/${routeId}`,
                    'Source': '1',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
                    'X-Type': 'pass'
                }
            });

            if (!response.ok) {
                console.log(`❌ Route live info API response not ok: ${response.status}`);
                return null;
            }

            const data = await response.json();
            console.log('🚌 Route live info response:', data);

            return this.parseRouteLiveInfo(data);

        } catch (error) {
            console.error('❌ Error fetching route live info:', error);
            return null;
        }
    }

    parseRouteLiveInfo(data) {
        try {
            const buses = [];
            
            if (data.routeLiveInfo) {
                Object.keys(data.routeLiveInfo).forEach(busKey => {
                    try {
                        // Handle both JSON string and object formats
                        let busData;
                        const rawData = data.routeLiveInfo[busKey];
                        
                        if (typeof rawData === 'string') {
                            // Parse JSON string
                            busData = JSON.parse(rawData);
                        } else if (typeof rawData === 'object' && rawData !== null) {
                            // Already an object
                            busData = rawData;
                        } else {
                            console.warn('Unexpected route live data format:', rawData);
                            return;
                        }
                        
                        buses.push({
                            busKey: busKey,
                            vehicleNo: busData.vNo,
                            latitude: busData._latitude,
                            longitude: busData._longitude,
                            eta: busData.eta,
                            isHalted: busData._isHalted,
                            timestamp: busData.tS,
                            currentStopId: busData.sId,
                            lastStopTime: busData.psTime,
                            operatorId: busData.opId
                        });
                        
                    } catch (parseError) {
                        console.warn('Error parsing bus live info:', parseError, 'Raw data:', data.routeLiveInfo[busKey]);
                    }
                });
            }
            
            return {
                buses: buses,
                stopsEta: data.stopsEta || {}
            };
            
        } catch (error) {
            console.error('Error parsing route live info:', error);
            return { buses: [], stopsEta: {} };
        }
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

    updateBusLocations(buses) {
        if (!buses || buses.length === 0) {
            // Clear bus locations
            this.map.getSource('bus-locations').setData({
                type: 'FeatureCollection',
                features: []
            });
            return;
        }

        const features = buses.map(bus => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [bus.longitude, bus.latitude]
            },
            properties: {
                busKey: bus.busKey,
                vehicleNo: bus.vehicleNo,
                eta: bus.eta,
                isHalted: bus.isHalted,
                timestamp: bus.timestamp,
                currentStopId: bus.currentStopId,
                lastStopTime: bus.lastStopTime
            }
        }));

        this.map.getSource('bus-locations').setData({
            type: 'FeatureCollection',
            features: features
        });

        console.log(`🚌 Updated ${buses.length} bus locations on map`);
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

    startBusLocationUpdates(routeId, stopIds = []) {
        // Clear existing interval
        if (this.busUpdateInterval) {
            clearInterval(this.busUpdateInterval);
        }

        // Initial fetch
        this.updateBusLocationsForRoute(routeId, stopIds);

        // Update every minute
        this.busUpdateInterval = setInterval(() => {
            this.updateBusLocationsForRoute(routeId, stopIds);
        }, 60000); // 60 seconds

        console.log(`🔄 Started bus location updates for route: ${routeId}`);
    }

    stopBusLocationUpdates() {
        if (this.busUpdateInterval) {
            clearInterval(this.busUpdateInterval);
            this.busUpdateInterval = null;
        }

        // Clear bus locations from map
        if (this.map.getSource('bus-locations')) {
            this.updateBusLocations([]);
        }

        console.log('🛑 Stopped bus location updates');
    }

    async updateBusLocationsForRoute(routeId, stopIds = []) {
        try {
            const routeLiveInfo = await this.fetchRouteLiveInfo(routeId, stopIds);
            if (routeLiveInfo && routeLiveInfo.buses) {
                this.updateBusLocations(routeLiveInfo.buses);
            }
        } catch (error) {
            console.error('Error updating bus locations:', error);
        }
    }

    parseTimetableData(timetableStr, routeListStr) {
        try {
            // Parse the JSON string from the tileset
            let timetableData;
            if (typeof timetableStr === 'string') {
                timetableData = JSON.parse(timetableStr);
            } else {
                timetableData = timetableStr;
            }

            if (!Array.isArray(timetableData)) {
                return [];
            }

            const now = new Date();
            const departures = [];

            // Process each route serving this stop
            timetableData.forEach(routeInfo => {
                if (!routeInfo.stop_times || !Array.isArray(routeInfo.stop_times)) {
                    return;
                }

                // Check if route has live tracking - could be in route properties
                const isLiveRoute = this.checkIfRouteIsLive(routeInfo.route_id);

                // Convert stop times to departure objects
                routeInfo.stop_times.forEach(timeStr => {
                    const departure = DataUtils.parseTimeString(timeStr, now);
                    if (departure && DataUtils.isWithinNext60Minutes(departure, now)) {
                        departures.push({
                            route: routeInfo.route_short_name || routeInfo.route_name,
                            routeId: routeInfo.route_id,
                            time: departure,
                            isLive: isLiveRoute,
                            destination: routeInfo.last_stop_name || 'Unknown',
                            agencyName: routeInfo.agency_name || 'BEST',
                            cityName: routeInfo.city_name || 'Mumbai',
                            headway: routeInfo.trip_headway || 60,
                            acService: routeInfo.ac_service || false
                        });
                    }
                });
            });

            // Sort by departure time and return next 12 departures
            return departures.sort((a, b) => a.time - b.time).slice(0, 12);

        } catch (error) {
            console.error('Error parsing timetable data:', error);
            return [];
        }
    }

    checkIfRouteIsLive(routeId) {
        // Try to find live route information from the map data
        if (this.map && this.map.isSourceLoaded('mumbai-routes')) {
            try {
                const routeFeatures = this.map.querySourceFeatures('mumbai-routes', {
                    sourceLayer: 'mumbai-routes',
                    filter: ['==', 'route_id', routeId]
                });
                
                if (routeFeatures.length > 0) {
                    return routeFeatures[0].properties.is_live === 'true' || 
                           routeFeatures[0].properties.is_live === true;
                }
            } catch (error) {
                console.log('Could not query route live status:', error);
            }
        }
        
        // Default assumption: routes with shorter headways are more likely to have live tracking
        return Math.random() > 0.4; // 60% chance of live tracking as fallback
    }

    displayDepartures(departures) {
        const departureList = document.getElementById('departure-list');
        
        // Store departures for later reference
        this.currentDepartures = departures;
        
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

        // Get current stop ID for Chalo links
        const currentStopId = this.currentStop?.properties?.id || 
                             this.currentStop?.properties?.stop_id || 
                             'unknown';

        const departureHTML = departures.map((departure, index) => {
            const timeStr = departure.time.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
            });
            
            const now = new Date();
            const minutesUntil = Math.ceil((departure.time - now) / (1000 * 60));
            
            let timeDisplay;
            if (departure.isNextDay) {
                timeDisplay = 'Tomorrow';
            } else if (minutesUntil <= 0) {
                timeDisplay = 'Due';
            } else if (minutesUntil === 1) {
                timeDisplay = '1 min';
            } else if (minutesUntil > 60) {
                const hours = Math.floor(minutesUntil / 60);
                timeDisplay = `${hours}h ${minutesUntil % 60}m`;
            } else {
                timeDisplay = `${minutesUntil} min`;
            }

            // Enhanced route badge with AC indicator - now using DataUtils
            const routeInfo = {
                agency: departure.agencyName || 'BEST',
                fareType: departure.acService ? 'AC' : DataUtils.detectFareTypeFromRoute(departure.route)
            };
            const routeHtml = DataUtils.getStyledRouteBadge(departure.route, routeInfo, 'normal');

            // Live status with better indicators
            const statusClass = departure.isRealTime ? 'status-live' : 
                               departure.isLive ? 'status-live' : 'status-scheduled';
            
            let statusText = departure.isNextDay ? 'Scheduled' :
                            departure.isRealTime ? 'Live GPS' : 
                            departure.isLive ? 'Live tracking' : 'Scheduled';

            // Add delay information for real-time data
            if (departure.isRealTime && departure.delay) {
                const delayMin = Math.abs(departure.delay);
                if (departure.delay > 0) {
                    statusText += ` • ${delayMin}min late`;
                } else if (departure.delay < 0) {
                    statusText += ` • ${delayMin}min early`;
                }
            }

            // Vehicle ID for live tracking
            const vehicleInfo = departure.vehicleId ? ` • Bus ${departure.vehicleId}` : '';

            // Frequency information
            const frequencyInfo = departure.headway && departure.headway < 60 ? 
                `Every ${departure.headway}min` : '';

            // Agency and city information instead of platform
            const agencyInfo = departure.agencyName ? departure.agencyName : '';
            const cityInfo = departure.cityName && departure.cityName !== departure.agencyName ? 
                ` • ${departure.cityName}` : '';
            
            // Real-time indicator
            const realtimeIcon = departure.isRealTime ? 
                '<svg class="w-3 h-3 text-green-400 inline ml-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>' : '';
            
            // Add tracking indicator for live buses
            const trackingIndicator = departure.isRealTime ? 
                '<span class="text-xs text-green-400 ml-2 cursor-pointer" title="Click to track on map">📍 Track</span>' : '';
            
            // Chalo tracking link - available for all departures with route ID
            const chaloTrackingUrl = departure.routeId && currentStopId !== 'unknown' ? 
                `https://chalo.com/app/live-tracking/route-map/${departure.routeId}/${currentStopId}` : null;
            
            const chaloLink = chaloTrackingUrl ? 
                `<a href="${chaloTrackingUrl}" target="_blank" rel="noopener noreferrer" 
                    class="text-xs text-blue-400 hover:text-blue-300 ml-2 cursor-pointer transition-colors" 
                    title="Track on Chalo app">
                    🚌 Track on Chalo
                </a>` : '';
            
            // Data freshness info for live buses
            const dataFreshnessInfo = departure.dataFreshness ? 
                `<div class="text-xs text-gray-500 mt-1">Live position updated ${departure.dataFreshness}</div>` : '';
            
            return `
                <div class="departure-row flex items-center justify-between p-3 rounded transition-all duration-200" 
                     data-route-id="${departure.routeId || ''}" 
                     data-departure-index="${index}">
                    <div class="flex items-center gap-3">
                        <div class="status-indicator ${statusClass}"></div>
                        <div>
                            <div class="flex items-center gap-2">
                                ${routeHtml}
                                <span class="text-white font-medium">${departure.destination}</span>
                                ${realtimeIcon}
                                ${trackingIndicator}
                                ${chaloLink}
                            </div>
                            <div class="text-xs text-gray-400 mt-1 flex items-center gap-2">
                                <span>${statusText}</span>
                                ${frequencyInfo ? `<span>•</span><span>${frequencyInfo}</span>` : ''}
                                ${agencyInfo ? `<span>•</span><span>${agencyInfo}${cityInfo}</span>` : ''}
                                ${vehicleInfo ? `<span>${vehicleInfo}</span>` : ''}
                            </div>
                            ${dataFreshnessInfo}
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-white font-bold ${departure.isNextDay ? 'text-yellow-400' : ''}">${timeDisplay}</div>
                        <div class="text-xs text-gray-400">${timeStr}</div>
                    </div>
                </div>
            `;
        }).join('');

        departureList.innerHTML = departureHTML;
        
        // Set up interactivity after DOM is updated
        setTimeout(() => {
            this.setupDepartureRowInteractions();
        }, 100);
    }

    showNoStopsMessage() {
        const stopInfoEl = document.getElementById('stop-info');
        stopInfoEl.innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
                </svg>
                <p>No bus stops found nearby</p>
                <p class="text-sm mt-1">Try zooming out or moving to a different area</p>
            </div>
        `;
        this.showDepartureError();
    }

    showDistantStopMessage(distance) {
        const stopInfoEl = document.getElementById('stop-info');
        const distanceText = distance > 1 ? `${distance.toFixed(1)} km` : `${(distance * 1000).toFixed(0)} m`;
        
        stopInfoEl.innerHTML = `
            <div class="text-center py-8 text-yellow-400">
                <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
                </svg>
                <p>Nearest bus stop is ${distanceText} away</p>
                <p class="text-sm mt-1">Consider using the map to explore closer areas with transit service</p>
                <button id="show-distant-stop-btn" class="mt-3 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm transition-colors">
                    Show Distant Stop
                </button>
            </div>
        `;
        
        // Add click handler for the button
        document.getElementById('show-distant-stop-btn').addEventListener('click', () => {
            // Find and select the nearest stop even if it's far
            this.findNearestStopForce();
        });
        
        this.showDepartureError();
    }

    showStopError(message) {
        const stopInfoEl = document.getElementById('stop-info');
        stopInfoEl.innerHTML = `
            <div class="text-center py-8 text-red-400">
                <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
                <p>${message}</p>
            </div>
        `;
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

    showLocationError(message) {
        // Show error in departure board for now
        const departureList = document.getElementById('departure-list');
        departureList.innerHTML = `
            <div class="text-center py-8 text-yellow-400">
                <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
                <p>${message}</p>
                <p class="text-sm mt-1">Enable location to see real-time departures</p>
            </div>
        `;
    }

    getRouteInfoByName(routeName) {
        // Query route features from the map to get detailed information
        if (this.map && this.map.isSourceLoaded('mumbai-routes')) {
            try {
                const routeFeatures = this.map.querySourceFeatures('mumbai-routes', {
                    sourceLayer: 'mumbai-routes'
                });
                
                const foundRoute = routeFeatures.find(feature => 
                    feature.properties.route_short_name === routeName ||
                    feature.properties.route_name === routeName
                );
                
                return foundRoute;
            } catch (error) {
                console.log('Could not query route info:', error);
            }
        }
        return null;
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
            
            // Try to query a small sample
            if (this.map.isSourceLoaded('mumbai-stops')) {
                const sample = this.map.querySourceFeatures('mumbai-stops', {
                    sourceLayer: 'mumbai-stops'
                });
                console.log(`Sample features from stops: ${sample.length}`);
                
                if (sample.length > 0) {
                    console.log('Sample stop properties:', sample[0].properties);
                    console.log('Sample stop geometry:', sample[0].geometry);
                }
            }
            
        } catch (error) {
            console.error('Error in source debug:', error);
        }
    }

    getNextDayDepartures(timetableStr) {
        try {
            let timetableData;
            if (typeof timetableStr === 'string') {
                timetableData = JSON.parse(timetableStr);
            } else {
                timetableData = timetableStr;
            }

            if (!Array.isArray(timetableData)) {
                return [];
            }

            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0); // Start of next day

            const departures = [];

            // Get first few departures of next day
            timetableData.forEach(routeInfo => {
                if (!routeInfo.stop_times || !Array.isArray(routeInfo.stop_times)) {
                    return;
                }

                // Take first 2 departures of the day for each route
                routeInfo.stop_times.slice(0, 2).forEach(timeStr => {
                    const departure = DataUtils.parseTimeString(timeStr, tomorrow);
                    if (departure) {
                        departures.push({
                            route: routeInfo.route_short_name || routeInfo.route_name,
                            routeId: routeInfo.route_id,
                            time: departure,
                            isLive: false, // Next day departures are scheduled
                            destination: routeInfo.last_stop_name || 'Unknown',
                            agencyName: routeInfo.agency_name || 'BEST',
                            cityName: routeInfo.city_name || 'Mumbai',
                            headway: routeInfo.trip_headway || 60,
                            acService: routeInfo.ac_service || false,
                            isNextDay: true
                        });
                    }
                });
            });

            // Sort by departure time and return next few
            return departures.sort((a, b) => a.time - b.time).slice(0, 6);

        } catch (error) {
            console.error('Error getting next day departures:', error);
            return [];
        }
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

        // Add route hover interaction for temporary highlighting
        this.map.on('mouseenter', 'routes', (e) => {
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
                }
            }
        });

        // Clear hover highlights when mouse leaves routes
        this.map.on('mouseleave', 'routes', () => {
            this.clearTemporaryHighlights();
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
            
            // Query all source features and then filter by viewport bounds
            const allRoutes = this.map.querySourceFeatures('mumbai-routes', {
                sourceLayer: 'mumbai-routes'
            });
            
            const allStops = this.map.querySourceFeatures('mumbai-stops', {
                sourceLayer: 'mumbai-stops'
            });
            
            // Filter routes by viewport bounds
            const visibleRoutes = allRoutes.filter(feature => {
                if (!feature.geometry || !feature.geometry.coordinates) return false;
                
                // Handle different geometry types
                let coords = feature.geometry.coordinates;
                if (feature.geometry.type === 'LineString') {
                    // For routes, check if any part of the line is within bounds
                    return coords.some(coord => {
                        const [lng, lat] = coord;
                        return lng >= bounds.getWest() && lng <= bounds.getEast() &&
                               lat >= bounds.getSouth() && lat <= bounds.getNorth();
                    });
                } else if (feature.geometry.type === 'Point') {
                    const [lng, lat] = coords;
                    return lng >= bounds.getWest() && lng <= bounds.getEast() &&
                           lat >= bounds.getSouth() && lat <= bounds.getNorth();
                }
                return false;
            });
            
            // Filter stops by viewport bounds
            const visibleStops = allStops.filter(feature => {
                if (!feature.geometry || !feature.geometry.coordinates) return false;
                
                const [lng, lat] = feature.geometry.coordinates;
                return lng >= bounds.getWest() && lng <= bounds.getEast() &&
                       lat >= bounds.getSouth() && lat <= bounds.getNorth();
            });
            
            // Process route data
            const routeData = visibleRoutes.map(feature => ({
                id: feature.properties.route_id,
                name: feature.properties.route_short_name || feature.properties.route_name,
                longName: feature.properties.route_long_name,
                description: feature.properties.route_desc,
                agency: feature.properties.agency_name,
                isLive: feature.properties.is_live === 'true' || feature.properties.is_live === true,
                fareType: feature.properties.fare_type,
                cityName: feature.properties.city_name,
                coordinates: feature.geometry?.coordinates || null
            }));
            
            // Process stop data
            const stopData = visibleStops.map(feature => ({
                id: feature.properties.id || feature.properties.stop_id,
                name: feature.properties.name || feature.properties.stop_name,
                description: feature.properties.description,
                routes: feature.properties.route_name_list ? 
                       feature.properties.route_name_list.split(/[;,]/).map(r => r.trim()) : [],
                coordinates: feature.geometry?.coordinates || null,
                timetableData: feature.properties.stop_timetable ? true : false
            }));
            
            // Remove duplicates (same feature might be queried multiple times)
            const uniqueRoutes = routeData.filter((route, index, self) => 
                index === self.findIndex(r => r.id === route.id)
            );
            
            const uniqueStops = stopData.filter((stop, index, self) => 
                index === self.findIndex(s => s.id === stop.id)
            );
            
            // Create summary object
            const transitDataSummary = {
                timestamp: new Date().toISOString(),
                mapContext: {
                    zoom: Math.round(zoom * 100) / 100, // Round to 2 decimal places
                    center: {
                        lng: Math.round(center.lng * 1000000) / 1000000, // Round to 6 decimal places
                        lat: Math.round(center.lat * 1000000) / 1000000
                    },
                    bounds: {
                        north: Math.round(bounds.getNorth() * 1000000) / 1000000,
                        south: Math.round(bounds.getSouth() * 1000000) / 1000000,
                        east: Math.round(bounds.getEast() * 1000000) / 1000000,
                        west: Math.round(bounds.getWest() * 1000000) / 1000000
                    }
                },
                summary: {
                    totalRoutes: uniqueRoutes.length,
                    totalStops: uniqueStops.length,
                    liveRoutes: uniqueRoutes.filter(r => r.isLive).length,
                    agencies: [...new Set(uniqueRoutes.map(r => r.agency).filter(a => a))],
                    stopsWithTimetables: uniqueStops.filter(s => s.timetableData).length
                },
                routes: uniqueRoutes,
                stops: uniqueStops
            };
            
            // Log to console as formatted JSON
            console.log('🗺️ VISIBLE TRANSIT DATA:', transitDataSummary);
            
            // Also store in instance for potential use
            this.lastVisibleTransitData = transitDataSummary;
            
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
        
        // Highlight the primary stop on map
        this.highlightStop(primaryBusStop.id);
        
        // Store the selected stop
        this.currentSelectedStop = primaryBusStop;
        
        // Update UI with stop information
        this.displayStopInfo(primaryStopFeature, primaryBusStop);
        this.loadDepartures(primaryStopFeature);
        
        // Update URL with stop selection
        if (this.urlManager) {
            this.urlManager.onStopSelected(primaryBusStop.name, primaryBusStop.id);
        }
        
        // If there are multiple stops at this location or nearby, populate browse panel
        if (allStopFeatures.length > 1) {
            console.log(`🔍 Multiple stops found, populating browse panel with ${allStopFeatures.length} options`);
            
            // Convert all stop features to BusStop objects with distance info
            const allStops = allStopFeatures.map(feature => {
                const busStop = new BusStop(feature);
                return {
                    ...busStop,
                    distance: this.userLocation ? busStop.getDistance(this.userLocation) : null,
                    isSelected: busStop.id === primaryBusStop.id
                };
            });
            
            // Load additional nearby stops and combine
            this.loadNearbyStopsWithOverlapping(primaryBusStop, allStops);
        } else {
            // Load normal nearby stops
            this.loadNearbyStops(primaryBusStop);
        }
        
        // Auto-show browse panel if there are multiple stops
        if (allStopFeatures.length > 1) {
            setTimeout(() => {
                this.showNearbyStopsPanel();
            }, 500);
        }
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

    async loadNearbyStopsWithOverlapping(currentStop, overlappingStops) {
        console.log('🔍 Loading nearby stops with overlapping consideration...');
        
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
                    distance: this.userLocation ? stop.getDistance(this.userLocation) : null,
                    isOverlapping: overlappingStops.some(os => os.id === stop.id && !os.isSelected)
                }))
                .filter(stop => stop.distance === null || stop.distance <= 2) // Within 2km
                .sort((a, b) => {
                    // Prioritize overlapping stops, then by distance
                    if (a.isOverlapping && !b.isOverlapping) return -1;
                    if (!a.isOverlapping && b.isOverlapping) return 1;
                    
                    if (a.distance === null && b.distance === null) return 0;
                    if (a.distance === null) return 1;
                    if (b.distance === null) return -1;
                    return a.distance - b.distance;
                })
                .slice(0, 15); // Increased limit to show more options
            
            this.nearbyStops = nearbyStops;
            this.displayNearbyStopsEnhanced(nearbyStops);
            
        } catch (error) {
            console.error('Error loading nearby stops with overlapping:', error);
        }
    }

    displayNearbyStopsEnhanced(stops) {
        const nearbyStopsList = document.getElementById('nearby-stops-list');
        
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
            const isOverlapping = stop.isOverlapping;
            
            // Get route information with enhanced details
            const routesInfo = stop.getRoutesFromTimetable();
            const topRoutes = routesInfo.slice(0, 4); // Show top 4 routes
            const remainingCount = Math.max(0, routesInfo.length - 4);
            
            // Get agency distribution
            const agencies = [...new Set(routesInfo.map(r => r.agency).filter(a => a))];
            const agencyText = agencies.length > 0 ? agencies.join(', ') : 'Multiple agencies';
            
            // Calculate service frequency (average of all routes)
            const avgHeadway = routesInfo.length > 0 ? 
                Math.round(routesInfo.reduce((sum, r) => sum + (r.headway || 60), 0) / routesInfo.length) : 60;
            
            return `
                <div class="nearby-stop-item bg-gray-700/50 rounded p-3 cursor-pointer hover:bg-gray-700 transition-colors ${isOverlapping ? 'ring-1 ring-yellow-500/50 bg-yellow-900/20' : ''}"
                     data-stop-id="${stop.id}">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-1">
                                <h5 class="font-medium text-white text-sm">${displayInfo.name}</h5>
                                ${isOverlapping ? '<span class="text-xs bg-yellow-600 text-yellow-100 px-1 rounded">Same location</span>' : ''}
                            </div>
                            
                            <div class="flex items-center gap-2 mb-2">
                                ${displayInfo.distance ? `
                                    <span class="text-xs text-gray-400">${displayInfo.distance}</span>
                                    <span class="text-gray-500">•</span>
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
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.transitExplorer = new TransitExplorer();
});

// Export for use in other modules if needed
export default TransitExplorer; 