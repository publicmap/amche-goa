/**
 * MapSearchControl - A class to handle Mapbox search box functionality
 * with support for coordinate search and local layer suggestions
 */
class MapSearchControl {
    /**
     * @param {Object} map - The Mapbox GL map instance
     * @param {Object} options - Configuration options
     */
    constructor(map, options = {}) {
        this.map = map;
        this.options = {
            accessToken: mapboxgl.accessToken,
            proximity: '73.87916,15.26032', // Default to Goa center
            country: 'IN',
            language: 'en',
            types: 'place,locality,postcode,region,district,street,address,poi',
            ...options
        };
        
        this.searchBox = null;
        this.coordinateRegex = /^(\d+\.?\d*)\s*,\s*(\d+\.?\d*)$/;
        this.isCoordinateInput = false;
        this.coordinateSuggestion = null;
        this.localSuggestions = [];
        this.currentQuery = '';
        this.injectionTimeout = null;
        this.lastInjectedQuery = '';
        
        // Add marker for search results
        this.searchMarker = null;
        
        // Feature state manager reference (will be set externally)
        this.featureStateManager = null;
        
        this.initialize();
    }
    
    /**
     * Set the feature state manager instance
     * @param {MapFeatureStateManager} featureStateManager - The feature state manager instance
     */
    setFeatureStateManager(featureStateManager) {
        this.featureStateManager = featureStateManager;
        console.log('Feature state manager set for search control');
    }
    
    /**
     * Remove the current search marker if it exists
     */
    removeSearchMarker() {
        if (this.searchMarker) {
            this.searchMarker.remove();
            this.searchMarker = null;
        }
    }
    
