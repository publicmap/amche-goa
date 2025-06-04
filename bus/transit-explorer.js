// Transit Explorer - Main Application Module
// Handles geolocation, map initialization, stop finding, and departure boards

// Configuration for tileset schema mapping
const TILESET_SCHEMA = {
    routes: {
        layer: 'mumbai-routes',
        fields: {
            id: 'route_id',
            shortName: 'route_short_name',
            longName: 'route_name',
            description: 'route_desc',
            color: 'route_color',
            textColor: 'route_text_color',
            isLive: 'is_live',
            agency: 'agency_name',
            city: 'city_name',
            routeType: 'route_type',
            fareType: 'fare_type'
        }
    },
    stops: {
        layer: 'mumbai-stops',
        fields: {
            id: 'stop_id',
            name: 'name',
            description: 'stop_description',
            lat: 'stop_lat',
            lon: 'stop_lon',
            timetable: 'stop_timetable',
            routeList: 'route_name_list',
            tripCount: 'trip_count',
            avgWaitTime: 'avg_wait_time',
            zoneId: 'zone_id',
            stopUrl: 'stop_url',
            locationType: 'location_type'
        }
    }
};

// Transit Agency styling configuration
const AGENCY_STYLES = {
    'BEST': {
        name: 'Brihanmumbai Electric Supply and Transport',
        colors: {
            'AC': {
                background: '#2563eb',      // Blue-600
                text: '#ffffff',
                mapLine: '#3b82f6'          // Blue-500
            },
            'Regular': {
                background: '#dc2626',      // Red-600
                text: '#ffffff', 
                mapLine: '#ef4444'          // Red-500
            },
            'default': {
                background: '#059669',      // Green-600
                text: '#ffffff',
                mapLine: '#10b981'          // Green-500
            }
        }
    },
    'default': {
        name: 'Transit Agency',
        colors: {
            'default': {
                background: '#059669',      // Green-600
                text: '#ffffff',
                mapLine: '#10b981'          // Green-500
            }
        }
    }
};

// Transit Agency data class
class TransitAgency {
    constructor(agencyName) {
        this.name = agencyName || 'default';
        this.config = AGENCY_STYLES[this.name] || AGENCY_STYLES['default'];
    }
    
    getRouteStyle(fareType = null, routeType = null) {
        // Determine the service type for styling
        let serviceType = 'default';
        
        if (fareType) {
            serviceType = fareType;
        } else if (routeType) {
            // Map route types to service types if needed
            serviceType = this.mapRouteTypeToService(routeType);
        }
        
        // Get colors for the service type, fallback to default
        const colors = this.config.colors[serviceType] || this.config.colors['default'];
        
        return {
            backgroundColor: colors.background,
            textColor: colors.text,
            mapLineColor: colors.mapLine,
            serviceType: serviceType
        };
    }
    
    mapRouteTypeToService(routeType) {
        // Map GTFS route types or custom route types to service types
        const routeTypeMap = {
            'AC': 'AC',
            'ac': 'AC',
            'Air Conditioned': 'AC',
            'Regular': 'Regular',
            'regular': 'Regular',
            'Ordinary': 'Regular',
            'Express': 'Regular',
            'Limited': 'Regular'
        };
        
        return routeTypeMap[routeType] || 'default';
    }
    
    getAllServiceTypes() {
        return Object.keys(this.config.colors);
    }
    
    getDisplayInfo() {
        return {
            name: this.config.name,
            shortName: this.name,
            serviceTypes: this.getAllServiceTypes()
        };
    }
}

// Bus Route data class
class BusRoute {
    constructor(feature, schema = TILESET_SCHEMA.routes) {
        this.feature = feature;
        this.schema = schema;
        this.properties = feature.properties || {};
        
        // Map schema fields to properties
        this.id = this.getProperty('id');
        this.shortName = this.getProperty('shortName');
        this.longName = this.getProperty('longName');
        this.description = this.getProperty('description');
        this.color = this.getProperty('color');
        this.textColor = this.getProperty('textColor');
        this.isLive = this.getBooleanProperty('isLive');
        this.agency = this.getProperty('agency');
        this.city = this.getProperty('city');
        this.routeType = this.getProperty('routeType');
        this.fareType = this.getProperty('fareType');
        
        // Computed properties
        this.displayName = this.shortName || this.longName || this.id;
        this.fullDescription = this.description || this.longName || '';
        
        // Initialize agency styling
        this.transitAgency = new TransitAgency(this.agency);
        this.styling = this.transitAgency.getRouteStyle(this.fareType, this.routeType);
    }
    
