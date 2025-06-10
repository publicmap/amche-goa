// URL API - Handles URL parameter synchronization for map layers
// Supports deep linking with ?atlas=X and ?layers=X parameters

class URLManager {
    constructor(mapLayerControl, map) {
        this.mapLayerControl = mapLayerControl;
        this.map = map;
        this.isUpdatingFromURL = false; // Prevent circular updates
        this.pendingURLUpdate = null; // Debounce URL updates
        
        // Set up browser history handling
        this.setupHistoryHandling();
        
        console.log('🔗 Map URL Manager initialized');
    }

    /**
     * Convert a layer config to a URL-friendly representation
     */
    layerToURL(layer) {
        // If it's a simple layer with just an ID, return the ID
        if (layer.id && Object.keys(layer).length === 1) {
            return layer.id;
        }
        
        // If it's a complex layer, return minified JSON
        const minified = JSON.stringify(layer);
        return minified;
    }

    /**
     * Parse layers from URL parameter (reusing existing logic from map-init.js)
     */
    parseLayersFromUrl(layersParam) {
        if (!layersParam) return [];
        
        const layers = [];
        let currentItem = '';
        let braceCount = 0;
        let inQuotes = false;
        let escapeNext = false;
        
        // Parse the comma-separated string, being careful about JSON objects
        for (let i = 0; i < layersParam.length; i++) {
            const char = layersParam[i];
            
            if (escapeNext) {
                currentItem += char;
                escapeNext = false;
                continue;
            }
            
            if (char === '\\') {
                currentItem += char;
                escapeNext = true;
                continue;
            }
            
            if (char === '"' && !escapeNext) {
                inQuotes = !inQuotes;
            }
            
            if (!inQuotes) {
                if (char === '{') {
                    braceCount++;
                } else if (char === '}') {
                    braceCount--;
                }
            }
            
            if (char === ',' && braceCount === 0 && !inQuotes) {
                // Found a separator, process current item
                const trimmedItem = currentItem.trim();
                if (trimmedItem) {
                    if (trimmedItem.startsWith('{') && trimmedItem.endsWith('}')) {
                        try {
                            const parsedLayer = JSON.parse(trimmedItem);
                            layers.push(parsedLayer);
                        } catch (error) {
                            console.warn('Failed to parse layer JSON:', trimmedItem, error);
                            layers.push({ id: trimmedItem });
                        }
                    } else {
                        layers.push({ id: trimmedItem });
                    }
                }
                currentItem = '';
            } else {
                currentItem += char;
            }
        }
        
        // Process the last item
        const trimmedItem = currentItem.trim();
        if (trimmedItem) {
            if (trimmedItem.startsWith('{') && trimmedItem.endsWith('}')) {
                try {
                    const parsedLayer = JSON.parse(trimmedItem);
                    layers.push(parsedLayer);
                } catch (error) {
                    console.warn('Failed to parse layer JSON:', trimmedItem, error);
                    layers.push({ id: trimmedItem });
                }
            } else {
                layers.push({ id: trimmedItem });
            }
        }
        
        return layers;
    }

    /**
     * Get currently active layers from the map layer control
     */
    getCurrentActiveLayers() {
        if (!this.mapLayerControl || !this.mapLayerControl._state) {
            return [];
        }

        const activeLayers = [];
        
        // Iterate through all groups in the layer control
        this.mapLayerControl._state.groups.forEach((group, groupIndex) => {
            if (this.isGroupActive(groupIndex)) {
                // Use the original layer configuration if it exists
                if (group._originalJson) {
                    // If this is a custom layer from URL, preserve its original JSON
                    try {
                        const originalLayer = JSON.parse(group._originalJson);
                        activeLayers.push(originalLayer);
                    } catch (error) {
                        // Fallback to ID if JSON parsing fails
                        if (group.id) {
                            activeLayers.push({ id: group.id });
                        }
                    }
                } else if (group.id) {
                    // Simple layer with just an ID
                    activeLayers.push({ id: group.id });
                } else if (group.layers && group.layers.length > 0) {
                    // For style groups with sublayers, check which sublayers are active
                    const activeSubLayers = this.getActiveSubLayers(groupIndex);
                    if (activeSubLayers.length > 0) {
                        // Create a representation for this group's active sublayers
                        activeLayers.push({
                            id: group.title || `group-${groupIndex}`,
                            sublayers: activeSubLayers
                        });
                    }
                } else {
                    // Generic group
                    activeLayers.push({
                        id: group.title || `group-${groupIndex}`,
                        type: group.type || 'source'
                    });
                }
            }
        });

        return activeLayers;
    }

