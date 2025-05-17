/**
 * MapSearchControl - A class to handle Mapbox search box functionality
 * with support for coordinate search
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
        
        // Add input event listener to handle coordinate input
        this.searchBox.addEventListener('input', this.handleInput.bind(this));
        
        // Add keydown event listener to handle Enter key for coordinates
        this.searchBox.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // Create a custom search box overlay for coordinates
        this.createCoordinateSearchOverlay();
        
        console.log('MapSearchControl initialized');
    }
    
    /**
     * Create a custom search box overlay for coordinates
     */
    createCoordinateSearchOverlay() {
        // Create a container for our custom search box
        const container = document.createElement('div');
        container.id = 'coordinate-search-container';
        container.style.position = 'absolute';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '1000';
        
        // Create the search box input
        const input = document.createElement('input');
        input.id = 'coordinate-search-input';
        input.type = 'text';
        input.placeholder = 'Search or enter coordinates (e.g., 15.28,73.95)';
        input.style.width = '100%';
        input.style.padding = '8px';
        input.style.border = '1px solid #ccc';
        input.style.borderRadius = '4px';
        input.style.pointerEvents = 'auto';
        input.style.margin = '8px';
        
        // Add the input to the container
        container.appendChild(input);
        
        // Add the container to the search box
        this.searchBox.appendChild(container);
        
        // Add event listeners to our custom input
        input.addEventListener('input', (event) => {
            const query = event.target.value;
            console.log('Custom input value:', query);
            
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
                            name: `Lat: ${lat} Lng: ${lng}`,
                            place_name: `Lat: ${lat} Lng: ${lng}`,
                            place_type: ['coordinate'],
                            text: `Lat: ${lat} Lng: ${lng}`
                        }
                    };
                    
                    // Show the suggestion
                    this.showCoordinateSuggestion();
                } else {
                    console.log('Invalid coordinates (out of bounds):', lat, lng);
                    this.isCoordinateInput = false;
                    this.coordinateSuggestion = null;
                    this.hideCoordinateSuggestion();
                }
            } else {
                this.isCoordinateInput = false;
                this.coordinateSuggestion = null;
                this.hideCoordinateSuggestion();
            }
        });
        
        // Add keydown event listener for Enter key
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && this.isCoordinateInput && this.coordinateSuggestion) {
                console.log('Enter key pressed for coordinate input');
                
                // Prevent the default behavior
                event.preventDefault();
                
                // Fly to the coordinates
                this.flyToCoordinates(this.coordinateSuggestion.geometry.coordinates);
                
                // Hide the suggestion
                this.hideCoordinateSuggestion();
            }
        });
        
        console.log('Coordinate search overlay created');
    }
    
    /**
     * Show the coordinate suggestion
     */
    showCoordinateSuggestion() {
        // Remove any existing suggestion
        this.hideCoordinateSuggestion();
        
        // Create the suggestion element
        const suggestion = document.createElement('div');
        suggestion.id = 'coordinate-suggestion';
        suggestion.textContent = `Lat: ${this.coordinateSuggestion.properties.name}`;
        suggestion.style.position = 'absolute';
        suggestion.style.top = '50px';
        suggestion.style.left = '8px';
        suggestion.style.width = 'calc(100% - 16px)';
        suggestion.style.padding = '8px';
        suggestion.style.backgroundColor = 'white';
        suggestion.style.border = '1px solid #ccc';
        suggestion.style.borderRadius = '4px';
        suggestion.style.cursor = 'pointer';
        suggestion.style.pointerEvents = 'auto';
        suggestion.style.zIndex = '1001';
        
        // Add click event listener
        suggestion.addEventListener('click', () => {
            console.log('Coordinate suggestion clicked');
            
            // Fly to the coordinates
            this.flyToCoordinates(this.coordinateSuggestion.geometry.coordinates);
            
            // Hide the suggestion
            this.hideCoordinateSuggestion();
        });
        
        // Add the suggestion to the container
        const container = document.getElementById('coordinate-search-container');
        container.appendChild(suggestion);
        
        console.log('Coordinate suggestion shown');
    }
    
    /**
     * Hide the coordinate suggestion
     */
    hideCoordinateSuggestion() {
        const suggestion = document.getElementById('coordinate-suggestion');
        if (suggestion) {
            suggestion.remove();
            console.log('Coordinate suggestion hidden');
        }
    }
    
    /**
     * Fly to the specified coordinates
     * @param {Array} coordinates - The coordinates to fly to [lng, lat]
     */
    flyToCoordinates(coordinates) {
        console.log('Flying to coordinates:', coordinates);
        
        // Fly to the location
        this.map.flyTo({
            center: coordinates,
            zoom: 16,
            essential: true
        });
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
     * Handle input events to detect coordinate patterns
     * @param {Event} event - The input event
     */
    handleInput(event) {
        // Get the input value from the search box
        const input = event.target;
        if (!input || !input.value) {
            this.isCoordinateInput = false;
            this.coordinateSuggestion = null;
            return;
        }
        
        const query = input.value;
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
                        name: `Lat: ${lat} Lng: ${lng}`,
                        place_name: `Lat: ${lat} Lng: ${lng}`,
                        place_type: ['coordinate'],
                        text: `Lat: ${lat} Lng: ${lng}`
                    }
                };
                
                // Create a custom suggest event
                const suggestEvent = new CustomEvent('suggest', {
                    detail: {
                        suggestions: [this.coordinateSuggestion]
                    }
                });
                
                // Dispatch the event
                this.searchBox.dispatchEvent(suggestEvent);
                
                // Prevent the default search behavior
                event.preventDefault();
                event.stopPropagation();
                
                // Try to directly update the search box's internal state
                this.updateSearchBoxState();
            } else {
                console.log('Invalid coordinates (out of bounds):', lat, lng);
                this.isCoordinateInput = false;
                this.coordinateSuggestion = null;
            }
        } else {
            this.isCoordinateInput = false;
            this.coordinateSuggestion = null;
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
     * Handle suggest events to provide coordinate suggestions
     * @param {Event} event - The suggest event
     */
    handleSuggest(event) {
        console.log('Suggest event received:', event);
        
        // If we've detected a coordinate input, prevent the default search behavior
        if (this.isCoordinateInput) {
            console.log('Preventing default suggest behavior for coordinate input');
            event.preventDefault();
            event.stopPropagation();
            
            // If this is our custom event, let it propagate
            if (event.detail && event.detail.suggestions && 
                event.detail.suggestions.length === 1 && 
                event.detail.suggestions[0].properties.place_type[0] === 'coordinate') {
                console.log('Allowing our custom coordinate suggestion to propagate');
                return;
            }
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
            
            // Fly to the location
            this.map.flyTo({
                center: coordinates,
                zoom: 16,
                essential: true
            });
        }
    }
}

// Export the class
window.MapSearchControl = MapSearchControl; 