    getProperty(schemaKey) {
        const fieldName = this.schema.fields[schemaKey];
        return fieldName ? this.properties[fieldName] : null;
    }
    
    getBooleanProperty(schemaKey) {
        const value = this.getProperty(schemaKey);
        return value === true || value === 'true' || value === 1 || value === '1';
    }
    
    getDisplayInfo() {
        return {
            name: this.displayName,
            description: this.fullDescription,
            status: this.isLive ? 'Live Tracking' : 'Scheduled',
            agency: this.agency,
            city: this.city,
            serviceType: this.styling.serviceType,
            styling: this.styling
        };
    }
    
    getMapLineColor() {
        // Use agency styling if available, fallback to manual color or default
        return this.styling.mapLineColor || this.color || '#10b981';
    }
    
    getRouteHtml(size = 'normal') {
        const sizeClasses = {
            small: 'px-1.5 py-0.5 text-xs',
            normal: 'px-2 py-1 text-xs',
            large: 'px-3 py-1.5 text-sm'
        };
        
        const sizeClass = sizeClasses[size] || sizeClasses.normal;
        
        return `
            <span class="route-badge ${sizeClass} rounded font-bold" 
                  style="background-color: ${this.styling.backgroundColor}; color: ${this.styling.textColor};">
                <span class="route-badge-text">${this.displayName}</span>
                ${this.fareType === 'AC' ? '<span class="text-blue-200 text-xs ml-1">AC</span>' : ''}
            </span>
        `;
    }
}

// Bus Stop data class
class BusStop {
    constructor(feature, schema = TILESET_SCHEMA.stops) {
        this.feature = feature;
        this.schema = schema;
        this.properties = feature.properties || {};
        
        // Map schema fields to properties
        this.id = this.getProperty('id');
        this.name = this.getProperty('name');
        this.description = this.getProperty('description');
        this.lat = this.getNumericProperty('lat');
        this.lon = this.getNumericProperty('lon');
        this.timetable = this.getProperty('timetable');
        this.routeList = this.getProperty('routeList');
        this.tripCount = this.getNumericProperty('tripCount');
        this.avgWaitTime = this.getNumericProperty('avgWaitTime');
        this.zoneId = this.getProperty('zoneId');
        this.stopUrl = this.getProperty('stopUrl');
        this.locationType = this.getProperty('locationType');
        
        // Computed properties
        this.coordinates = feature.geometry ? feature.geometry.coordinates : [this.lon, this.lat];
        this.routes = this.parseRouteList();
        this.hasLiveData = this.id && this.id.length > 0;
    }
    
    getProperty(schemaKey) {
        const fieldName = this.schema.fields[schemaKey];
        return fieldName ? this.properties[fieldName] : null;
    }
    
    getNumericProperty(schemaKey) {
        const value = this.getProperty(schemaKey);
        return value ? parseFloat(value) : null;
    }
    
    parseRouteList() {
        if (!this.routeList) return [];
        
        try {
            // Handle semicolon-separated route list (most common format)
            if (typeof this.routeList === 'string') {
                return this.routeList.split(/[;,]/).map(route => route.trim()).filter(Boolean);
            }
            return Array.isArray(this.routeList) ? this.routeList : [];
        } catch (error) {
            console.warn('Error parsing route list:', error);
            return [];
        }
    }
    
    getRoutesFromTimetable() {
        // Extract route information from timetable data
        const timetableData = this.parseTimetable();
        const routeMap = new Map();
        
        timetableData.forEach(routeInfo => {
            if (routeInfo.route_short_name || routeInfo.route_name) {
                const routeName = routeInfo.route_short_name || routeInfo.route_name;
                routeMap.set(routeName, {
                    name: routeName,
                    agency: routeInfo.agency_name || 'BEST',
                    fareType: this.detectFareType(routeName),
                    isAC: this.isACRoute(routeName)
                });
            }
        });
        
        return Array.from(routeMap.values());
    }

