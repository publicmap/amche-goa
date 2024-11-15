class GeolocationManager {
    constructor(map) {
        this.map = map;
        this.setupGeolocation();
        this.locationLabelSet = false;
        this.isTracking = false;
    }

    setupGeolocation() {
        // Add geolocate control with bearing tracking
        this.geolocate = new mapboxgl.GeolocateControl({
            positionOptions: {
                enableHighAccuracy: true
            },
            trackUserLocation: false,
            showUserHeading: true,
            fitBoundsOptions: {
                zoom: 18
            }
        });
        
        this.map.addControl(this.geolocate);

        // Track when tracking starts/stops
        this.geolocate.on('trackuserlocationstart', () => {
            this.isTracking = true;
            window.addEventListener('deviceorientationabsolute', this.handleOrientation);
        });

        this.geolocate.on('trackuserlocationend', () => {
            this.isTracking = false;
            window.removeEventListener('deviceorientationabsolute', this.handleOrientation);
        });

        // Handle successful geolocation
        this.geolocate.on('geolocate', async (event) => {
            this.lastPosition = event;
            
            if (!this.locationLabelSet) {
                // Reverse geocode the location with more detailed results
                try {
                    const response = await fetch(
                        `https://api.mapbox.com/geocoding/v5/mapbox.places/${event.coords.longitude},${event.coords.latitude}.json?access_token=${mapboxgl.accessToken}&types=poi,address,neighborhood,locality,place&limit=1`
                    );
                    const data = await response.json();
                    
                    // Get detailed address information
                    const feature = data.features[0];
                    let addressText = 'Unknown location';
                    
                    if (feature) {
                        // Construct detailed address
                        const parts = [];
                        
                        // Add POI name if available
                        if (feature.properties && feature.properties.name) {
                            parts.push(feature.properties.name);
                        }
                        
                        // Add address components
                        if (feature.context) {
                            const relevantTypes = ['neighborhood', 'locality', 'place', 'district'];
                            feature.context
                                .filter(ctx => relevantTypes.includes(ctx.id.split('.')[0]))
                                .forEach(ctx => parts.push(ctx.text));
                        }
                        
                        addressText = parts.join(', ');
                    }
                    
                    // Update the geolocate button
                    const geolocateButton = document.querySelector('.mapboxgl-ctrl-geolocate');
                    if (geolocateButton) {
                        // Add styles to the button container
                        geolocateButton.parentElement.style.minWidth = 'auto';
                        geolocateButton.parentElement.style.width = 'auto';
                        
                        // Update button styles
                        geolocateButton.style.width = 'auto';
                        geolocateButton.style.minWidth = '30px';
                        geolocateButton.style.whiteSpace = 'nowrap';
                        geolocateButton.style.padding = '6px 10px';
                        
                        // Add location text
                        const locationText = document.createElement('span');
                        locationText.style.marginLeft = '5px';
                        locationText.textContent = `My location: ${addressText}`;
                        
                        // Remove any existing location text
                        const existingText = geolocateButton.querySelector('span:not(.mapboxgl-ctrl-icon)');
                        if (existingText) {
                            existingText.remove();
                        }
                        
                        geolocateButton.appendChild(locationText);
                        this.locationLabelSet = true;
                    }
                } catch (error) {
                    console.error('Error reverse geocoding:', error);
                }
            }

            if (this.isTracking && event.coords && event.coords.heading) {
                this.map.easeTo({
                    bearing: event.coords.heading,
                    duration: 300
                });
            }
        });
    }

    // Add separate handler for orientation
    handleOrientation = (event) => {
        if (event.alpha && this.isTracking) {
            const bearing = 360 - event.alpha;
            this.map.easeTo({
                bearing: bearing,
                duration: 100
            });
        }
    }
} 