    /**
     * Check if a group is currently active/visible
     */
    isGroupActive(groupIndex) {
        if (!this.mapLayerControl._sourceControls || !this.mapLayerControl._sourceControls[groupIndex]) {
            return false;
        }

        const $groupControl = $(this.mapLayerControl._sourceControls[groupIndex]);
        const $toggle = $groupControl.find('.toggle-switch input[type="checkbox"]');
        
        return $toggle.length > 0 && $toggle.prop('checked');
    }

    /**
     * Get active sublayers for a style group
     */
    getActiveSubLayers(groupIndex) {
        if (!this.mapLayerControl._sourceControls || !this.mapLayerControl._sourceControls[groupIndex]) {
            return [];
        }

        const $groupControl = $(this.mapLayerControl._sourceControls[groupIndex]);
        const $sublayerToggles = $groupControl.find('.layer-controls .toggle-switch input[type="checkbox"]');
        const activeSubLayers = [];

        $sublayerToggles.each((index, toggle) => {
            if ($(toggle).prop('checked')) {
                const layerId = $(toggle).attr('id');
                if (layerId) {
                    activeSubLayers.push(layerId);
                }
            }
        });

        return activeSubLayers;
    }

    /**
     * Update URL with current layer state
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
        let layersParam = null;
        let atlasParam = null;

        // Handle layers parameter
        if (options.updateLayers !== false) {
            const activeLayers = this.getCurrentActiveLayers();
            layersParam = this.serializeLayersForURL(activeLayers);
            const currentLayersParam = urlParams.get('layers');

            if (layersParam !== currentLayersParam) {
                hasChanges = true;
            }
        }

        // Handle atlas parameter (preserve existing atlas config)
        if (options.atlas !== undefined) {
            if (options.atlas) {
                atlasParam = typeof options.atlas === 'string' ? options.atlas : JSON.stringify(options.atlas);
                if (urlParams.get('atlas') !== atlasParam) {
                    hasChanges = true;
                }
            } else {
                if (urlParams.has('atlas')) {
                    hasChanges = true;
                }
            }
        }

        // Update URL if there are changes
        if (hasChanges) {
            // Build URL manually to avoid URL encoding issues (like %2C for commas)
            const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
            const otherParams = new URLSearchParams(window.location.search);
            
            // Always remove the parameters we're managing to avoid duplicates
            otherParams.delete('layers');
            otherParams.delete('atlas');
            
            // Build the new URL manually to avoid URL encoding
            let newUrl = baseUrl;
            const params = [];
            
            // Add other parameters first
            if (otherParams.toString()) {
                params.push(otherParams.toString());
            }
            
            // Add atlas parameter if it exists (either new or preserved from current URL)
            const currentAtlas = atlasParam || (options.atlas === undefined ? urlParams.get('atlas') : null);
            if (currentAtlas) {
                params.push('atlas=' + currentAtlas);
            }
            
            // Add layers parameter if present
            if (layersParam) {
                params.push('layers=' + layersParam);
            }
            
            // Combine all parameters
            if (params.length > 0) {
                newUrl += '?' + params.join('&');
            }
            
            // Add hash if it exists
            if (window.location.hash) {
                newUrl += window.location.hash;
            }
            
            window.history.replaceState(null, '', newUrl);
            console.log('🔗 Updated URL (prettified):', newUrl);
            
            // Trigger custom event for other components (like ShareLink)
            window.dispatchEvent(new CustomEvent('urlUpdated', { 
                detail: { url: newUrl, activeLayers: this.getCurrentActiveLayers() }
            }));
        }
    }

    /**
     * Serialize active layers for URL parameter
     */
    serializeLayersForURL(layers) {
        if (!layers || layers.length === 0) {
            return '';
        }

        return layers.map(layer => {
            return this.layerToURL(layer);
        }).join(',');
    }

