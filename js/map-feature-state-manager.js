/**
 * MapFeatureStateManager - A class to handle Mapbox GL feature state management
 * for hover and selection effects across multiple layers
 */
class MapFeatureStateManager {
    /**
     * @param {Object} map - The Mapbox GL map instance
     */
    constructor(map) {
        this.map = map;
        this.hoveredFeatureId = null;
        this.hoveredSourceId = null;
        this.hoveredSourceLayer = null;
        this.selectedFeatureId = null;
        this.selectedSourceId = null;
        this.selectedSourceLayer = null;
        this.hoverableLayerIds = [];
        this.selectableLayerIds = [];
        this.popupContent = null;
        this.popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            maxWidth: '300px'
        });
        
        // Bind methods to maintain 'this' context
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseLeave = this._onMouseLeave.bind(this);
        this._onClick = this._onClick.bind(this);
        
        // Debug flag
        this.debug = false;
    }

    /**
     * Enable or disable debug logging
     * @param {boolean} enabled - Whether to enable debug logging
     */
    setDebug(enabled) {
        this.debug = enabled;
    }

    /**
     * Log debug information if debug mode is enabled
     * @private
     * @param {...any} args - Arguments to log
     */
    _debugLog(...args) {
        if (this.debug) {
            console.log('[FeatureStateManager]', ...args);
        }
    }

    /**
     * Register layers for hover interactivity
     * @param {Array} layerConfigs - Array of layer configuration objects
     * Each config should have: { id, source, sourceLayer, idProperty }
     */
    registerHoverableLayers(layerConfigs) {
        this.hoverableLayerIds = layerConfigs.map(config => ({
            id: config.id,
            source: config.source || config.id,
            sourceLayer: config.sourceLayer,
            idProperty: config.idProperty || 'id'
        }));
        
        this._debugLog('Registered hoverable layers:', this.hoverableLayerIds);
        
        // Set up event listeners if not already
        if (this.hoverableLayerIds.length > 0) {
            this._setupEventListeners();
        }
    }

    /**
     * Register layers for selection interactivity
     * @param {Array} layerConfigs - Array of layer configuration objects
     * Each config should have: { id, source, sourceLayer, idProperty }
     */
    registerSelectableLayers(layerConfigs) {
        this.selectableLayerIds = layerConfigs.map(config => ({
            id: config.id,
            source: config.source || config.id,
            sourceLayer: config.sourceLayer,
            idProperty: config.idProperty || 'id'
        }));
        
        this._debugLog('Registered selectable layers:', this.selectableLayerIds);
        
        // Set up event listeners if not already
        if (this.selectableLayerIds.length > 0) {
            this._setupEventListeners();
        }
    }

    /**
     * Check if a layer exists in the map
     * @private
     * @param {string} layerId - The ID of the layer to check
     * @returns {boolean} - Whether the layer exists
     */
    _layerExists(layerId) {
        try {
            return !!this.map.getLayer(layerId);
        } catch (e) {
            return false;
        }
    }

    /**
     * Get a list of currently available layers from the registered layer IDs
     * @private
     * @param {Array} registeredLayers - Array of registered layer configs
     * @returns {Array} - Array of layer IDs that currently exist in the map
     */
    _getAvailableLayers(registeredLayers) {
        return registeredLayers
            .filter(config => this._layerExists(config.id))
            .map(config => config.id);
    }

    /**
     * Set up the necessary mouse event listeners on the map
     * @private
     */
    _setupEventListeners() {
        // Remove any existing event listeners first
        this._removeEventListeners();
        
        // Add the new event listeners
        this.map.on('mousemove', this._onMouseMove);
        this.map.on('mouseleave', this._onMouseLeave);
        this.map.on('click', this._onClick);
        
        this._debugLog('Event listeners set up');
    }

    /**
     * Remove event listeners from the map
     * @private
     */
    _removeEventListeners() {
        this.map.off('mousemove', this._onMouseMove);
        this.map.off('mouseleave', this._onMouseLeave);
        this.map.off('click', this._onClick);
        
        this._debugLog('Event listeners removed');
    }

    /**
     * Handle mousemove event to update hover states
     * @private
     * @param {Object} e - The mousemove event object
     */
    _onMouseMove(e) {
        // Clear current hover state
        this._resetHoverState();
        
        // Change the cursor style
        this.map.getCanvas().style.cursor = '';
        
        // Get only layers that currently exist in the map
        const availableLayers = this._getAvailableLayers(this.hoverableLayerIds);
        
        if (availableLayers.length === 0) {
            this._debugLog('No hoverable layers currently available in the map');
            return;
        }
        
        try {
            // Query features from available layers
            const features = this.map.queryRenderedFeatures(e.point, { layers: availableLayers });
            
            if (!features.length) {
                this._debugLog('No features found at point');
                return;
            }
            
            // Get the top feature
            const feature = features[0];
            const layerConfig = this.hoverableLayerIds.find(layer => layer.id === feature.layer.id);
            
            if (!layerConfig) {
                this._debugLog('Layer config not found for feature', feature);
                return;
            }
            
            // Get the appropriate ID for the feature
            const sourceId = layerConfig.source;
            const sourceLayer = layerConfig.sourceLayer;
            const idProperty = layerConfig.idProperty;
            const featureId = feature.properties[idProperty] || feature.id;
            
            if (!featureId) {
                this._debugLog('Feature missing ID property:', feature, idProperty);
                return;
            }
            
            // Set the hover state
            this.hoveredFeatureId = featureId;
            this.hoveredSourceId = sourceId;
            this.hoveredSourceLayer = sourceLayer;
            
            this._debugLog('Setting hover state for feature', featureId, 'in source', sourceId, sourceLayer ? `(sourceLayer: ${sourceLayer})` : '');
            
            this.map.setFeatureState(
                {
                    source: sourceId,
                    sourceLayer: sourceLayer,
                    id: featureId
                },
                { hover: true }
            );
            
            // Change cursor style
            this.map.getCanvas().style.cursor = 'pointer';
            
            // If we have a popupContent function, use it
            if (this.popupContent) {
                const content = this.popupContent(feature, false);
                if (content) {
                    this.popup
                        .setLngLat(e.lngLat)
                        .setHTML(content)
                        .addTo(this.map);
                }
            }
        } catch (err) {
            // Just log the error without breaking
            console.error('Error in feature hover handling:', err);
        }
    }

    /**
     * Handle mouseleave event to clear hover states
     * @private
     */
    _onMouseLeave() {
        this._resetHoverState();
        this.map.getCanvas().style.cursor = '';
        this.popup.remove();
        
        this._debugLog('Mouse left map, reset hover state');
    }

    /**
     * Handle click event to update selection states
     * @private
     * @param {Object} e - The click event object
     */
    _onClick(e) {
        // Get only layers that currently exist in the map
        const availableLayers = this._getAvailableLayers(this.selectableLayerIds);
        
        if (availableLayers.length === 0) {
            this._debugLog('No selectable layers currently available in the map');
            return;
        }
        
        try {
            // Check if we clicked on any selectable layer
            const features = this.map.queryRenderedFeatures(e.point, { layers: availableLayers });
            
            // If we're not clicking on a feature, and there's no selected feature, do nothing
            if (!features.length && !this.selectedFeatureId) {
                this._debugLog('No features clicked, no features selected');
                return;
            }
            
            // If we're not clicking on a feature, but there is a selected feature, clear it
            if (!features.length) {
                this._debugLog('No features clicked, clearing selection');
                this._resetSelectionState();
                return;
            }
            
            // Get the top feature
            const feature = features[0];
            const layerConfig = this.selectableLayerIds.find(layer => layer.id === feature.layer.id);
            
            if (!layerConfig) {
                this._debugLog('Layer config not found for clicked feature', feature);
                return;
            }
            
            // Get the appropriate ID for the feature
            const sourceId = layerConfig.source;
            const sourceLayer = layerConfig.sourceLayer;
            const idProperty = layerConfig.idProperty;
            const featureId = feature.properties[idProperty] || feature.id;
            
            if (!featureId) {
                this._debugLog('Feature missing ID property:', feature, idProperty);
                return;
            }
            
            // If we're clicking on the currently selected feature, deselect it
            if (
                featureId === this.selectedFeatureId && 
                sourceId === this.selectedSourceId && 
                sourceLayer === this.selectedSourceLayer
            ) {
                this._debugLog('Clicking on selected feature, deselecting');
                this._resetSelectionState();
                return;
            }
            
            // Clear any existing selection
            this._resetSelectionState();
            
            // Set the new selection
            this.selectedFeatureId = featureId;
            this.selectedSourceId = sourceId;
            this.selectedSourceLayer = sourceLayer;
            
            this._debugLog('Setting selection state for feature', featureId, 'in source', sourceId, sourceLayer ? `(sourceLayer: ${sourceLayer})` : '');
            
            this.map.setFeatureState(
                {
                    source: sourceId,
                    sourceLayer: sourceLayer,
                    id: featureId
                },
                { selected: true }
            );
            
            // Show a detailed popup if we have the content function
            if (this.popupContent) {
                const content = this.popupContent(feature, true);
                if (content) {
                    this.popup
                        .setLngLat(e.lngLat)
                        .setHTML(content)
                        .addTo(this.map);
                }
            }
        } catch (err) {
            console.error('Error in feature selection handling:', err);
        }
    }

    /**
     * Reset the hover state for the currently hovered feature
     * @private
     */
    _resetHoverState() {
        if (this.hoveredFeatureId) {
            try {
                this._debugLog('Resetting hover state for feature', this.hoveredFeatureId);
                
                this.map.setFeatureState(
                    {
                        source: this.hoveredSourceId,
                        sourceLayer: this.hoveredSourceLayer,
                        id: this.hoveredFeatureId
                    },
                    { hover: false }
                );
            } catch (err) {
                console.error('Error resetting hover state:', err);
            }
            
            this.hoveredFeatureId = null;
            this.hoveredSourceId = null;
            this.hoveredSourceLayer = null;
        }
    }

    /**
     * Reset the selection state for the currently selected feature
     * @private
     */
    _resetSelectionState() {
        if (this.selectedFeatureId) {
            try {
                this._debugLog('Resetting selection state for feature', this.selectedFeatureId);
                
                this.map.setFeatureState(
                    {
                        source: this.selectedSourceId,
                        sourceLayer: this.selectedSourceLayer,
                        id: this.selectedFeatureId
                    },
                    { selected: false }
                );
            } catch (err) {
                console.error('Error resetting selection state:', err);
            }
            
            this.selectedFeatureId = null;
            this.selectedSourceId = null;
            this.selectedSourceLayer = null;
            
            // Remove popup when deselecting
            this.popup.remove();
        }
    }

    /**
     * Set a function to generate popup content
     * @param {Function} contentFn - Function that takes a feature and isSelected flag
     * and returns HTML string for popup content
     */
    setPopupContentFunction(contentFn) {
        this.popupContent = contentFn;
        this._debugLog('Popup content function set');
    }

    /**
     * Clean up all event listeners and state
     */
    cleanup() {
        this._debugLog('Cleaning up feature state manager');
        this._resetHoverState();
        this._resetSelectionState();
        this._removeEventListeners();
        this.popup.remove();
    }

    /**
     * Check if sources for all registered layers exist
     * @returns {Object} - Report with source status for each layer
     */
    checkSourceStatus() {
        const report = {
            hoverable: [],
            selectable: [],
            missingLayers: [],
            missingSources: []
        };
        
        // Check hoverable layers
        this.hoverableLayerIds.forEach(config => {
            const layerExists = this._layerExists(config.id);
            let sourceExists = false;
            
            if (layerExists) {
                try {
                    sourceExists = !!this.map.getSource(config.source);
                } catch (e) {
                    sourceExists = false;
                }
            }
            
            report.hoverable.push({
                id: config.id,
                layerExists,
                sourceExists,
                sourceId: config.source,
                sourceLayer: config.sourceLayer || 'N/A'
            });
            
            if (!layerExists) report.missingLayers.push(config.id);
            if (!sourceExists) report.missingSources.push(config.source);
        });

        // Check selectable layers
        this.selectableLayerIds.forEach(config => {
            const layerExists = this._layerExists(config.id);
            let sourceExists = false;
            
            if (layerExists) {
                try {
                    sourceExists = !!this.map.getSource(config.source);
                } catch (e) {
                    sourceExists = false;
                }
            }
            
            report.selectable.push({
                id: config.id,
                layerExists,
                sourceExists,
                sourceId: config.source,
                sourceLayer: config.sourceLayer || 'N/A'
            });
            
            if (!layerExists && !report.missingLayers.includes(config.id)) 
                report.missingLayers.push(config.id);
            if (!sourceExists && !report.missingSources.includes(config.source)) 
                report.missingSources.push(config.source);
        });

        return report;
    }

    /**
     * Start watching for layers being added to the map
     * This helps with layers that load after the feature state manager is initialized
     */
    watchLayerAdditions() {
        // Watch for changes in the style
        this.map.on('styledata', () => {
            this._debugLog('Style data changed, rechecking available layers');
            
            // Check if any previously unavailable layers are now available
            const report = this.checkSourceStatus();
            
            if (report.missingLayers.length === 0 && report.missingSources.length === 0) {
                this._debugLog('All registered layers and sources are now available!');
            } else {
                this._debugLog(`Still missing: ${report.missingLayers.length} layers, ${report.missingSources.length} sources`);
            }
        });
        
        // Also watch for source additions
        this.map.on('sourcedata', (e) => {
            if (e.isSourceLoaded && e.sourceId) {
                // Check if this source is one we're watching
                const hoverableWithSource = this.hoverableLayerIds.find(config => config.source === e.sourceId);
                const selectableWithSource = this.selectableLayerIds.find(config => config.source === e.sourceId);
                
                if (hoverableWithSource || selectableWithSource) {
                    this._debugLog(`Source ${e.sourceId} has loaded, rechecking available layers`);
                    const report = this.checkSourceStatus();
                    if (report.missingLayers.length === 0 && report.missingSources.length === 0) {
                        this._debugLog('All registered layers and sources are now available!');
                    }
                }
            }
        });
    }
}

// Make the class available globally
window.MapFeatureStateManager = MapFeatureStateManager; 