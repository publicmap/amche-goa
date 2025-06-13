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
        
        this.initialize();
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
        this.searchBox.marker = true;
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
            this.isCoordinateInput = false;
            this.coordinateSuggestion = null;
            this.localSuggestions = [];
            this.currentQuery = '';
            this.lastInjectedQuery = '';
            
            // Clear any pending injection
            if (this.injectionTimeout) {
                clearTimeout(this.injectionTimeout);
                this.injectionTimeout = null;
            }
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
                
                // For cadastral plots, zoom in closer to see the plot boundaries
                this.map.flyTo({
                    center: coordinates,
                    zoom: 18, // Zoom in closer for cadastral plots
                    essential: true,
                    duration: 2000
                });
                
                // Optionally highlight the plot (if you want to add visual feedback)
                this.highlightCadastralPlot(feature.properties._originalProperties);
            } else {
                // Regular search result or coordinate
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

            // Convert to suggestion format and limit results
            const suggestions = matchingFeatures
                .slice(0, 5) // Limit to 5 local suggestions
                .map(feature => {
                    const plotValue = feature.properties.plot;
                    const center = this.getFeatureCenter(feature);
                    
                    return {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: center
                        },
                        properties: {
                            name: `Plot ${plotValue}`,
                            place_name: `Plot ${plotValue}, Cadastral Survey, Goa`,
                            place_type: ['cadastral', 'plot'],
                            text: `Plot ${plotValue}`,
                            full_address: `Plot ${plotValue}, Cadastral Survey, Goa`,
                            context: [
                                {
                                    id: 'cadastral',
                                    text: 'Cadastral Survey'
                                },
                                {
                                    id: 'region',
                                    text: 'Goa'
                                }
                            ],
                            // Store original feature properties for potential use
                            _originalProperties: feature.properties,
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
            
            // Try to find the results list in various ways
            if (this.searchBox.shadowRoot) {
                // Look in shadow DOM first
                const shadowResults = this.searchBox.shadowRoot.querySelector('[role="listbox"]');
                if (shadowResults) {
                    $resultsList = $(shadowResults);
                    console.log('Found results list in shadow DOM');
                }
            }
            
            // If not found in shadow DOM, look in regular DOM
            if (!$resultsList) {
                $resultsList = $('[role="listbox"]').first();
                if ($resultsList.length > 0) {
                    console.log('Found results list in regular DOM');
                }
            }
            
            if (!$resultsList || $resultsList.length === 0) {
                console.log('Could not find results list to inject suggestions');
                return;
            }
            
            // Remove any previously injected local suggestions
            $resultsList.find('.local-suggestion').remove();
            
            // Get current suggestions count for proper indexing
            const existingSuggestions = $resultsList.find('[role="option"]');
            const existingCount = existingSuggestions.length;
            const totalCount = existingCount + this.localSuggestions.length;
            
            console.log(`Found ${existingCount} existing suggestions, adding ${this.localSuggestions.length} local suggestions`);
            
            // Create HTML for each local suggestion
            this.localSuggestions.slice(0, 5).forEach((suggestion, index) => {
                const suggestionIndex = existingCount + index;
                const plotName = suggestion.properties.name;
                const plotDesc = suggestion.properties.place_name;
                
                // Create the suggestion HTML matching Mapbox's structure
                const suggestionHtml = `
                    <div class="mbx09bc48e7--Suggestion local-suggestion" 
                         role="option" 
                         tabindex="-1" 
                         id="mbx09bc48e7-ResultsList-${suggestionIndex}" 
                         aria-posinset="${suggestionIndex + 1}" 
                         aria-setsize="${totalCount}"
                         data-suggestion-index="${suggestionIndex}"
                         data-local-suggestion="true">
                        <div class="mbx09bc48e7--SuggestionIcon" aria-hidden="true">📍</div>
                        <div class="mbx09bc48e7--SuggestionText">
                            <div class="mbx09bc48e7--SuggestionName">${plotName}</div>
                            <div class="mbx09bc48e7--SuggestionDesc">${plotDesc}</div>
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
            
            // Add click handlers for local suggestions
            $resultsList.find('.local-suggestion').on('click', (event) => {
                const suggestionIndex = parseInt($(event.currentTarget).data('suggestion-index'));
                const localIndex = suggestionIndex; // Since we prepended, local suggestions are at the beginning
                
                if (localIndex < this.localSuggestions.length) {
                    const selectedSuggestion = this.localSuggestions[localIndex];
                    console.log('Local suggestion clicked:', selectedSuggestion.properties.name);
                    
                    // Create a retrieve event
                    const retrieveEvent = new CustomEvent('retrieve', {
                        detail: {
                            features: [selectedSuggestion]
                        }
                    });
                    
                    // Dispatch the retrieve event
                    this.searchBox.dispatchEvent(retrieveEvent);
                    
                    // Hide the results
                    $resultsList.parent().hide();
                }
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