    /**
     * Update URL when layers change
     */
    onLayersChanged() {
        console.log('🔗 Layers changed, updating URL');
        this.updateURL({ updateLayers: true });
    }

    /**
     * Apply URL parameters to layer control (called on page load)
     */
    async applyURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const layersParam = urlParams.get('layers');
        
        if (!layersParam) {
            console.log('🔗 No layers parameter to apply');
            return false;
        }

        this.isUpdatingFromURL = true;
        let applied = false;

        try {
            console.log('🔗 Applying layers from URL:', layersParam);
            
            // Wait for map and layer control to be ready
            await this.waitForMapReady();
            
            // Parse layers from URL
            const urlLayers = this.parseLayersFromUrl(layersParam);
            console.log('🔗 Parsed URL layers:', urlLayers);
            
            // Apply the layer state
            applied = await this.applyLayerState(urlLayers);

        } catch (error) {
            console.error('🔗 Error applying URL parameters:', error);
        } finally {
            this.isUpdatingFromURL = false;
        }

        return applied;
    }

    /**
     * Wait for map and layer control to be ready
     */
    async waitForMapReady() {
        return new Promise((resolve) => {
            const checkReady = () => {
                if (this.map && this.map.loaded() && this.mapLayerControl && this.mapLayerControl._state) {
                    resolve();
                } else {
                    setTimeout(checkReady, 100);
                }
            };
            checkReady();
        });
    }

    /**
     * Apply layer state from URL parameters
     */
    async applyLayerState(urlLayers) {
        // This would need to be implemented based on the specific layer control logic
        // For now, return true to indicate success
        console.log('🔗 Would apply layer state:', urlLayers);
        return true;
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
     * Get current URL with all parameters
     */
    getCurrentURL() {
        return window.location.href;
    }

    /**
     * Get shareable URL for current state
     */
    getShareableURL() {
        // Return current URL which should already have the latest layer state
        return this.getCurrentURL();
    }

    /**
     * Initialize event listeners on the layer control
     */
    initializeLayerControlListeners() {
        if (!this.mapLayerControl) {
            console.warn('🔗 MapLayerControl not available for URL sync');
            return;
        }

        // Listen for layer toggle events
        // We'll need to patch into the layer control's toggle methods
        this.patchLayerControlMethods();
    }

    /**
     * Patch layer control methods to trigger URL updates
     */
    patchLayerControlMethods() {
        if (!this.mapLayerControl) return;

        // Store original method
        const originalToggleSourceControl = this.mapLayerControl._toggleSourceControl;
        
        // Patch the toggle method
        this.mapLayerControl._toggleSourceControl = (groupIndex, visible) => {
            // Call original method
            const result = originalToggleSourceControl.call(this.mapLayerControl, groupIndex, visible);
            
            // Update URL after layer change
            if (!this.isUpdatingFromURL) {
                this.onLayersChanged();
            }
            
            return result;
        };

        console.log('🔗 Patched layer control methods for URL sync');
    }

    /**
     * Listen for layer control events using DOM event delegation
     */
    setupLayerControlEventListeners() {
        // Listen for checkbox changes in layer controls
        $(document).on('change', '.toggle-switch input[type="checkbox"]', () => {
            if (!this.isUpdatingFromURL) {
                this.onLayersChanged();
            }
        });

        // Listen for sl-show/sl-hide events on layer groups
        $(document).on('sl-show sl-hide', 'sl-details', () => {
            if (!this.isUpdatingFromURL) {
                this.onLayersChanged();
            }
        });

        console.log('🔗 Set up layer control event listeners');
    }

    /**
     * Manual sync method for external use
     */
    syncURL() {
        this.updateURL({ updateLayers: true });
    }
}

// Export the URLManager class
export { URLManager }; 