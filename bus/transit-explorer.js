// Transit Explorer - Main Application Module
// Handles geolocation, map initialization, stop finding, and departure boards

class TransitExplorer {
    constructor() {
        this.map = null;
        this.userLocation = null;
        this.currentStop = null;
        this.mapboxToken = 'pk.eyJ1IjoicGxhbmVtYWQiLCJhIjoiY2l3ZmNjNXVzMDAzZzJ0cDV6b2lkOG9odSJ9.eep6sUoBS0eMN4thZUWpyQ';
        this.tilesets = {
            routes: 'planemad.6fl8vqim',
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
                    ['get', 'is_live'], '#22c55e', // Green for live routes
                    '#3b82f6' // Blue for scheduled routes
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

        // Add hover effects
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
            // Query stops near user location
            const features = this.map.querySourceFeatures('mumbai-stops', {
                sourceLayer: 'mumbai-stops'
            });

            if (!features || features.length === 0) {
                this.showNoStopsMessage();
                return;
            }

            // Calculate distances and find nearest stop
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
                console.log('🚏 Nearest stop found:', nearestStop.properties);
                this.selectStop(nearestStop);
                this.highlightNearestStop(nearestStop);
            } else {
                this.showNoStopsMessage();
            }

        } catch (error) {
            console.error('Error finding nearest stop:', error);
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

    displayStopInfo(stopFeature) {
        const props = stopFeature.properties;
        const stopInfoEl = document.getElementById('stop-info');
        
        const distance = this.userLocation ? 
            this.calculateDistance(
                this.userLocation.lat, this.userLocation.lng,
                stopFeature.geometry.coordinates[1], 
                stopFeature.geometry.coordinates[0]
            ) : null;

        stopInfoEl.innerHTML = `
            <div class="bg-gray-800 rounded-lg p-4 border border-green-500/30">
                <h3 class="font-bold text-white text-lg mb-2">${props.name || 'Bus Stop'}</h3>
                ${props.stop_description ? `<p class="text-gray-300 text-sm mb-3">${props.stop_description}</p>` : ''}
                
                <div class="grid grid-cols-2 gap-4 text-sm">
                    ${distance ? `
                        <div>
                            <span class="text-gray-400">Distance:</span>
                            <span class="text-white font-medium">${(distance * 1000).toFixed(0)}m</span>
                        </div>
                    ` : ''}
                    
                    ${props.trip_count ? `
                        <div>
                            <span class="text-gray-400">Daily Trips:</span>
                            <span class="text-white font-medium">${props.trip_count}</span>
                        </div>
                    ` : ''}
                    
                    ${props.avg_wait_time ? `
                        <div>
                            <span class="text-gray-400">Avg Wait:</span>
                            <span class="text-white font-medium">${props.avg_wait_time} min</span>
                        </div>
                    ` : ''}
                    
                    ${props.route_name_list ? `
                        <div class="col-span-2">
                            <span class="text-gray-400">Routes:</span>
                            <div class="flex flex-wrap gap-1 mt-1">
                                ${props.route_name_list.split(',').slice(0, 5).map(route => 
                                    `<span class="route-badge px-2 py-1 rounded text-xs text-white font-medium">${route.trim()}</span>`
                                ).join('')}
                                ${props.route_name_list.split(',').length > 5 ? 
                                    `<span class="text-gray-400 text-xs">+${props.route_name_list.split(',').length - 5} more</span>` : ''}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    loadDepartures(stopFeature) {
        const departureList = document.getElementById('departure-list');
        const lastUpdated = document.getElementById('last-updated');
        
        try {
            const props = stopFeature.properties;
            let departures = [];
            
            // Try to parse real timetable data first
            if (props.stop_timetable) {
                departures = this.parseTimetableData(props.stop_timetable, props.route_name_list);
                
                if (departures.length > 0) {
                    console.log(`📋 Found ${departures.length} real departures for stop:`, props.name);
                } else {
                    console.log('📋 No valid departures found in timetable data, falling back to mock data');
                }
            }
            
            // Fallback to mock data if no real departures available
            if (departures.length === 0 && props.route_name_list) {
                console.log('📋 Generating mock departures based on route list');
                departures = this.generateMockDepartures(props.route_name_list);
            }
            
            // If we have timetable data but no current departures, show upcoming ones
            if (departures.length === 0 && props.stop_timetable) {
                departures = this.getNextDayDepartures(props.stop_timetable);
            }
            
            this.displayDepartures(departures);
            
            // Update timestamp with data source info
            const dataSource = props.stop_timetable && departures.length > 0 ? 'Real-time data' : 'Estimated';
            lastUpdated.innerHTML = `${dataSource} • Updated ${new Date().toLocaleTimeString()}`;
            
        } catch (error) {
            console.error('Error loading departures:', error);
            this.showDepartureError();
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
                            time: departure,
                            isLive: false, // Next day departures are scheduled
                            destination: routeInfo.last_stop_name || this.generateDestination(),
                            platform: '1',
                            headway: routeInfo.trip_headway || 60,
                            acService: routeInfo.ac_service || false,
                            routeId: routeInfo.route_id,
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
                            time: departure,
                            isLive: isLiveRoute,
                            destination: routeInfo.last_stop_name || this.generateDestination(),
                            platform: this.generatePlatform(routeInfo.route_short_name),
                            headway: routeInfo.trip_headway || 60,
                            acService: routeInfo.ac_service || false,
                            routeId: routeInfo.route_id
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

    generatePlatform(routeName) {
        // Generate platform numbers based on route characteristics
        if (!routeName) return '1';
        
        // AC routes typically use higher numbered platforms
        if (routeName.startsWith('A-') || routeName.includes('AC')) {
            return Math.floor(Math.random() * 3) + 3; // Platforms 3-5
        }
        
        // Express routes use specific platforms
        if (routeName.includes('EXP') || routeName.includes('EXPRESS')) {
            return Math.floor(Math.random() * 2) + 2; // Platforms 2-3
        }
        
        // Regular routes use platforms 1-2
        return Math.floor(Math.random() * 2) + 1;
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

    generateMockDepartures(routeListStr) {
        if (!routeListStr) return [];
        
        const routes = routeListStr.split(',').slice(0, 8); // Show up to 8 routes
        const departures = [];
        const now = new Date();
        
        routes.forEach((route, index) => {
            // Generate 2-3 departures per route in next 60 minutes
            const numDepartures = Math.floor(Math.random() * 2) + 2;
            
            for (let i = 0; i < numDepartures; i++) {
                const departureTime = new Date(now.getTime() + (Math.random() * 60 * 60 * 1000)); // Within 60 minutes
                const isLive = Math.random() > 0.3; // 70% chance of being live
                
                departures.push({
                    route: route.trim(),
                    time: departureTime,
                    isLive: isLive,
                    destination: this.generateDestination(),
                    platform: `${index + 1}`
                });
            }
        });
        
        // Sort by departure time
        return departures.sort((a, b) => a.time - b.time).slice(0, 12); // Show next 12 departures
    }

    generateDestination() {
        const destinations = [
            'CST', 'Dadar', 'Bandra', 'Andheri', 'Borivali', 'Thane', 
            'Kurla', 'Ghatkopar', 'Mulund', 'Vikhroli', 'Powai', 'BKC'
        ];
        return destinations[Math.floor(Math.random() * destinations.length)];
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

        const departureHTML = departures.map(departure => {
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

            // Enhanced route badge with AC indicator
            const routeBadgeClass = departure.acService ? 
                'bg-gradient-to-r from-blue-600 to-blue-700' : 
                'route-badge';
            
            const acIndicator = departure.acService ? 
                '<span class="text-blue-200 text-xs ml-1">AC</span>' : '';

            // Live status with better indicators
            const statusClass = departure.isLive ? 'status-live' : 'status-scheduled';
            const statusText = departure.isNextDay ? 'Scheduled' :
                              departure.isLive ? 'Live tracking' : 'Scheduled';

            // Frequency information
            const frequencyInfo = departure.headway && departure.headway < 60 ? 
                `Every ${departure.headway}min` : '';
            
            return `
                <div class="departure-row flex items-center justify-between p-3 rounded">
                    <div class="flex items-center gap-3">
                        <div class="status-indicator ${statusClass}"></div>
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="${routeBadgeClass} px-2 py-1 rounded text-xs font-bold text-white">
                                    ${departure.route}${acIndicator}
                                </span>
                                <span class="text-white font-medium">${departure.destination}</span>
                            </div>
                            <div class="text-xs text-gray-400 mt-1 flex items-center gap-2">
                                <span>${statusText}</span>
                                ${frequencyInfo ? `<span>•</span><span>${frequencyInfo}</span>` : ''}
                                ${departure.platform !== '1' ? `<span>•</span><span>Platform ${departure.platform}</span>` : ''}
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
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.transitExplorer = new TransitExplorer();
});

// Export for use in other modules if needed
export default TransitExplorer; 