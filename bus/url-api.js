// URL API - Handles URL parameter synchronization for transit explorer
// Supports deep linking with ?route=X and ?stop=X parameters

class URLManager {
    constructor(transitExplorer) {
        this.transitExplorer = transitExplorer;
        this.isUpdatingFromURL = false; // Prevent circular updates
        this.pendingURLUpdate = null; // Debounce URL updates
        
        // Set up browser history handling
        this.setupHistoryHandling();
        
        console.log('🔗 URL Manager initialized');
    }

    /**
     * Convert a name to a URL-friendly slug
     */
    slugify(text) {
        if (!text) return '';
        
        return text
            .toString()
            .toLowerCase()
            .trim()
            // Replace spaces and special characters with hyphens
            .replace(/[\s\-_\.]+/g, '-')
            // Remove special characters except hyphens and alphanumeric
            .replace(/[^\w\-]+/g, '')
            // Remove multiple consecutive hyphens
            .replace(/\-{2,}/g, '-')
            // Remove leading/trailing hyphens
            .replace(/^-+|-+$/g, '');
    }

    /**
     * Find original name from slug by searching through available options
     */
    async findOriginalNameFromSlug(slug, type) {
        if (!slug) return null;
        
        try {
            let features = [];
            
            if (type === 'route') {
                features = this.transitExplorer.map.querySourceFeatures('mumbai-routes', {
                    sourceLayer: 'mumbai-routes'
                });
            } else if (type === 'stop') {
                features = this.transitExplorer.map.querySourceFeatures('mumbai-stops', {
                    sourceLayer: 'mumbai-stops'
                });
            }
            
            // Find feature whose name slugifies to the target slug
            for (const feature of features) {
                const props = feature.properties;
                let names = [];
                
                if (type === 'route') {
                    names = [props.route_short_name, props.route_name].filter(n => n);
                } else if (type === 'stop') {
                    names = [props.name, props.stop_name, props.stop_desc].filter(n => n);
                }
                
                for (const name of names) {
                    if (this.slugify(name) === slug) {
                        return name;
                    }
                }
            }
            
            console.warn(`🔗 Could not find original name for ${type} slug: ${slug}`);
            return null;
            
        } catch (error) {
            console.error(`🔗 Error finding original name for ${type} slug:`, error);
            return null;
        }
    }

    /**
     * Parse URL parameters and return route/stop information
     */
    parseURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const routeParam = urlParams.get('route');
        const stopParam = urlParams.get('stop');
        
        const parsed = {
            route: routeParam ? decodeURIComponent(routeParam) : null,
            stop: stopParam ? decodeURIComponent(stopParam) : null
        };
        