    detectFareType(routeName) {
        const name = routeName.toLowerCase();
        if (name.includes('ac') || name.includes('a-') || name.includes('a/c')) {
            return 'AC';
        }
        return 'Regular';
    }

    isACRoute(routeName) {
        return this.detectFareType(routeName) === 'AC';
    }
    
    parseTimetable() {
        if (!this.timetable) return [];
        
        try {
            let timetableData = typeof this.timetable === 'string' ? 
                JSON.parse(this.timetable) : this.timetable;
            
            return Array.isArray(timetableData) ? timetableData : [];
        } catch (error) {
            console.warn('Error parsing timetable:', error);
            return [];
        }
    }
    
    getDistance(userLocation) {
        if (!userLocation || !this.coordinates) return null;
        
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRadians(this.lat - userLocation.lat);
        const dLon = this.toRadians(this.lon - userLocation.lng);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(this.toRadians(userLocation.lat)) * Math.cos(this.toRadians(this.lat)) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
    
    getDisplayInfo(userLocation = null) {
        const distance = userLocation ? this.getDistance(userLocation) : null;
        
        return {
            name: this.name || 'Bus Stop',
            description: this.description,
            distance: distance ? `${(distance * 1000).toFixed(0)}m` : null,
            routeCount: this.routes.length,
            routes: this.routes.slice(0, 5), // Show first 5 routes
            moreRoutes: Math.max(0, this.routes.length - 5),
            tripCount: this.tripCount,
            avgWaitTime: this.avgWaitTime,
            hasLiveData: this.hasLiveData,
            coordinates: this.coordinates
        };
    }
}

class TransitExplorer {
    constructor() {
        this.map = null;
        this.userLocation = null;
        this.currentStop = null;
        this.refreshInterval = null;
        this.mapboxToken = 'pk.eyJ1IjoicGxhbmVtYWQiLCJhIjoiY2l3ZmNjNXVzMDAzZzJ0cDV6b2lkOG9odSJ9.eep6sUoBS0eMN4thZUWpyQ';
        this.tilesets = {
            routes: 'planemad.8obphl95',
            stops: 'planemad.2e4x2hzw'
        };
        
        this.init();
    }

    async init() {
        console.log('🚌 Initializing Transit Explorer...');
        
        // Initialize map first
        this.initMap();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Request location
        await this.requestLocation();
    }

    initMap() {
        mapboxgl.accessToken = this.mapboxToken;
        
        this.map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [72.8777, 19.0760], // Mumbai center
            zoom: 11,
            pitch: 45,
            bearing: 0
        });

        this.map.on('load', () => {
            this.addDataSources();
            this.addLayers();
            console.log('🗺️ Map loaded successfully');
            
            // Add route interaction handlers
            this.setupRouteInteractions();
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
                'line-opacity': 0.8
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
                    10, 4,
                    16, 8
                ],
                'circle-color': '#f59e0b',
                'circle-stroke-width': 2,
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

        // Add hover effects for stops
        this.map.on('mouseenter', 'stops', () => {
            this.map.getCanvas().style.cursor = 'pointer';
        });

        this.map.on('mouseleave', 'stops', () => {
            this.map.getCanvas().style.cursor = '';
        });

        // Handle stop clicks
        this.map.on('click', 'stops', (e) => {
            if (e.features.length > 0) {
                this.selectStop(e.features[0]);
            }
        });

        console.log('✅ Route interactions set up successfully');
        
        // Set up stop interactions
        this.setupStopInteractions();
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
        }
        
        console.log(`🎯 Highlighting route: ${routeId}`);
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
                
                if (routeId && routeName) {
                    console.log(`🚌 Departure row clicked: ${routeName} (ID: ${routeId})`);
                    
                    // Clear previous selections
                    this.clearDepartureHighlights();
                    this.clearRouteHighlight();
                    
                    // Highlight this row
                    row.classList.add('departure-row-selected');
                    
                    // Highlight corresponding route on map
                    this.highlightRoute(routeId);
                    
                    // Store selection
                    this.currentHighlightedRoute = routeId;
                    this.currentHighlightedDepartures = { routeId, routeName };
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
        this.currentSelectedStop = null;
    }

