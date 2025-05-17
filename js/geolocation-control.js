class GeolocationManager {
    constructor(map) {
        this.map = map;
        this.setupGeolocation();
        this.locationLabelSet = false;
        this.isTracking = false;
        this.locationErrorCount = 0;
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
            $(window).on('deviceorientationabsolute', this.handleOrientation);
        });

        this.geolocate.on('trackuserlocationend', () => {
            this.isTracking = false;
            $(window).off('deviceorientationabsolute', this.handleOrientation);
        });

        // Handle geolocation errors
        this.geolocate.on('error', (error) => {
            this.locationErrorCount++;
            console.warn('Geolocation error:', error);
            
            // Update the geolocate button to show error
            const $geolocateButton = $('.mapboxgl-ctrl-geolocate');
            if ($geolocateButton.length) {
                // Remove any existing location text
                $geolocateButton.find('span:not(.mapboxgl-ctrl-icon)').remove();
                
                // Add error message
                let errorMessage = 'Location unavailable';
                if (this.locationErrorCount > 1) {
                    errorMessage += ' - Try moving to an open area';
                }
                
                $('<span>', {
                    text: errorMessage,
                    css: { 
                        marginLeft: '5px',
                        color: '#d9534f' 
                    }
                }).appendTo($geolocateButton);
                
                // Style the button to indicate error
                $geolocateButton.css({
                    width: 'auto',
                    minWidth: '30px',
                    whiteSpace: 'nowrap',
                    padding: '6px 10px'
                });
                
                const $buttonParent = $geolocateButton.parent();
                $buttonParent.css({
                    minWidth: 'auto',
                    width: 'auto'
                });
            }
            
            // Reset the error count after some time
            setTimeout(() => {
                this.locationErrorCount = 0;
            }, 60000);
        });

        // Handle successful geolocation
        this.geolocate.on('geolocate', async (event) => {
            this.lastPosition = event;
            this.locationErrorCount = 0;
            
            // Set initial map position
            this.map.easeTo({
                center: [event.coords.longitude, event.coords.latitude],
                zoom: 18,
                pitch: 0,
                bearing: 0, // North
                duration: 1000 // 1 second animation
            });
            
            if (!this.locationLabelSet) {
                try {
                    const response = await fetch(
                        `https://api.mapbox.com/geocoding/v5/mapbox.places/${event.coords.longitude},${event.coords.latitude}.json?access_token=${mapboxgl.accessToken}&types=poi,address,neighborhood,locality,place&limit=1`
                    );
                    const data = await response.json();
                    
                    const feature = data.features[0];
                    let addressText = 'Unknown location';
                    
                    if (feature) {
                        const parts = [];
                        
                        if (feature.properties?.name) {
                            parts.push(feature.properties.name);
                        }
                        
                        if (feature.context) {
                            const relevantTypes = ['neighborhood', 'locality', 'place', 'district'];
                            feature.context
                                .filter(ctx => relevantTypes.includes(ctx.id.split('.')[0]))
                                .forEach(ctx => parts.push(ctx.text));
                        }
                        
                        addressText = parts.join(', ');
                    }
                    
                    // Update the geolocate button using jQuery
                    const $geolocateButton = $('.mapboxgl-ctrl-geolocate');
                    if ($geolocateButton.length) {
                        const $buttonParent = $geolocateButton.parent();
                        
                        // Style the container
                        $buttonParent.css({
                            minWidth: 'auto',
                            width: 'auto'
                        });
                        
                        // Style the button
                        $geolocateButton.css({
                            width: 'auto',
                            minWidth: '30px',
                            whiteSpace: 'nowrap',
                            padding: '6px 10px'
                        });
                        
                        // Remove any existing location text
                        $geolocateButton.find('span:not(.mapboxgl-ctrl-icon)').remove();
                        
                        // Add new location text
                        $('<span>', {
                            text: `My location: ${addressText}`,
                            css: { marginLeft: '5px' }
                        }).appendTo($geolocateButton);
                        
                        this.locationLabelSet = true;
                    }
                } catch (error) {
                    console.error('Error reverse geocoding:', error);
                }
            }

            if (this.isTracking && event.coords?.heading) {
                this.map.easeTo({
                    bearing: event.coords.heading,
                    duration: 300
                });
            }
        });
    }

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