        console.log('🔗 Parsed URL parameters:', parsed);
        return parsed;
    }

    /**
     * Update URL with current selections using slugified names
     */
    updateURL(options = {}) {
        if (this.isUpdatingFromURL) {
            return; // Prevent circular updates
        }

        // Debounce URL updates to avoid too many history entries
        if (this.pendingURLUpdate) {
            clearTimeout(this.pendingURLUpdate);
        }

        this.pendingURLUpdate = setTimeout(() => {
            this._performURLUpdate(options);
        }, 300);
    }

    _performURLUpdate(options = {}) {
        const urlParams = new URLSearchParams(window.location.search);
        let hasChanges = false;

        // Handle route parameter with slugification
        if (options.route !== undefined) {
            if (options.route) {
                const slugifiedRoute = this.slugify(options.route);
                if (urlParams.get('route') !== slugifiedRoute) {
                    urlParams.set('route', slugifiedRoute);
                    hasChanges = true;
                }
            } else {
                if (urlParams.has('route')) {
                    urlParams.delete('route');
                    hasChanges = true;
                }
            }
        }

        // Handle stop parameter with slugification
        if (options.stop !== undefined) {
            if (options.stop) {
                const slugifiedStop = this.slugify(options.stop);
                if (urlParams.get('stop') !== slugifiedStop) {
                    urlParams.set('stop', slugifiedStop);
                    hasChanges = true;
                }
            } else {
                if (urlParams.has('stop')) {
                    urlParams.delete('stop');
                    hasChanges = true;
                }
            }
        }

        // Update URL if there are changes
        if (hasChanges) {
            const newURL = window.location.pathname + 
                          (urlParams.toString() ? '?' + urlParams.toString() : '') + 
                          window.location.hash;
            
            window.history.replaceState(null, '', newURL);
            console.log('🔗 Updated URL:', newURL);
        }
    }

    /**
     * Update URL when route is selected
     */
    onRouteSelected(routeName, routeId) {
        console.log(`🔗 Route selected for URL: ${routeName} (${routeId})`);
        this.updateURL({ route: routeName });
    }

    /**
     * Update URL when stop is selected
     */
    onStopSelected(stopName, stopId) {
        console.log(`🔗 Stop selected for URL: ${stopName} (${stopId})`);
        this.updateURL({ stop: stopName });
    }

    /**
     * Clear URL parameters when selections are cleared
     */
    onSelectionCleared() {
        console.log('🔗 Clearing URL parameters');
        this.updateURL({ route: null, stop: null });
    }

    /**
     * Apply URL parameters to the transit explorer
     */
    async applyURLParameters() {
        const params = this.parseURLParameters();
        
        if (!params.route && !params.stop) {
            console.log('🔗 No URL parameters to apply');
            return false;
        }

        this.isUpdatingFromURL = true;
        let applied = false;

        try {
            // Wait for map to be ready
            await this.waitForMapReady();

            // Apply stop selection first (if present)
            if (params.stop) {
                // Convert slug back to original name
                const originalStopName = await this.findOriginalNameFromSlug(params.stop, 'stop');
                const stopApplied = await this.applyStopFromURL(originalStopName || params.stop);
                if (stopApplied) {
                    applied = true;
                    console.log(`🔗 Applied stop from URL: ${originalStopName || params.stop}`);
                }
            }

            // Apply route selection (if present)
            if (params.route) {
                // Convert slug back to original name
                const originalRouteName = await this.findOriginalNameFromSlug(params.route, 'route');
                const routeApplied = await this.applyRouteFromURL(originalRouteName || params.route);
                if (routeApplied) {
                    applied = true;
                    console.log(`🔗 Applied route from URL: ${originalRouteName || params.route}`);
                }
            }

        } catch (error) {
            console.error('🔗 Error applying URL parameters:', error);
        } finally {
            this.isUpdatingFromURL = false;
        }

        return applied;
    }

    /**
     * Wait for map to be ready
     */
    async waitForMapReady() {
        return new Promise((resolve) => {
            const checkReady = () => {
                if (this.transitExplorer.map && 
                    this.transitExplorer.map.isSourceLoaded('mumbai-stops') && 
                    this.transitExplorer.map.isSourceLoaded('mumbai-routes')) {
                    resolve();
                } else {
                    setTimeout(checkReady, 500);
                }
            };
            checkReady();
        });
    }

    /**
     * Apply stop selection from URL parameter
     */
    async applyStopFromURL(stopName) {
        try {
            // Query all stop features
            const stopFeatures = this.transitExplorer.map.querySourceFeatures('mumbai-stops', {
                sourceLayer: 'mumbai-stops'
            });

            // Find matching stop by name (case-insensitive, flexible matching)
            const matchingStop = stopFeatures.find(feature => {
                const props = feature.properties;
                const names = [
                    props.name,
                    props.stop_name,
                    props.stop_desc
                ].filter(name => name);

                return names.some(name => 
                    name.toLowerCase().includes(stopName.toLowerCase()) ||
                    stopName.toLowerCase().includes(name.toLowerCase())
                );
            });

            if (matchingStop) {
                // Use the existing stop selection logic
                this.transitExplorer.handleStopClick(matchingStop, [matchingStop]);
                
                // Center map on the stop
                if (matchingStop.geometry && matchingStop.geometry.coordinates) {
                    this.transitExplorer.map.flyTo({
                        center: matchingStop.geometry.coordinates,
                        zoom: Math.max(15, this.transitExplorer.map.getZoom()),
                        duration: 2000
                    });
                }
                
                return true;
            } else {
                console.warn(`🔗 Stop not found: ${stopName}`);
                return false;
            }

        } catch (error) {
            console.error('🔗 Error applying stop from URL:', error);
            return false;
        }
    }

    /**
     * Apply route selection from URL parameter
     */
    async applyRouteFromURL(routeName) {
        try {
            // Query all route features
            const routeFeatures = this.transitExplorer.map.querySourceFeatures('mumbai-routes', {
                sourceLayer: 'mumbai-routes'
            });

            // Find matching route by name (exact match first, then partial)
            let matchingRoute = routeFeatures.find(feature => {
                const props = feature.properties;
                return props.route_short_name === routeName || 
                       props.route_name === routeName;
            });

            // If no exact match, try partial matching
            if (!matchingRoute) {
                matchingRoute = routeFeatures.find(feature => {
                    const props = feature.properties;
                    const names = [
                        props.route_short_name,
                        props.route_name
                    ].filter(name => name);

                    return names.some(name => 
                        name.toLowerCase().includes(routeName.toLowerCase()) ||
                        routeName.toLowerCase().includes(name.toLowerCase())
                    );
                });
            }

            if (matchingRoute) {
                // Use the existing route selection logic
                this.transitExplorer.handleRouteClick(matchingRoute);
                
                // Fit map to route bounds if possible
                this.fitMapToRoute(matchingRoute);
                
                return true;
            } else {
                console.warn(`🔗 Route not found: ${routeName}`);
                return false;
            }

        } catch (error) {
            console.error('🔗 Error applying route from URL:', error);
            return false;
        }
    }

    /**
     * Fit map to show the selected route
     */
    fitMapToRoute(routeFeature) {
        try {
            if (routeFeature.geometry && routeFeature.geometry.coordinates) {
                const coordinates = routeFeature.geometry.coordinates;
                
                // Create bounds from route coordinates
                const bounds = new mapboxgl.LngLatBounds();
                
                if (routeFeature.geometry.type === 'LineString') {
                    coordinates.forEach(coord => bounds.extend(coord));
                } else if (routeFeature.geometry.type === 'MultiLineString') {
                    coordinates.forEach(line => {
                        line.forEach(coord => bounds.extend(coord));
                    });
                }
                
                // Fit map to bounds with padding
                this.transitExplorer.map.fitBounds(bounds, {
                    padding: 50,
                    duration: 2000,
                    maxZoom: 14
                });
            }
        } catch (error) {
            console.error('🔗 Error fitting map to route:', error);
        }
    }

    /**
     * Set up browser history handling (back/forward buttons)
     */
    setupHistoryHandling() {
        window.addEventListener('popstate', (event) => {
            console.log('🔗 Browser navigation detected, applying URL parameters');
            this.applyURLParameters();
        });
    }

    /**
     * Get current selections from the transit explorer
     */
    getCurrentSelections() {
        const selections = {
            route: null,
            stop: null
        };

        // Get current route selection
        if (this.transitExplorer.currentHighlightedDepartures) {
            selections.route = this.transitExplorer.currentHighlightedDepartures.routeName;
        }

        // Get current stop selection
        if (this.transitExplorer.currentSelectedStop) {
            selections.stop = this.transitExplorer.currentSelectedStop.name;
        } else if (this.transitExplorer.currentStop) {
            const props = this.transitExplorer.currentStop.properties;
            selections.stop = props.name || props.stop_name;
        }

        return selections;
    }

    /**
     * Sync URL with current selections (useful for manual sync)
     */
    syncURL() {
        const selections = this.getCurrentSelections();
        this.updateURL(selections);
    }

    /**
     * Get shareable URL for current state
     */
    getShareableURL() {
        const selections = this.getCurrentSelections();
        const urlParams = new URLSearchParams();

        if (selections.route) {
            urlParams.set('route', this.slugify(selections.route));
        }
        if (selections.stop) {
            urlParams.set('stop', this.slugify(selections.stop));
        }

        const baseURL = window.location.origin + window.location.pathname;
        return baseURL + (urlParams.toString() ? '?' + urlParams.toString() : '');
    }

    /**
     * Test slugification with examples
     */
    testSlugification() {
        const examples = [
            'Dr K B Hedgewar Chowk',
            'A-494',
            'Mumbai Central Station',
            'T.S. Chanakya (N.S.S)',
            'Worli-Koliwada (W)',
            'St. Xavier\'s College'
        ];
        
        console.log('🔗 Slugification examples:');
        examples.forEach(name => {
            console.log(`  "${name}" → "${this.slugify(name)}"`);
        });
    }
}

// Export the URLManager class
export { URLManager }; 