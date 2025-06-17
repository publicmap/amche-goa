/**
 * MapFeatureStateManager - Centralized feature state management
 * 
 * Single source of truth for all feature interactions across the application.
 * Uses event-driven architecture to notify components of state changes.
 * 
 * This replaces the dual-state management between MapLayerControl and MapFeatureControl
 * with a single, coordinated state manager that handles all feature interactions.
 */

export class MapFeatureStateManager extends EventTarget {
    constructor(map) {
        super();
        this._map = map;
        
        // Single source of truth for all feature states
        this._featureStates = new Map(); // featureId -> FeatureState
        this._activeHoverFeatures = new Map(); // layerId -> Set<featureId>
        this._selectedFeatures = new Map(); // layerId -> Set<featureId>
        this._starredFeatures = new Set(); // Set<featureId>
        
        // Layer configuration
        this._layerConfig = new Map(); // layerId -> LayerConfig
        this._activeInteractiveLayers = new Set();
        
        // Performance optimization
        this._renderScheduled = false;
        this._cleanupInterval = null;
        
        this._setupCleanup();
        console.log('[StateManager] Initialized');
    }

    /**
     * Register a layer for feature interactions
     */
    registerLayer(layerConfig) {
        this._layerConfig.set(layerConfig.id, layerConfig);
        
        if (layerConfig.inspect) {
            this._activeInteractiveLayers.add(layerConfig.id);
            this._setupLayerEvents(layerConfig);
            console.log(`[StateManager] Registered interactive layer: ${layerConfig.id}`);
        }
        
        this._emitStateChange('layer-registered', { layerId: layerConfig.id });
    }

    /**
     * Unregister a layer (when toggled off)
     */
    unregisterLayer(layerId) {
        console.log(`[StateManager] Unregistering layer: ${layerId}`);
        
        // Clean up all features for this layer
        this._cleanupLayerFeatures(layerId);
        
        // Remove layer events
        this._removeLayerEvents(layerId);
        
        this._activeInteractiveLayers.delete(layerId);
        this._emitStateChange('layer-unregistered', { layerId });
    }

    /**
     * Handle feature hover
     */
    onFeatureHover(feature, layerId, lngLat) {
        const featureId = this._getFeatureId(feature);
        
        // Clear previous hover for this layer
        this._clearLayerHover(layerId);
        
        // Set new hover
        if (!this._activeHoverFeatures.has(layerId)) {
            this._activeHoverFeatures.set(layerId, new Set());
        }
        this._activeHoverFeatures.get(layerId).add(featureId);
        
        // Update feature state
        this._updateFeatureState(featureId, {
            feature,
            layerId,
            lngLat,
            isHovered: true,
            timestamp: Date.now()
        });
        
        this._scheduleRender('feature-hover', { featureId, layerId });
    }

    /**
     * Handle feature click
     */
    onFeatureClick(feature, layerId, lngLat) {
        const featureId = this._getFeatureId(feature);
        console.log(`[StateManager] Feature clicked: ${featureId} on layer ${layerId}`);
        
        // Clear all selections (single selection mode)
        this._clearAllSelections();
        
        // Set new selection
        if (!this._selectedFeatures.has(layerId)) {
            this._selectedFeatures.set(layerId, new Set());
        }
        this._selectedFeatures.get(layerId).add(featureId);
        
        // Update feature state
        this._updateFeatureState(featureId, {
            feature,
            layerId,
            lngLat,
            isSelected: true,
            timestamp: Date.now()
        });
        
        this._scheduleRender('feature-click', { featureId, layerId });
    }

    /**
     * Handle feature leave
     */
    onFeatureLeave(layerId) {
        this._clearLayerHover(layerId);
        this._scheduleRender('feature-leave', { layerId });
    }

    /**
     * Toggle feature starred state
     */
    toggleFeatureStar(featureId) {
        const featureState = this._featureStates.get(featureId);
        if (!featureState) return;
        
        const isStarred = this._starredFeatures.has(featureId);
        
        if (isStarred) {
            this._starredFeatures.delete(featureId);
        } else {
            this._starredFeatures.add(featureId);
        }
        
        this._updateFeatureState(featureId, { isStarred: !isStarred });
        this._scheduleRender('feature-star-toggle', { featureId, isStarred: !isStarred });
    }

