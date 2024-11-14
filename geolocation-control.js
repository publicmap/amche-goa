class GeolocationManager {
    constructor(map) {
        this.map = map;
        this.setupGeolocation();
    }

    setupGeolocation() {
        // Add geolocate control with bearing tracking
        this.geolocate = new mapboxgl.GeolocateControl({
            positionOptions: {
                enableHighAccuracy: true
            },
            trackUserLocation: true,
            showUserHeading: true
        });
        
        this.map.addControl(this.geolocate);

        // Track user's heading changes
        this.geolocate.on('trackuserlocationstart', () => {
            // When tracking starts, watch for heading changes
            window.addEventListener('deviceorientationabsolute', (event) => {
                if (event.alpha) {  // alpha represents compass heading
                    // Convert device orientation to map bearing
                    const bearing = 360 - event.alpha;
                    this.map.easeTo({
                        bearing: bearing,
                        duration: 100  // Smooth transition duration in milliseconds
                    });
                }
            });
        });

        // Trigger geolocation once after map load
        this.map.once('load', () => {
            setTimeout(() => {
                this.geolocate.trigger();
            }, 10000);
        });

        // Original geolocate event listener (keep this as backup)
        this.geolocate.on('geolocate', (event) => {
            console.log('A geolocate event has occurred.');
            if (event.coords && event.coords.heading) {
                this.map.easeTo({
                    bearing: event.coords.heading,
                    duration: 300
                });
            }
        });
    }
} 