    /**
     * Add a search marker at the specified coordinates
     * @param {Array} coordinates - [longitude, latitude]
     * @param {string} title - Title for the marker popup
     */
    addSearchMarker(coordinates, title) {
        // Remove existing marker first
        this.removeSearchMarker();
        
        // Create a new marker with a popup
        this.searchMarker = new mapboxgl.Marker({
            color: '#ff6b6b', // Red color to distinguish from other markers
            scale: 1.2
        })
        .setLngLat(coordinates)
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<div><strong>${title}</strong></div>`))
        .addTo(this.map);
        
        console.log('Added search marker at:', coordinates, 'with title:', title);
    }

    /**
     * Update the search box input value
     * @param {string} value - The value to set in the search box
     */
    updateSearchBoxInput(value) {
        try {
            // Try to find the input element in the search box
            const searchBoxInput = this.searchBox.shadowRoot?.querySelector('input') || 
                                   this.searchBox.querySelector('input');
            
            if (searchBoxInput) {
                searchBoxInput.value = value;
                console.log('Updated search box input to:', value);
                
                // Trigger an input event to update the component's internal state
                const inputEvent = new Event('input', { bubbles: true });
                searchBoxInput.dispatchEvent(inputEvent);
            } else {
                console.warn('Could not find search box input element to update');
            }
        } catch (error) {
            console.error('Error updating search box input:', error);
        }
    }

    /**
     * Reset the search state to allow for new searches
     */
    resetSearchState() {
        this.lastInjectedQuery = '';
        this.localSuggestions = [];
        this.currentQuery = '';
        this.isCoordinateInput = false;
        this.coordinateSuggestion = null;
        
        // Clear any pending injection timeout
        if (this.injectionTimeout) {
            clearTimeout(this.injectionTimeout);
            this.injectionTimeout = null;
        }
        
        // Clear any injected suggestions from the DOM
        try {
            const $resultsList = this.searchBox.shadowRoot ? 
                $(this.searchBox.shadowRoot.querySelector('[role="listbox"]')) :
                $('[role="listbox"]').first();
                
            if ($resultsList.length > 0) {
                $resultsList.find('.local-suggestion').remove();
            }
        } catch (error) {
            console.error('Error clearing injected suggestions:', error);
        }
        
        console.log('Search state reset for new search');
    }
    
    /**
     * Initialize the search box control
     */
    initialize() {
        // Wait for the search box element to be available
        const checkForSearchBox = setInterval(() => {
            const searchBoxElement = document.querySelector('mapbox-search-box');
            if (searchBoxElement) {
                clearInterval(checkForSearchBox);
                this.setupSearchBox(searchBoxElement);
            }
        }, 100);
    }
    
    /**
     * Set up the search box with event listeners
     * @param {HTMLElement} searchBoxElement - The search box element
     */
    setupSearchBox(searchBoxElement) {
        this.searchBox = searchBoxElement;
        
        // Set up mapbox integration
        this.searchBox.mapboxgl = mapboxgl;
        this.searchBox.marker = false; // Disable default marker, we'll handle it ourselves
        this.searchBox.bindMap(this.map);
        
        // Set the access token and other options
        this.searchBox.setAttribute('access-token', this.options.accessToken);
        this.searchBox.setAttribute('proximity', this.options.proximity);
        this.searchBox.setAttribute('country', this.options.country);
        this.searchBox.setAttribute('language', this.options.language);
        this.searchBox.setAttribute('types', this.options.types);
        
        // Add event listeners
        this.searchBox.addEventListener('suggest', this.handleSuggest.bind(this));
        this.searchBox.addEventListener('retrieve', this.handleRetrieve.bind(this));
        
        // Add input event listener to handle coordinate input and local suggestions
        this.searchBox.addEventListener('input', this.handleInput.bind(this));
        
        // Add keydown event listener to handle Enter key for coordinates
        this.searchBox.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // Add additional event listeners for better input detection
        this.searchBox.addEventListener('clear', this.handleClear.bind(this));
        
        // Monitor input changes more aggressively
        this.setupInputMonitoring();
        
        console.log('MapSearchControl initialized');
    }
    

    
    /**
     * Handle keydown events to handle Enter key for coordinates
     * @param {Event} event - The keydown event
     */
    handleKeyDown(event) {
        // If we've detected a coordinate input and the user presses Enter
        if (this.isCoordinateInput && event.key === 'Enter' && this.coordinateSuggestion) {
            console.log('Enter key pressed for coordinate input');
            
            // Prevent the default behavior
            event.preventDefault();
            event.stopPropagation();
            
            // Simulate a retrieve event with our coordinate suggestion
            const retrieveEvent = new CustomEvent('retrieve', {
                detail: {
                    features: [this.coordinateSuggestion]
                }
            });
            
            // Dispatch the event
            this.searchBox.dispatchEvent(retrieveEvent);
        }
    }

    /**
     * Handle explicit clear events
     * @param {Event} event - The clear event
     */
    handleClear(event) {
        console.log('Search box clear event received');
        this.handleEmptyInput();
    }

    /**
     * Set up more aggressive input monitoring
     */
    setupInputMonitoring() {
        // Poll the input value periodically to catch changes we might miss
        this.inputMonitorInterval = setInterval(() => {
            this.checkInputValue();
        }, 200);
    }

    /**
     * Check the current input value and handle changes
     */
    checkInputValue() {
        try {
            const searchBoxInput = this.searchBox.shadowRoot?.querySelector('input') || 
                                   this.searchBox.querySelector('input');
            
            if (searchBoxInput) {
                const currentValue = searchBoxInput.value || '';
                
                // If the value is empty and we haven't handled it yet
                if (!currentValue && this.currentQuery) {
                    console.log('Detected empty input, triggering clear');
                    this.handleEmptyInput();
                }
            }
        } catch (error) {
            // Silently fail to avoid console spam
        }
    }

    /**
     * Handle empty input state
     */
    handleEmptyInput() {
        console.log('Handling empty input - clearing marker and feature state');
        
        // Reset all search state
        this.resetSearchState();
        
        // Clear search marker when input is cleared
        this.removeSearchMarker();
        
        // Clear feature state when input is cleared
        if (this.featureStateManager) {
            this.featureStateManager._resetSelectionState();
            console.log('Cleared feature state and marker due to empty search input');
        }
    }
    
    /**
     * Handle input events to detect coordinate patterns and query local suggestions
     * @param {Event} event - The input event
     */
    handleInput(event) {
        // Get the input value from the search box
        let query = '';
        
        // Try to get the query from the search box input element
        try {
            const searchBoxInput = this.searchBox.shadowRoot?.querySelector('input') || 
                                   this.searchBox.querySelector('input') ||
                                   event.target;
            
            if (searchBoxInput && searchBoxInput.value !== undefined) {
                query = searchBoxInput.value;
            } else {
                console.warn('Could not find search box input element');
                return;
            }
        } catch (error) {
            console.error('Error accessing search box input:', error);
            return;
        }
        
        if (!query) {
            this.handleEmptyInput();
            return;
        }
        
        this.currentQuery = query;
        console.log('Input value:', query);
        
        // Check if the query matches the coordinate pattern
        const match = query.match(this.coordinateRegex);
        if (match) {
            console.log('Coordinate pattern detected:', match);
            this.isCoordinateInput = true;
            
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[2]);
            
            // Validate coordinates are within reasonable bounds
            if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                console.log('Valid coordinates:', lat, lng);
                
                // Create a custom suggestion for coordinates
                this.coordinateSuggestion = {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [lng, lat]
                    },
                    properties: {
                        name: `Coordinates: ${lat}, ${lng}`,
                        place_name: `Coordinates: ${lat}, ${lng}`,
                        place_type: ['coordinate'],
                        text: `Coordinates: ${lat}, ${lng}`,
                        _isLocalSuggestion: true
                    }
                };
                
                // Clear local suggestions for coordinate input
                this.localSuggestions = [];
            } else {
                console.log('Invalid coordinates (out of bounds):', lat, lng);
                this.isCoordinateInput = false;
                this.coordinateSuggestion = null;
            }
        } else {
            this.isCoordinateInput = false;
            this.coordinateSuggestion = null;
            
            // Query local cadastral suggestions for non-coordinate input
            this.localSuggestions = this.queryLocalCadastralSuggestions(query);
            console.log(`Found ${this.localSuggestions.length} local suggestions for query: "${query}"`);
            
            // If we have local suggestions, inject them into the UI after a delay
            // This allows the Mapbox component to process first, then we add our suggestions
            if (this.localSuggestions.length > 0) {
                // Clear any existing injection timeout
                if (this.injectionTimeout) {
                    clearTimeout(this.injectionTimeout);
                }
                
                // Set a new timeout to inject suggestions
                this.injectionTimeout = setTimeout(() => {
                    this.injectLocalSuggestionsIntoUI();
                }, 500); // Increased delay to let Mapbox finish
            }
        }
    }
    
    /**
     * Try to directly update the search box's internal state to prevent API calls
     */
    updateSearchBoxState() {
        try {
            console.log('Attempting to update search box state');
            
            // Try to access the internal search box component
            const searchBoxComponent = this.searchBox.shadowRoot.querySelector('mapbox-search-box-core');
            if (searchBoxComponent) {
                console.log('Found search box component, attempting to update state');
                
                // Try to set the suggestions directly
                if (searchBoxComponent._searchSession) {
                    console.log('Found search session, updating suggestions');
                    searchBoxComponent._searchSession._suggestions = [this.coordinateSuggestion];
                    console.log('Updated search session suggestions');
                } else {
                    console.log('Search session not found');
                }
                
                // Try to update the UI
                const listbox = this.searchBox.shadowRoot.querySelector('mapbox-search-listbox');
                if (listbox) {
                    console.log('Found listbox, updating suggestions');
                    listbox.suggestions = [this.coordinateSuggestion];
                    console.log('Updated listbox suggestions');
                } else {
                    console.log('Listbox not found');
                }
                
                // Try to find and update the input element
                const inputElement = this.searchBox.shadowRoot.querySelector('input');
                if (inputElement) {
                    console.log('Found input element');
                    // We don't need to modify the input value as it's already set
                } else {
                    console.log('Input element not found');
                }
            } else {
                console.log('Search box component not found');
            }
        } catch (error) {
            console.error('Error updating search box state:', error);
        }
    }
    
    /**
     * Handle suggest events - now mainly for coordinate suggestions
     * @param {Event} event - The suggest event
     */
    handleSuggest(event) {
        console.log('Suggest event received:', event);
        
        // Only handle coordinate suggestions via events now
        // Local cadastral suggestions are handled via direct DOM injection
        if (this.isCoordinateInput && this.coordinateSuggestion) {
            console.log('Handling coordinate suggestion via event');
            
            // Prevent the default suggest behavior
            event.preventDefault();
            event.stopPropagation();
            
            // Create a custom suggest event with coordinate suggestion
            const customSuggestEvent = new CustomEvent('suggest', {
                detail: {
                    suggestions: [this.coordinateSuggestion]
                },
                bubbles: true,
                cancelable: true
            });
            
            console.log('Creating custom suggest event for coordinate');
            
            // Dispatch the custom event asynchronously
            setTimeout(() => {
                this.searchBox.dispatchEvent(customSuggestEvent);
            }, 0);
            
            return false;
        }
        
        // For non-coordinate input, let Mapbox handle normally
        // Our local suggestions will be injected via DOM manipulation
        console.log('Allowing default suggest behavior, local suggestions handled via DOM injection');
        
        // If we have local suggestions, re-inject them after Mapbox updates
        if (!this.isCoordinateInput && this.localSuggestions.length > 0) {
            // Clear any existing timeout
            if (this.injectionTimeout) {
                clearTimeout(this.injectionTimeout);
            }
            
            // Reset the injection tracking since Mapbox just updated
            this.lastInjectedQuery = '';
            
            // Re-inject after a short delay
            this.injectionTimeout = setTimeout(() => {
                this.injectLocalSuggestionsIntoUI();
            }, 100);
        }
    }
    
    /**
     * Handle retrieve events to fly to the selected location
     * @param {Event} event - The retrieve event
     */
    handleRetrieve(event) {
        console.log('Retrieve event received:', event);
        
        if (event.detail && event.detail.features && event.detail.features.length > 0) {
            const feature = event.detail.features[0];
            const coordinates = feature.geometry.coordinates;
            
            console.log('Flying to coordinates:', coordinates);
            
            // Check if this is a local cadastral suggestion
            const isLocalSuggestion = feature.properties && feature.properties._isLocalSuggestion;
            
            if (isLocalSuggestion) {
                console.log('Selected local cadastral suggestion:', feature.properties.name);
                
                // Update the search box input to show the selected result
                this.updateSearchBoxInput(feature.properties.name);
                
                // Add a marker at the location
                this.addSearchMarker(coordinates, feature.properties.name);
                
                // For cadastral plots, zoom in closer to see the plot boundaries
                this.map.flyTo({
                    center: coordinates,
                    zoom: 18, // Zoom in closer for cadastral plots
                    essential: true,
                    duration: 2000
                });
                
                // Set feature state to selected if we have the feature state manager and feature ID
                if (this.featureStateManager && feature.properties._featureId) {
                    console.log('Setting feature state for plot:', feature.properties._featureId);
                    
                    // Clear any existing selection first
                    this.featureStateManager._resetSelectionState();
                    
                    // Set the new selection
                    this.featureStateManager.selectedFeatureId = feature.properties._featureId;
                    this.featureStateManager.selectedSourceId = 'vector-plot';
                    this.featureStateManager.selectedSourceLayer = 'Onemapgoa_GA_Cadastrals';
                    
                    try {
                        this.map.setFeatureState(
                            {
                                source: 'vector-plot',
                                sourceLayer: 'Onemapgoa_GA_Cadastrals',
                                id: feature.properties._featureId
                            },
                            { selected: true }
                        );
                        console.log('Successfully set feature state to selected');
                    } catch (error) {
                        console.error('Error setting feature state:', error);
                    }
                }
                
                // Clear the injection state to allow future searches
                this.resetSearchState();
                
                // Optionally highlight the plot (if you want to add visual feedback)
                this.highlightCadastralPlot(feature.properties._originalProperties);
            } else {
                // Regular search result or coordinate
                this.addSearchMarker(coordinates, feature.properties.name || feature.properties.place_name || 'Search Result');
                
                this.map.flyTo({
                    center: coordinates,
                    zoom: 16,
                    essential: true
                });
            }
        }
    }

    /**
     * Highlight a cadastral plot on the map (optional visual feedback)
     * @param {Object} plotProperties - The original plot properties
     */
    highlightCadastralPlot(plotProperties) {
        try {
            console.log('Highlighting cadastral plot:', plotProperties);
            
            // You could add custom highlighting logic here if desired
            // For example, temporarily change the style of the selected plot
            // or show a popup with additional plot information
            
            // Example: Log the plot information
            if (plotProperties) {
                console.log('Plot details:', {
                    plot: plotProperties.plot,
                    // Add other relevant properties as needed
                    ...plotProperties
                });
            }
        } catch (error) {
            console.error('Error highlighting cadastral plot:', error);
        }
    }

    /**
     * Query local cadastral layer for plot suggestions
     * @param {string} query - The search query
     * @returns {Array} Array of matching plot suggestions
     */
    queryLocalCadastralSuggestions(query) {
        if (!query || query.length < 1) {
            return [];
        }

        try {
            // Get the current map bounds for querying visible features
            const bounds = this.map.getBounds();
            
            // First, let's see what sources are available
            const style = this.map.getStyle();
            console.log('Available sources:', Object.keys(style.sources || {}));
            
            // Query features from the cadastral source layer - try without filter first to see what we get
            const allFeatures = this.map.querySourceFeatures('vector-plot', {
                sourceLayer: 'Onemapgoa_GA_Cadastrals'
            });
            
            console.log(`Found ${allFeatures.length} total features in Onemapgoa_GA_Cadastrals layer`);
            
            // Log some sample features and their properties
            if (allFeatures.length > 0) {
                console.log('Sample feature properties:', allFeatures[0].properties);
                console.log('All property keys in first feature:', Object.keys(allFeatures[0].properties || {}));
                
                // Log first 10 plot values to see what we're working with
                const plotValues = allFeatures.slice(0, 20).map(f => f.properties?.plot).filter(Boolean);
                console.log('Sample plot values from first 20 features:', plotValues);
                
                // Log location fields for debugging
                const locationSamples = allFeatures.slice(0, 10).map(f => ({
                    plot: f.properties?.plot,
                    lname: f.properties?.lname,
                    villagenam: f.properties?.villagenam
                }));
                console.log('Sample location data:', locationSamples);
                
                // Count features with plot property
                const featuresWithPlot = allFeatures.filter(f => f.properties && 'plot' in f.properties);
                console.log(`Features with 'plot' property: ${featuresWithPlot.length} out of ${allFeatures.length}`);
            }
            
            // Now apply the filter for features that have a plot property
            const features = this.map.querySourceFeatures('vector-plot', {
                sourceLayer: 'Onemapgoa_GA_Cadastrals',
                filter: ['has', 'plot'] // Only get features that have a plot property
            });

            console.log(`Found ${features.length} cadastral features with 'plot' property to search through`);

            // Filter features by plot property that starts with the query (case insensitive)
            const matchingFeatures = features.filter(feature => {
                const plotValue = feature.properties.plot;
                if (!plotValue) return false;
                
                // Convert to string and check if it starts with the query (case insensitive)
                const plotString = String(plotValue).toLowerCase();
                const queryLower = query.toLowerCase();
                
                const isMatch = plotString.startsWith(queryLower);
                
                // Log detailed matching info for debugging
                if (features.length <= 10 || isMatch) {
                    console.log(`Plot "${plotValue}" -> "${plotString}" ${isMatch ? 'MATCHES' : 'does not match'} query "${queryLower}"`);
                }
                
                return isMatch;
            });

            console.log(`Found ${matchingFeatures.length} matching cadastral plots for query: "${query}"`);
            
            // If we have matching features, log their plot values
            if (matchingFeatures.length > 0) {
                const matchingPlots = matchingFeatures.map(f => f.properties.plot);
                console.log(`Matching plot values:`, matchingPlots);
            }

            // Group features by unique location to avoid duplicates
            const uniqueFeatures = [];
            const seenLocations = new Set();
            
            for (const feature of matchingFeatures) {
                const plotValue = feature.properties.plot;
                const lname = feature.properties.lname || '';
                const villagenam = feature.properties.villagenam || '';
                
                // Create a unique key for this location
                const locationKey = `${plotValue}|${villagenam}|${lname}`;
                
                if (!seenLocations.has(locationKey)) {
                    seenLocations.add(locationKey);
                    uniqueFeatures.push(feature);
                    
                    // Stop when we have enough unique suggestions
                    if (uniqueFeatures.length >= 5) break;
                }
            }
            
            console.log(`Reduced ${matchingFeatures.length} matching features to ${uniqueFeatures.length} unique locations`);
            
            // Convert to suggestion format and limit results
            const suggestions = uniqueFeatures
                .map(feature => {
                    const plotValue = feature.properties.plot;
                    const lname = feature.properties.lname || ''; // Place name
                    const villagenam = feature.properties.villagenam || ''; // Village/locality name
                    const center = this.getFeatureCenter(feature);
                    const featureId = feature.properties.id || feature.id; // Get the feature ID
                    
                    // Build a descriptive location string
                    let locationParts = [];
                    if (villagenam) locationParts.push(villagenam);
                    if (lname && lname !== villagenam) locationParts.push(lname);
                    locationParts.push('Goa'); // Always add Goa
                    
                    const locationString = locationParts.join(', ');
                    const fullDescription = locationParts.length > 1 ? 
                        `Plot ${plotValue}, ${locationString}` : 
                        `Plot ${plotValue}, Cadastral Survey, Goa`;
                    
                    console.log(`Creating suggestion for plot ${plotValue} with feature ID: ${featureId}`);
                    
                    return {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: center
                        },
                        properties: {
                            name: `Plot ${plotValue}`,
                            place_name: fullDescription,
                            place_type: ['cadastral', 'plot'],
                            text: `Plot ${plotValue}`,
                            full_address: fullDescription,
                            context: [
                                {
                                    id: 'cadastral',
                                    text: 'Cadastral Survey'
                                },
                                ...(villagenam ? [{
                                    id: 'locality',
                                    text: villagenam
                                }] : []),
                                ...(lname && lname !== villagenam ? [{
                                    id: 'place',
                                    text: lname
                                }] : []),
                                {
                                    id: 'region',
                                    text: 'Goa'
                                }
                            ],
                            // Store location info for display
                            _locationString: locationString,
                            // Store original feature properties for potential use
                            _originalProperties: feature.properties,
                            // Store the feature ID for selection state management
                            _featureId: featureId,
                            // Mark as local suggestion
                            _isLocalSuggestion: true
                        }
                    };
                });

            return suggestions;
        } catch (error) {
            console.error('Error querying local cadastral suggestions:', error);
            return [];
        }
    }

    /**
     * Get the center point of a feature
     * @param {Object} feature - GeoJSON feature
     * @returns {Array} [longitude, latitude]
     */
    getFeatureCenter(feature) {
        if (!feature.geometry) return [0, 0];

        switch (feature.geometry.type) {
            case 'Point':
                return feature.geometry.coordinates;
            
            case 'Polygon':
            case 'MultiPolygon':
                // Calculate centroid of polygon
                return this.calculatePolygonCentroid(feature.geometry);
            
            case 'LineString':
            case 'MultiLineString':
                // Get midpoint of line
                return this.calculateLineMidpoint(feature.geometry);
            
            default:
                console.warn('Unknown geometry type:', feature.geometry.type);
                return [0, 0];
        }
    }

    /**
     * Calculate the centroid of a polygon
     * @param {Object} geometry - Polygon or MultiPolygon geometry
     * @returns {Array} [longitude, latitude]
     */
    calculatePolygonCentroid(geometry) {
        let coordinates;
        
        if (geometry.type === 'Polygon') {
            coordinates = geometry.coordinates[0]; // Use exterior ring
        } else if (geometry.type === 'MultiPolygon') {
            coordinates = geometry.coordinates[0][0]; // Use first polygon's exterior ring
        } else {
            return [0, 0];
        }

        // Calculate centroid using simple average of coordinates
        let x = 0, y = 0, count = 0;
        
        for (const coord of coordinates) {
            if (Array.isArray(coord) && coord.length >= 2) {
                x += coord[0];
                y += coord[1];
                count++;
            }
        }

        return count > 0 ? [x / count, y / count] : [0, 0];
    }

    /**
     * Calculate the midpoint of a line
     * @param {Object} geometry - LineString or MultiLineString geometry
     * @returns {Array} [longitude, latitude]
     */
    calculateLineMidpoint(geometry) {
        let coordinates;
        
        if (geometry.type === 'LineString') {
            coordinates = geometry.coordinates;
        } else if (geometry.type === 'MultiLineString') {
            coordinates = geometry.coordinates[0]; // Use first line
        } else {
            return [0, 0];
        }

        if (coordinates.length === 0) return [0, 0];
        
        // Return midpoint
        const midIndex = Math.floor(coordinates.length / 2);
        return coordinates[midIndex];
    }

    /**
     * Clean up the search control
     */
    cleanup() {
        // Remove search marker
        this.removeSearchMarker();
        
        // Clear timeouts and intervals
        if (this.injectionTimeout) {
            clearTimeout(this.injectionTimeout);
            this.injectionTimeout = null;
        }
        
        if (this.inputMonitorInterval) {
            clearInterval(this.inputMonitorInterval);
            this.inputMonitorInterval = null;
        }
        
        // Remove event listeners if search box exists
        if (this.searchBox) {
            this.searchBox.removeEventListener('suggest', this.handleSuggest.bind(this));
            this.searchBox.removeEventListener('retrieve', this.handleRetrieve.bind(this));
            this.searchBox.removeEventListener('input', this.handleInput.bind(this));
            this.searchBox.removeEventListener('keydown', this.handleKeyDown.bind(this));
            this.searchBox.removeEventListener('clear', this.handleClear.bind(this));
        }
        
        console.log('MapSearchControl cleaned up');
    }

    /**
     * Inject local suggestions directly into the search results UI using jQuery
     */
    injectLocalSuggestionsIntoUI() {
        try {
            console.log('Attempting to inject local suggestions into UI');
            
            // Check if we've already injected for this query
            if (this.lastInjectedQuery === this.currentQuery) {
                console.log('Already injected suggestions for this query, skipping');
                return;
            }
            
            // Find the results list in the shadow DOM or regular DOM
            let $resultsList = null;
            let $resultsContainer = null;
            
            // Try multiple methods to find the results container
            const findResultsContainer = () => {
                // Method 1: Look in shadow DOM
                if (this.searchBox.shadowRoot) {
                    const shadowResults = this.searchBox.shadowRoot.querySelector('[role="listbox"]');
                    if (shadowResults) {
                        $resultsList = $(shadowResults);
                        $resultsContainer = $resultsList.parent();
                        console.log('Found results list in shadow DOM');
                        return true;
                    }
                }
                
                // Method 2: Look in regular DOM
                $resultsList = $('[role="listbox"]').first();
                if ($resultsList.length > 0) {
                    $resultsContainer = $resultsList.parent();
                    console.log('Found results list in regular DOM');
                    return true;
                }
                
                // Method 3: Look for search results containers by class
                const searchResultsContainers = $('.mapboxgl-ctrl-geocoder, [class*="search"], [class*="suggest"], [class*="result"]');
                for (let i = 0; i < searchResultsContainers.length; i++) {
                    const $container = $(searchResultsContainers[i]);
                    const listbox = $container.find('[role="listbox"]');
                    if (listbox.length > 0) {
                        $resultsList = listbox.first();
                        $resultsContainer = $container;
                        console.log('Found results list via search container class');
                        return true;
                    }
                }
                
                // Method 4: Create a results container if none exists
                if (this.searchBox.shadowRoot) {
                    const shadowRoot = this.searchBox.shadowRoot;
                    let listbox = shadowRoot.querySelector('[role="listbox"]');
                    if (!listbox) {
                        // Create a new listbox
                        listbox = document.createElement('div');
                        listbox.setAttribute('role', 'listbox');
                        listbox.style.cssText = `
                            position: absolute;
                            top: 100%;
                            left: 0;
                            right: 0;
                            background: white;
                            border: 1px solid #ccc;
                            border-radius: 4px;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                            max-height: 200px;
                            overflow-y: auto;
                            z-index: 1000;
                        `;
                        
                        // Find the input container and append the listbox
                        const inputContainer = shadowRoot.querySelector('div') || shadowRoot;
                        inputContainer.appendChild(listbox);
                    }
                    
                    $resultsList = $(listbox);
                    $resultsContainer = $resultsList.parent();
                    console.log('Created new results list in shadow DOM');
                    return true;
                }
                
                return false;
            };
            
            if (!findResultsContainer()) {
                console.log('Could not find or create results list to inject suggestions');
                return;
            }
            
            // Remove any previously injected local suggestions
            $resultsList.find('.local-suggestion').remove();
            
            // Get current Mapbox suggestions and limit them to 5
            const existingSuggestions = $resultsList.find('[role="option"]');
            const existingCount = existingSuggestions.length;
            
            // If there are more than 5 Mapbox suggestions, remove the extras
            if (existingCount > 5) {
                existingSuggestions.slice(5).remove();
                console.log(`Trimmed Mapbox suggestions from ${existingCount} to 5`);
            }
            
            // Recalculate after trimming
            const remainingMapboxSuggestions = $resultsList.find('[role="option"]').length;
            const localSuggestionsToAdd = Math.min(5, this.localSuggestions.length);
            const totalCount = remainingMapboxSuggestions + localSuggestionsToAdd;
            
            console.log(`Found ${remainingMapboxSuggestions} Mapbox suggestions, adding ${localSuggestionsToAdd} local suggestions for total of ${totalCount}`);
            
            // Make sure the results container is visible
            if ($resultsContainer) {
                $resultsContainer.show();
            }
            $resultsList.show();
            
            // Create HTML for each local suggestion
            this.localSuggestions.slice(0, localSuggestionsToAdd).forEach((suggestion, index) => {
                const suggestionIndex = index; // Local suggestions will be at positions 0, 1, 2, etc.
                const plotName = suggestion.properties.name;
                const plotDesc = suggestion.properties.place_name;
                
                // Create the suggestion HTML with robust styling
                const suggestionHtml = `
                    <div class="mbx09bc48e7--Suggestion local-suggestion" 
                         role="option" 
                         tabindex="-1" 
                         id="mbx09bc48e7-ResultsList-${suggestionIndex}" 
                         aria-posinset="${suggestionIndex + 1}" 
                         aria-setsize="${totalCount}"
                         data-suggestion-index="${suggestionIndex}"
                         data-local-index="${index}"
                         data-local-suggestion="true"
                         style="
                             display: flex !important;
                             align-items: center;
                             padding: 8px 12px;
                             cursor: pointer;
                             background: white;
                             border-bottom: 1px solid #eee;
                             min-height: 40px;
                             font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                         ">
                        <div class="mbx09bc48e7--SuggestionIcon" aria-hidden="true" style="margin-right: 8px; font-size: 16px;">📍</div>
                        <div class="mbx09bc48e7--SuggestionText" style="flex: 1; overflow: hidden;">
                            <div class="mbx09bc48e7--SuggestionName" style="font-weight: 500; color: #333; font-size: 14px; line-height: 1.2;">${plotName}</div>
                            <div class="mbx09bc48e7--SuggestionDesc" style="color: #666; font-size: 12px; line-height: 1.2; margin-top: 2px;">${plotDesc}</div>
                        </div>
                    </div>
                `;
                
                // Insert at the beginning (before Mapbox suggestions)
                $resultsList.prepend(suggestionHtml);
            });
            
            // Update aria-setsize for all suggestions
            $resultsList.find('[role="option"]').each((index, element) => {
                $(element).attr('aria-posinset', index + 1);
                $(element).attr('aria-setsize', totalCount);
            });
            
            // Add click and hover handlers for local suggestions
            $resultsList.find('.local-suggestion')
                .on('click', (event) => {
                    const localIndex = parseInt($(event.currentTarget).data('local-index'));
                    
                    if (localIndex >= 0 && localIndex < this.localSuggestions.length) {
                        const selectedSuggestion = this.localSuggestions[localIndex];
                        console.log('Local suggestion clicked:', selectedSuggestion.properties.name);
                        
                        // Clear the results list immediately to prevent UI issues
                        $resultsList.empty();
                        $resultsList.parent().hide();
                        
                        // Create a retrieve event
                        const retrieveEvent = new CustomEvent('retrieve', {
                            detail: {
                                features: [selectedSuggestion]
                            }
                        });
                        
                        // Dispatch the retrieve event
                        this.searchBox.dispatchEvent(retrieveEvent);
                    }
                })
                .on('mouseenter', (event) => {
                    $(event.currentTarget).css('background-color', '#f0f0f0');
                })
                .on('mouseleave', (event) => {
                    $(event.currentTarget).css('background-color', 'white');
                });
            
            console.log(`Successfully injected ${this.localSuggestions.length} local suggestions into UI`);
            
            // Mark this query as injected
            this.lastInjectedQuery = this.currentQuery;
            
        } catch (error) {
            console.error('Error injecting local suggestions into UI:', error);
        }
    }
}

// Export the class
window.MapSearchControl = MapSearchControl; 