    /**
     * Close/remove a selected feature
     */
    closeSelectedFeature(featureId) {
        const featureState = this._featureStates.get(featureId);
        if (!featureState) return;
        
        // Remove from selected features
        const layerId = featureState.layerId;
        const selectedSet = this._selectedFeatures.get(layerId);
        if (selectedSet) {
            selectedSet.delete(featureId);
            if (selectedSet.size === 0) {
                this._selectedFeatures.delete(layerId);
            }
        }
        
        // Remove feature state if not hovered or starred
        if (!featureState.isHovered && !this._starredFeatures.has(featureId)) {
            this._featureStates.delete(featureId);
        } else {
            this._updateFeatureState(featureId, { isSelected: false });
        }
        
        this._scheduleRender('feature-close', { featureId, layerId });
    }

    /**
     * Get all features for a layer
     */
    getLayerFeatures(layerId) {
        const features = new Map();
        
        this._featureStates.forEach((state, featureId) => {
            if (state.layerId === layerId) {
                // Enhance state with computed properties
                const enhancedState = {
                    ...state,
                    isStarred: this._starredFeatures.has(featureId),
                    isSelected: this._selectedFeatures.get(layerId)?.has(featureId) || false
                };
                features.set(featureId, enhancedState);
            }
        });
        
        return features;
    }

    /**
     * Get all active layers with features
     */
    getActiveLayers() {
        const activeLayers = new Map();
        
        this._activeInteractiveLayers.forEach(layerId => {
            const layerConfig = this._layerConfig.get(layerId);
            const features = this.getLayerFeatures(layerId);
            
            if (layerConfig && features.size > 0) {
                activeLayers.set(layerId, {
                    config: layerConfig,
                    features
                });
            }
        });
        
        return activeLayers;
    }

    /**
     * Get the layer configuration for a layer ID
     */
    getLayerConfig(layerId) {
        return this._layerConfig.get(layerId);
    }

    /**
     * Check if a layer is currently interactive
     */
    isLayerInteractive(layerId) {
        return this._activeInteractiveLayers.has(layerId);
    }

    /**
     * Set debug mode (for backwards compatibility with search control)
     */
    setDebug(enabled) {
        this._debug = enabled;
        if (enabled) {
            console.log('[StateManager] Debug mode enabled');
        }
    }

    /**
     * Register selectable layers (for backwards compatibility with search control)
     */
    registerSelectableLayers(layers) {
        console.log('[StateManager] registerSelectableLayers called (compatibility method):', layers);
        // This method is kept for backwards compatibility but the new architecture
        // handles layer registration differently through the layer control
    }

    /**
     * Register hoverable layers (for backwards compatibility with search control)
     */
    registerHoverableLayers(layers) {
        console.log('[StateManager] registerHoverableLayers called (compatibility method):', layers);
        // This method is kept for backwards compatibility but the new architecture
        // handles layer registration differently through the layer control
    }

    /**
     * Watch for layer additions (for backwards compatibility with search control)
     */
    watchLayerAdditions() {
        console.log('[StateManager] watchLayerAdditions called (compatibility method)');
        // This method is kept for backwards compatibility but the new architecture
        // handles layer events differently
    }

    // Private methods
    _setupLayerEvents(layerConfig) {
        const layerId = layerConfig.id;
        
        // Remove existing listeners first
        this._removeLayerEvents(layerId);
        
        // Check if layer actually exists on map
        const style = this._map.getStyle();
        const layerExists = style.layers && style.layers.some(l => 
            l.id === layerId || l.id.startsWith(layerId)
        );
        
        if (!layerExists) {
            console.warn(`[StateManager] Layer ${layerId} not found on map, skipping event setup`);
            return;
        }
        
        // Add new listeners
        this._map.on('mousemove', layerId, (e) => {
            if (e.features.length > 0) {
                this.onFeatureHover(e.features[0], layerId, e.lngLat);
            }
        });
        
        this._map.on('mouseleave', layerId, () => {
            this.onFeatureLeave(layerId);
        });
        
        this._map.on('click', layerId, (e) => {
            if (e.features.length > 0) {
                this.onFeatureClick(e.features[0], layerId, e.lngLat);
            }
        });
        
        console.log(`[StateManager] Set up events for layer: ${layerId}`);
    }

