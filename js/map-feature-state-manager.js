/**
 * MapFeatureStateManager - Centralized feature state management
 * 
 * Single source of truth for all feature interactions across the application.
 * Uses event-driven architecture to notify components of state changes.
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
    }

    /**
     * Register a layer for feature interactions
     */
    registerLayer(layerConfig) {
        console.log(`[StateManager] Registering layer: ${layerConfig.id}`);
        this._layerConfig.set(layerConfig.id, layerConfig);
        
        if (layerConfig.inspect) {
            this._activeInteractiveLayers.add(layerConfig.id);
            this._setupLayerEventsWithRetry(layerConfig);
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
        
        this._scheduleRender('feature-hover', { featureId, layerId, lngLat, feature });
    }

    /**
     * Handle feature click
     */
    onFeatureClick(feature, layerId, lngLat) {
        const featureId = this._getFeatureId(feature);
        
        // Clear all selections (single selection mode) and emit events
        const clearedFeatures = this._clearAllSelections();
        
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
        
        this._scheduleRender('feature-click', { featureId, layerId, lngLat, feature, clearedFeatures });
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
     * Clear all selected features (public method)
     */
    clearAllSelections() {
        console.log('[StateManager] Manually clearing all selections');
        const clearedFeatures = this._clearAllSelections();
        
        // Force immediate re-render for manual clears
        if (clearedFeatures.length > 0) {
            this._emitStateChange('selections-cleared', { clearedFeatures, manual: true });
            // Also trigger a general re-render
            this._scheduleRender('selections-cleared', { clearedFeatures, manual: true });
        }
        
        return clearedFeatures;
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
     * Get all active layers (both with and without features)
     */
    getActiveLayers() {
        const activeLayers = new Map();
        
        this._activeInteractiveLayers.forEach(layerId => {
            const layerConfig = this._layerConfig.get(layerId);
            const features = this.getLayerFeatures(layerId);
            
            if (layerConfig) {
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
    }

    /**
     * Register selectable layers (for backwards compatibility with search control)
     */
    registerSelectableLayers(layers) {
        // This method is kept for backwards compatibility but the new architecture
        // handles layer registration differently through the layer control
    }

    /**
     * Register hoverable layers (for backwards compatibility with search control)
     */
    registerHoverableLayers(layers) {
        // This method is kept for backwards compatibility but the new architecture
        // handles layer registration differently through the layer control
    }

    /**
     * Watch for layer additions (for backwards compatibility with search control)
     */
    watchLayerAdditions() {
        // This method is kept for backwards compatibility but the new architecture
        // handles layer events differently
    }

    // Private methods
    _setupLayerEventsWithRetry(layerConfig, retryCount = 0) {
        const maxRetries = 3;
        const retryDelay = 300; // ms
        
        const matchingLayerIds = this._getMatchingLayerIds(layerConfig);
        
        if (matchingLayerIds.length === 0 && retryCount < maxRetries) {
            // Only log on first and last attempts to reduce noise
            if (retryCount === 0 || retryCount === maxRetries - 1) {
                console.log(`[StateManager] Setting up events for ${layerConfig.id}, attempt ${retryCount + 1}/${maxRetries}`);
            }
            setTimeout(() => {
                this._setupLayerEventsWithRetry(layerConfig, retryCount + 1);
            }, retryDelay);
            return;
        }
        
        if (matchingLayerIds.length === 0) {
            // Only warn if this layer was expected to be interactive
            if (layerConfig.inspect) {
                console.warn(`[StateManager] No interactive layers found for ${layerConfig.id}`);
            }
            return;
        }
        
        this._setupLayerEvents(layerConfig);
    }

    _setupLayerEvents(layerConfig) {
        const layerId = layerConfig.id;
        
        // Remove existing listeners first
        this._removeLayerEvents(layerId);
        
        // Get all possible layer IDs that might match this layer config
        const matchingLayerIds = this._getMatchingLayerIds(layerConfig);
        
        if (matchingLayerIds.length === 0) {
            console.warn(`[StateManager] No matching layers found for ${layerId}`);
            return;
        }
        
        console.log(`[StateManager] Setting up events for ${layerId} on layers:`, matchingLayerIds);
        
        // Add listeners to all matching layers
        matchingLayerIds.forEach(actualLayerId => {
            this._map.on('mousemove', actualLayerId, (e) => {
                if (e.features.length > 0) {
                    this.onFeatureHover(e.features[0], layerId, e.lngLat);
                }
            });
            
            this._map.on('mouseleave', actualLayerId, () => {
                this.onFeatureLeave(layerId);
            });
            
            this._map.on('click', actualLayerId, (e) => {
                if (e.features.length > 0) {
                    this.onFeatureClick(e.features[0], layerId, e.lngLat);
                }
            });
        });
    }

    _getMatchingLayerIds(layerConfig) {
        const style = this._map.getStyle();
        if (!style.layers) return [];
        
        const layerId = layerConfig.id;
        const matchingIds = [];
        
        console.log(`[StateManager] Finding matching layers for: ${layerId}`, layerConfig);
        
        // Strategy 1: Direct ID match
        if (style.layers.some(l => l.id === layerId)) {
            matchingIds.push(layerId);
            console.log(`[StateManager] Direct match found: ${layerId}`);
        }
        
        // Strategy 2: Layers that start with the layer ID (common pattern for geojson layers)
        const prefixMatches = style.layers
            .filter(l => l.id.startsWith(layerId + '-') || l.id.startsWith(layerId + ' '))
            .map(l => l.id);
        if (prefixMatches.length > 0) {
            console.log(`[StateManager] Prefix matches found:`, prefixMatches);
        }
        matchingIds.push(...prefixMatches);
        
        // Strategy 3: For vector layers with sourceLayer property
        if (layerConfig.sourceLayer) {
            const sourceLayerMatches = style.layers
                .filter(l => l['source-layer'] === layerConfig.sourceLayer)
                .map(l => l.id);
            if (sourceLayerMatches.length > 0) {
                console.log(`[StateManager] Source layer matches for '${layerConfig.sourceLayer}':`, sourceLayerMatches);
            }
            matchingIds.push(...sourceLayerMatches);
        }
        
        // Strategy 4: For style layers, check source-layer matching (legacy)
        if (layerConfig.sourceLayers && Array.isArray(layerConfig.sourceLayers)) {
            const sourceLayerMatches = style.layers
                .filter(l => l['source-layer'] && layerConfig.sourceLayers.includes(l['source-layer']))
                .map(l => l.id);
            if (sourceLayerMatches.length > 0) {
                console.log(`[StateManager] Source layers matches:`, sourceLayerMatches);
            }
            matchingIds.push(...sourceLayerMatches);
        }
        
        // Strategy 5: For grouped layers, check sub-layers
        if (layerConfig.layers && Array.isArray(layerConfig.layers)) {
            layerConfig.layers.forEach(subLayer => {
                if (subLayer.sourceLayer) {
                    const subMatches = style.layers
                        .filter(l => l['source-layer'] === subLayer.sourceLayer)
                        .map(l => l.id);
                    if (subMatches.length > 0) {
                        console.log(`[StateManager] Sub-layer matches for '${subLayer.sourceLayer}':`, subMatches);
                    }
                    matchingIds.push(...subMatches);
                }
            });
        }
        
        // Strategy 6: GeoJSON source matching
        if (layerConfig.type === 'geojson') {
            const sourceId = `geojson-${layerId}`;
            const geojsonMatches = style.layers
                .filter(l => l.source === sourceId)
                .map(l => l.id);
            if (geojsonMatches.length > 0) {
                console.log(`[StateManager] GeoJSON matches for source '${sourceId}':`, geojsonMatches);
            }
            matchingIds.push(...geojsonMatches);
        }
        
        // Strategy 7: Vector tile source matching - check by source ID
        if (layerConfig.source) {
            const sourceMatches = style.layers
                .filter(l => l.source === layerConfig.source)
                .map(l => l.id);
            if (sourceMatches.length > 0) {
                console.log(`[StateManager] Source matches for '${layerConfig.source}':`, sourceMatches);
            }
            matchingIds.push(...sourceMatches);
        }
        
        // Strategy 8: Fuzzy matching for common patterns
        const fuzzyMatches = style.layers
            .filter(l => {
                // Match layers that contain the layer ID as a substring
                return l.id.includes(layerId) || layerId.includes(l.id);
            })
            .map(l => l.id);
        if (fuzzyMatches.length > 0) {
            console.log(`[StateManager] Fuzzy matches:`, fuzzyMatches);
        }
        matchingIds.push(...fuzzyMatches);
        
        // Remove duplicates and filter out layers that aren't interactive
        const uniqueIds = [...new Set(matchingIds)];
        
        // Only return layers that have sources with vector data or are interactive
        const filteredIds = uniqueIds.filter(id => {
            const layer = style.layers.find(l => l.id === id);
            if (!layer) return false;
            
            // Skip non-interactive layer types
            if (['background', 'raster', 'hillshade'].includes(layer.type)) {
                return false;
            }
            
            return true;
        });
        
        console.log(`[StateManager] Final matching layers for ${layerId}:`, filteredIds);
        
        // If no matches found, log available layers for debugging
        if (filteredIds.length === 0) {
            console.warn(`[StateManager] No matches found for ${layerId}. Available layers:`, 
                style.layers.map(l => ({ id: l.id, type: l.type, source: l.source, sourceLayer: l['source-layer'] })));
        }
        
        return filteredIds;
    }

    _removeLayerEvents(layerId) {
        // Get all the actual layer IDs we might have set up events for
        const layerConfig = this._layerConfig.get(layerId);
        if (layerConfig) {
            const matchingIds = this._getMatchingLayerIds(layerConfig);
            matchingIds.forEach(actualLayerId => {
                try {
                    this._map.off('mousemove', actualLayerId);
                    this._map.off('mouseleave', actualLayerId);
                    this._map.off('click', actualLayerId);
                } catch (error) {
                    // Layer might not exist, ignore errors
                }
            });
        }
        
        // Also try to remove events for the original layer ID (fallback)
        try {
            this._map.off('mousemove', layerId);
            this._map.off('mouseleave', layerId);
            this._map.off('click', layerId);
        } catch (error) {
            // Layer might not exist, ignore errors
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
        const clearedFeatures = [];
        
        console.log('[StateManager] Clearing all selections');
        
        this._selectedFeatures.forEach((features, layerId) => {
            features.forEach(featureId => {
                const state = this._featureStates.get(featureId);
                if (state) {
                    clearedFeatures.push({ featureId, layerId });
                    
                    if (!state.isHovered && !this._starredFeatures.has(featureId)) {
                        this._featureStates.delete(featureId);
                    } else {
                        this._updateFeatureState(featureId, { isSelected: false });
                    }
                }
            });
        });
        
        this._selectedFeatures.clear();
        
        // Emit event for cleared selections if any were cleared
        if (clearedFeatures.length > 0) {
            console.log('[StateManager] Cleared selections:', clearedFeatures);
            this._emitStateChange('selections-cleared', { clearedFeatures });
        }
        
        return clearedFeatures;
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
            this._emitStateChange('cleanup', { removedFeatures: featuresToDelete });
        }
    }

    dispose() {
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