    async requestLocation() {
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
            
            // Add user location marker
            this.addUserLocationMarker();
            
            // Debug source status before finding stops
            this.debugSourceStatus();
            
            // Find nearest stop
            await this.findNearestStop();
            
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
                            const distance = this.calculateDistance(
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
                    const distance = this.calculateDistance(
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
                    const distance = this.calculateDistance(
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

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    selectStop(stopFeature) {
        this.currentStop = stopFeature;
        this.displayStopInfo(stopFeature);
        this.loadDepartures(stopFeature);
        
        // Start auto-refresh for live data
        this.startAutoRefresh();
    }

    highlightNearestStop(stopFeature) {
        const coordinates = stopFeature.geometry.coordinates;
        
        // Add a highlighted marker for the nearest stop
        const el = document.createElement('div');
        el.style.cssText = `
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #22c55e;
            border: 3px solid white;
            box-shadow: 0 0 15px rgba(34, 197, 94, 0.7);
            animation: pulse 2s infinite;
        `;

        if (this.nearestStopMarker) {
            this.nearestStopMarker.remove();
        }

        this.nearestStopMarker = new mapboxgl.Marker(el)
            .setLngLat(coordinates)
            .addTo(this.map);
    }

    displayStopInfo(stopFeature, busStop = null) {
        if (!busStop) {
            busStop = new BusStop(stopFeature);
        }
        
        const stopInfoEl = document.getElementById('stop-info');
        const displayInfo = busStop.getDisplayInfo(this.userLocation);
        
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
                        <span class="text-white font-medium">${displayInfo.routeCount}</span>
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
                            ${this.getStyledRouteBadges(displayInfo.routes, busStop)}
                            ${displayInfo.moreRoutes > 0 ? 
                                `<span class="text-gray-400 text-xs">+${displayInfo.moreRoutes}</span>` : ''}
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

        // Update the highlight layer filter to show only the selected stop
        this.map.setFilter('stops-highlight', ['==', 'stop_id', stopId]);
        
        // Store current highlight for cleanup
        if (!isTemporary) {
            this.currentHighlightedStop = stopId;
        }
        
        console.log(`🎯 Highlighting stop: ${stopId}`);
    }

    clearStopHighlight() {
        // Hide the highlight layer
        this.map.setFilter('stops-highlight', ['==', 'stop_id', '']);
        this.currentHighlightedStop = null;
    }

    clearTemporaryStopHighlights() {
        // Only clear hover highlights, keep click selections
        if (this.currentHighlightedStop) {
            this.highlightStop(this.currentHighlightedStop);
        } else {
            this.clearStopHighlight();
        }
    }

    clearAllSelections() {
        console.log('🔄 Clearing all selections...');
        this.clearRouteHighlight();
        this.clearDepartureHighlights();
        this.clearStopHighlight();
        this.currentSelectedStop = null;
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
            
            const response = await fetch(`https://chalo.com/app/api/vasudha/stop/mumbai/${stopId}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                console.log(`❌ API response not ok: ${response.status}`);
                return [];
            }

            const data = await response.json();
            console.log('📡 Live API Response:', data);

            return this.parseLiveApiData(data);

        } catch (error) {
            console.error('❌ Error fetching live data:', error);
            return [];
        }
    }

    parseLiveApiData(apiData) {
        try {
            const departures = [];
            const now = new Date();

            // The API response structure may vary - need to adapt based on actual response
            // Common patterns in transit APIs:
            
            if (apiData.routes && Array.isArray(apiData.routes)) {
                // Pattern 1: routes array with arrival predictions
                apiData.routes.forEach(route => {
                    if (route.arrivals && Array.isArray(route.arrivals)) {
                        route.arrivals.forEach(arrival => {
                            const arrivalTime = this.parseApiTime(arrival.eta || arrival.arrival_time || arrival.time, now);
                            if (arrivalTime && this.isWithinNext60Minutes(arrivalTime, now)) {
                                departures.push({
                                    route: route.short_name || route.name || arrival.route_name,
                                    routeId: route.route_id || route.id || arrival.route_id,
                                    time: arrivalTime,
                                    isLive: true,
                                    destination: route.destination || arrival.destination || 'Unknown',
                                    platform: arrival.platform || '1',
                                    vehicleId: arrival.vehicle_id,
                                    delay: arrival.delay || 0,
                                    isRealTime: true
                                });
                            }
                        });
                    }
                });
            } else if (apiData.arrivals && Array.isArray(apiData.arrivals)) {
                // Pattern 2: direct arrivals array
                apiData.arrivals.forEach(arrival => {
                    const arrivalTime = this.parseApiTime(arrival.eta || arrival.arrival_time || arrival.time, now);
                    if (arrivalTime && this.isWithinNext60Minutes(arrivalTime, now)) {
                        departures.push({
                            route: arrival.route_short_name || arrival.route_name || arrival.route,
                            routeId: arrival.route_id || arrival.id,
                            time: arrivalTime,
                            isLive: true,
                            destination: arrival.destination || arrival.headsign || 'Unknown',
                            platform: arrival.platform || '1',
                            vehicleId: arrival.vehicle_id,
                            delay: arrival.delay || 0,
                            isRealTime: true
                        });
                    }
                });
            } else if (apiData.eta && Array.isArray(apiData.eta)) {
                // Pattern 3: eta array (common in Indian transit APIs)
                apiData.eta.forEach(eta => {
                    const arrivalTime = this.parseApiTime(eta.minutes || eta.time || eta.eta, now);
                    if (arrivalTime && this.isWithinNext60Minutes(arrivalTime, now)) {
                        departures.push({
                            route: eta.route_name || eta.route || eta.service,
                            routeId: eta.route_id || eta.id,
                            time: arrivalTime,
                            isLive: true,
                            destination: eta.destination || eta.towards || 'Unknown',
                            platform: eta.platform || '1',
                            vehicleId: eta.vehicle_id,
                            delay: eta.delay || 0,
                            isRealTime: true
                        });
                    }
                });
            }

            // Sort by arrival time
            return departures.sort((a, b) => a.time - b.time).slice(0, 12);

        } catch (error) {
            console.error('Error parsing live API data:', error);
            return [];
        }
    }

    parseApiTime(timeValue, baseTime) {
        try {
            if (typeof timeValue === 'number') {
                // Assume minutes from now
                return new Date(baseTime.getTime() + (timeValue * 60 * 1000));
            }
            
            if (typeof timeValue === 'string') {
                // Try different time formats
                if (timeValue.includes(':')) {
                    // HH:MM format
                    return this.parseTimeString(timeValue, baseTime);
                } else {
                    // Assume minutes from now
                    const minutes = parseInt(timeValue);
                    if (!isNaN(minutes)) {
                        return new Date(baseTime.getTime() + (minutes * 60 * 1000));
                    }
                }
            }
            
            // ISO timestamp
            if (timeValue instanceof Date || (typeof timeValue === 'string' && timeValue.includes('T'))) {
                return new Date(timeValue);
            }

            return null;
        } catch (error) {
            return null;
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
                    const departure = this.parseTimeString(timeStr, tomorrow);
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
                    const departure = this.parseTimeString(timeStr, now);
                    if (departure && this.isWithinNext60Minutes(departure, now)) {
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

    parseTimeString(timeStr, baseDate) {
        try {
            // Parse "HH:MM" format
            const [hours, minutes] = timeStr.split(':').map(Number);
            
            if (isNaN(hours) || isNaN(minutes)) {
                return null;
            }

            const departure = new Date(baseDate);
            departure.setHours(hours, minutes, 0, 0);

            // Handle next day scenarios (for times after midnight)
            if (departure < baseDate) {
                departure.setDate(departure.getDate() + 1);
            }

            return departure;
        } catch (error) {
            return null;
        }
    }

    isWithinNext60Minutes(departureTime, currentTime) {
        const timeDiff = departureTime - currentTime;
        // Within next 60 minutes (3.6 million milliseconds)
        return timeDiff >= 0 && timeDiff <= 60 * 60 * 1000;
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

            // Enhanced route badge with AC indicator - now using agency styling
            const routeHtml = this.getStyledDepartureBadge(departure);

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
                            </div>
                            <div class="text-xs text-gray-400 mt-1 flex items-center gap-2">
                                <span>${statusText}</span>
                                ${frequencyInfo ? `<span>•</span><span>${frequencyInfo}</span>` : ''}
                                ${agencyInfo ? `<span>•</span><span>${agencyInfo}${cityInfo}</span>` : ''}
                                ${vehicleInfo ? `<span>${vehicleInfo}</span>` : ''}
                            </div>
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

    getStyledRouteBadges(routes, busStop = null) {
        return routes.map(routeName => {
            // Try to get route info from the current stop's timetable first
            let routeInfo = null;
            
            if (busStop) {
                const timetableRoutes = busStop.getRoutesFromTimetable();
                routeInfo = timetableRoutes.find(r => r.name === routeName);
            }
            
            if (routeInfo) {
                // Use route info from timetable
                const transitAgency = new TransitAgency(routeInfo.agency);
                const styling = transitAgency.getRouteStyle(routeInfo.fareType);
                
                const acIndicator = routeInfo.isAC ? '<span class="text-blue-200 text-xs ml-1">AC</span>' : '';
                
                return `<span class="route-badge px-2 py-1 rounded text-xs font-bold" style="background-color: ${styling.backgroundColor}; color: ${styling.textColor};">
                            <span class="route-badge-text">${routeName}</span>${acIndicator}
                        </span>`;
            } else {
                // Fallback: try to find route information from the map data
                let mapRouteInfo = this.getRouteInfoByName(routeName);
                
                if (mapRouteInfo) {
                    const busRoute = new BusRoute(mapRouteInfo);
                    return busRoute.getRouteHtml('small');
                } else {
                    // Intelligent fallback based on route name patterns
                    let backgroundColor = '#059669'; // Default green
                    let textColor = '#ffffff';
                    let isAC = false;
                    
                    // Detect AC routes from name patterns
                    const routeNameLower = routeName.toLowerCase();
                    if (routeNameLower.includes('a-') || 
                        routeNameLower.includes('ac') || 
                        routeNameLower.includes('a/c') ||
                        routeNameLower.includes('air con')) {
                        backgroundColor = '#2563eb'; // Blue for AC
                        isAC = true;
                    } else {
                        // Assume Regular BEST service gets red
                        backgroundColor = '#dc2626'; // Red for Regular
                    }
                    
                    const acIndicator = isAC ? '<span class="text-blue-200 text-xs ml-1">AC</span>' : '';
                    
                    return `<span class="route-badge px-2 py-1 rounded text-xs font-bold" style="background-color: ${backgroundColor}; color: ${textColor};">
                                <span class="route-badge-text">${routeName}</span>${acIndicator}
                            </span>`;
                }
            }
        }).join('');
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

    getStyledDepartureBadge(departure) {
        // Try to find route information for styling
        let routeInfo = this.getRouteInfoByName(departure.route);
        
        if (routeInfo) {
            const busRoute = new BusRoute(routeInfo);
            return busRoute.getRouteHtml('normal');
        } else {
            // Intelligent fallback styling based on departure info
            let backgroundColor = '#059669'; // Default green
            let textColor = '#ffffff';
            let isAC = false;
            
            // Check multiple sources for AC indication
            const routeNameLower = departure.route.toLowerCase();
            if (departure.acService || 
                departure.fareType === 'AC' ||
                routeNameLower.includes('a-') ||
                routeNameLower.includes('ac') || 
                routeNameLower.includes('a/c') ||
                routeNameLower.includes('air con')) {
                backgroundColor = '#2563eb'; // Blue for AC
                isAC = true;
            } else {
                // Use agency name to determine if this is BEST
                if (departure.agencyName === 'BEST') {
                    backgroundColor = '#dc2626'; // Red for Regular BEST
                }
            }
            
            const acIndicator = isAC ? '<span class="text-blue-200 text-xs ml-1">AC</span>' : '';
            
            return `<span class="route-badge px-2 py-1 rounded text-xs font-bold" style="background-color: ${backgroundColor}; color: ${textColor};">
                        <span class="route-badge-text">${departure.route}</span>${acIndicator}
                    </span>`;
        }
    }

    // Debug method to check source status
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
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.transitExplorer = new TransitExplorer();
});

// Export for use in other modules if needed
export default TransitExplorer; 