    _removeLayerEvents(layerId) {
        try {
            this._map.off('mousemove', layerId);
            this._map.off('mouseleave', layerId);
            this._map.off('click', layerId);
        } catch (error) {
            // Layer might not exist, ignore errors
            console.warn(`[StateManager] Could not remove events for layer ${layerId}:`, error);
        }
    }

    _updateFeatureState(featureId, updates) {
        const existing = this._featureStates.get(featureId) || {};
        this._featureStates.set(featureId, { ...existing, ...updates });
    }

    _clearLayerHover(layerId) {
        const hoveredFeatures = this._activeHoverFeatures.get(layerId);
        if (hoveredFeatures) {
            hoveredFeatures.forEach(featureId => {
                const state = this._featureStates.get(featureId);
                if (state && !state.isSelected && !this._starredFeatures.has(featureId)) {
                    this._featureStates.delete(featureId);
                } else if (state) {
                    this._updateFeatureState(featureId, { isHovered: false });
                }
            });
            this._activeHoverFeatures.delete(layerId);
        }
    }

    _clearAllSelections() {
        this._selectedFeatures.forEach((features, layerId) => {
            features.forEach(featureId => {
                const state = this._featureStates.get(featureId);
                if (state && !state.isHovered && !this._starredFeatures.has(featureId)) {
                    this._featureStates.delete(featureId);
                } else if (state) {
                    this._updateFeatureState(featureId, { isSelected: false });
                }
            });
        });
        this._selectedFeatures.clear();
    }

    _cleanupLayerFeatures(layerId) {
        const featuresToDelete = [];
        
        this._featureStates.forEach((state, featureId) => {
            if (state.layerId === layerId) {
                featuresToDelete.push(featureId);
            }
        });
        
        featuresToDelete.forEach(featureId => {
            this._featureStates.delete(featureId);
            this._starredFeatures.delete(featureId);
        });
        
        this._activeHoverFeatures.delete(layerId);
        this._selectedFeatures.delete(layerId);
    }

    _scheduleRender(eventType, data) {
        if (!this._renderScheduled) {
            this._renderScheduled = true;
            requestAnimationFrame(() => {
                this._emitStateChange(eventType, data);
                this._renderScheduled = false;
            });
        }
    }

    _emitStateChange(eventType, data) {
        this.dispatchEvent(new CustomEvent('state-change', {
            detail: { eventType, data, timestamp: Date.now() }
        }));
    }

    _getFeatureId(feature) {
        if (feature.id !== undefined) return feature.id;
        if (feature.properties?.id) return feature.properties.id;
        if (feature.properties?.fid) return feature.properties.fid;
        
        // Fallback to geometry hash
        const geomStr = JSON.stringify(feature.geometry);
        return this._hashCode(geomStr);
    }

    _hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }

    _setupCleanup() {
        this._cleanupInterval = setInterval(() => {
            this._cleanupStaleFeatures();
        }, 30000); // Clean up every 30 seconds
    }

    _cleanupStaleFeatures() {
        const now = Date.now();
        const maxAge = 60000; // 1 minute
        
        const featuresToDelete = [];
        
        this._featureStates.forEach((state, featureId) => {
            if (!state.isSelected && 
                !this._starredFeatures.has(featureId) && 
                !state.isHovered &&
                (now - state.timestamp) > maxAge) {
                featuresToDelete.push(featureId);
            }
        });
        
        featuresToDelete.forEach(featureId => {
            this._featureStates.delete(featureId);
        });
        
        if (featuresToDelete.length > 0) {
            console.log(`[StateManager] Cleaned up ${featuresToDelete.length} stale features`);
            this._emitStateChange('cleanup', { removedFeatures: featuresToDelete });
        }
    }

    dispose() {
        console.log('[StateManager] Disposing...');
        
        if (this._cleanupInterval) {
            clearInterval(this._cleanupInterval);
        }
        
        this._activeInteractiveLayers.forEach(layerId => {
            this._removeLayerEvents(layerId);
        });
        
        this._featureStates.clear();
        this._activeHoverFeatures.clear();
        this._selectedFeatures.clear();
        this._starredFeatures.clear();
        this._layerConfig.clear();
        this._activeInteractiveLayers.clear();
    }
}

// Export for both ES6 modules and global usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapFeatureStateManager;
}
if (typeof window !== 'undefined') {
    window.MapFeatureStateManager = MapFeatureStateManager;
} 