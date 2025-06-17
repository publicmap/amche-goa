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
        
        // Layer configuration
        this._layerConfig = new Map(); // layerId -> LayerConfig
        this._activeInteractiveLayers = new Set();
        
        // Performance optimization
        this._renderScheduled = false;
        this._cleanupInterval = null;
        
        // No longer using click debouncing - handle multiple features directly
        
        // Hover debouncing to prevent rapid state changes
        this._hoverDebounceTimeout = null;
        this._currentHoverTarget = null;
        
        // Cache layer ID mappings to avoid expensive lookups
        this._layerIdCache = new Map(); // layerId -> actualLayerIds[]
        
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
        
        // Clear cache for this layer
        this._layerIdCache.delete(layerId);
        
        this._activeInteractiveLayers.delete(layerId);
        this._emitStateChange('layer-unregistered', { layerId });
    }

    /**
     * Handle feature hover
     */
    onFeatureHover(feature, layerId, lngLat) {
        const featureId = this._getFeatureId(feature);
        const hoverTarget = `${layerId}:${featureId}`;
        
        // Skip if we're already hovering the same feature
        if (this._currentHoverTarget === hoverTarget) {
            return;
        }
        
        // Clear previous hover timeout
        if (this._hoverDebounceTimeout) {
            clearTimeout(this._hoverDebounceTimeout);
        }
        
        // Debounce hover to prevent rapid state changes
        this._hoverDebounceTimeout = setTimeout(() => {
            // Clear previous hover for this layer
            this._clearLayerHover(layerId);
            
            // Set new hover
            if (!this._activeHoverFeatures.has(layerId)) {
                this._activeHoverFeatures.set(layerId, new Set());
            }
            this._activeHoverFeatures.get(layerId).add(featureId);
            
            // Set Mapbox feature state for hover
            this._setMapboxFeatureState(featureId, layerId, { hover: true });
            
            // Update feature state
            this._updateFeatureState(featureId, {
                feature,
                layerId,
                lngLat,
                isHovered: true,
                timestamp: Date.now()
            });
            
            this._currentHoverTarget = hoverTarget;
            this._scheduleRender('feature-hover', { featureId, layerId, lngLat, feature });
        }, 10); // 10ms debounce
    }

    /**
     * Handle multiple feature clicks directly (no debouncing)
     */
    handleFeatureClicks(clickedFeatures) {
        if (!clickedFeatures || clickedFeatures.length === 0) return;
        
        console.log(`[StateManager] Processing ${clickedFeatures.length} clicked features directly`);
        
        // Check if any of the clicked features are already selected
        const alreadySelectedFeatures = [];
        const newFeatures = [];
        
        clickedFeatures.forEach(({ feature, layerId, lngLat }) => {
            const featureId = this._getFeatureId(feature);
            const isSelected = this._selectedFeatures.get(layerId)?.has(featureId) || false;
            
            if (isSelected) {
                alreadySelectedFeatures.push({ featureId, layerId });
            } else {
                newFeatures.push({ feature, layerId, lngLat, featureId });
            }
        });
        
        // Only toggle off if ALL clicked features are identical to ALL currently selected features
        if (alreadySelectedFeatures.length > 0 && newFeatures.length === 0) {
            // Get all currently selected features across all layers
            const allCurrentlySelected = [];
            this._selectedFeatures.forEach((featureIds, layerId) => {
                featureIds.forEach(featureId => {
                    allCurrentlySelected.push({ featureId, layerId });
                });
            });
            
            // Check if the sets are identical (same features in same layers)
            const clickedSet = new Set(alreadySelectedFeatures.map(f => `${f.layerId}:${f.featureId}`));
            const selectedSet = new Set(allCurrentlySelected.map(f => `${f.layerId}:${f.featureId}`));
            
            const setsAreIdentical = clickedSet.size === selectedSet.size && 
                [...clickedSet].every(item => selectedSet.has(item));
            
            if (setsAreIdentical) {
                console.log(`[StateManager] Toggling off ${alreadySelectedFeatures.length} selected features (identical selection)`);
                
                // Deselect all features at once
                const deselectedLayers = new Set();
                alreadySelectedFeatures.forEach(({ featureId, layerId }) => {
                    this._deselectFeatureInternal(featureId, layerId);
                    deselectedLayers.add(layerId);
                });
                
                // Emit a single batch event for all deselections
                this._scheduleRender('features-batch-deselected', { 
                    deselectedFeatures: alreadySelectedFeatures,
                    affectedLayers: Array.from(deselectedLayers)
                });
                
                // Don't select new features if we're toggling off existing ones
                return;
            }
                 }
         
         // If we reach here, either:
         // 1. No features were already selected (newFeatures.length > 0, alreadySelectedFeatures.length = 0)
         // 2. Some clicked features are selected but the selection sets are different (mixed case)
         // In both cases, clear existing selections and select the new clicked features
         
         const clearedFeatures = this._clearAllSelections(true);
         console.log(`[StateManager] Cleared previous selections, now selecting ${clickedFeatures.length} clicked features`);
         
         const selectedFeatures = [];
         clickedFeatures.forEach(({ feature, layerId, lngLat }) => {
             const featureId = this._getFeatureId(feature);
             
             // Set selection for this feature
             if (!this._selectedFeatures.has(layerId)) {
                 this._selectedFeatures.set(layerId, new Set());
             }
             this._selectedFeatures.get(layerId).add(featureId);
             
             // Set Mapbox feature state for selection
             this._setMapboxFeatureState(featureId, layerId, { selected: true });
             
             // Update feature state
             this._updateFeatureState(featureId, {
                 feature,
                 layerId,
                 lngLat,
                 isSelected: true,
                 timestamp: Date.now()
             });
             
             selectedFeatures.push({ featureId, layerId, feature });
             console.log(`[StateManager] Selected feature: ${featureId} in layer ${layerId}`);
         });
         
         // Emit event for all selections
         if (selectedFeatures.length === 1) {
             this._scheduleRender('feature-click', { 
                 ...selectedFeatures[0],
                 clearedFeatures 
             });
         } else {
             this._scheduleRender('feature-click-multiple', { 
                 selectedFeatures,
                 clearedFeatures 
             });
         }
    }



    /**
     * Handle feature leave
     */
    onFeatureLeave(layerId) {
        // Clear hover timeout if pending
        if (this._hoverDebounceTimeout) {
            clearTimeout(this._hoverDebounceTimeout);
            this._hoverDebounceTimeout = null;
        }
        
        this._currentHoverTarget = null;
        this._clearLayerHover(layerId);
        this._scheduleRender('feature-leave', { layerId });
    }

    /**
     * Close/remove a selected feature
     */
    closeSelectedFeature(featureId) {
        const featureState = this._featureStates.get(featureId);
        if (!featureState) return;
        
        this._deselectFeature(featureId, featureState.layerId);
    }

    /**
     * Deselect a feature (used for close operations - emits individual event)
     */
    _deselectFeature(featureId, layerId) {
        this._deselectFeatureInternal(featureId, layerId);
        
        // Emit individual deselection event to update UI
        this._scheduleRender('feature-deselected', { featureId, layerId });
    }

    /**
     * Internal deselection logic without event emission (for batch operations)
     */
    _deselectFeatureInternal(featureId, layerId) {
        console.log(`[StateManager] Deselecting feature: ${featureId} in layer ${layerId}`);
        
        // Remove from selected features
        const selectedSet = this._selectedFeatures.get(layerId);
        if (selectedSet) {
            selectedSet.delete(featureId);
            if (selectedSet.size === 0) {
                this._selectedFeatures.delete(layerId);
            }
        }
        
        // Remove Mapbox feature state for selection
        this._removeMapboxFeatureState(featureId, layerId, 'selected');
        
        // Update or remove feature state
        const featureState = this._featureStates.get(featureId);
        if (featureState) {
            if (!featureState.isHovered) {
                this._featureStates.delete(featureId);
            } else {
                this._updateFeatureState(featureId, { isSelected: false });
            }
        }
    }

    /**
     * Clear all selected features (public method)
     */
    clearAllSelections(suppressEvent = false) {
        console.log('[StateManager] Manually clearing all selections');
        const clearedFeatures = this._clearAllSelections(suppressEvent);
        
        // Force immediate re-render for manual clears (only if not suppressed)
        if (clearedFeatures.length > 0 && !suppressEvent) {
            this._emitStateChange('selections-cleared', { clearedFeatures, manual: true });
            // Also trigger a general re-render
            this._scheduleRender('selections-cleared', { clearedFeatures, manual: true });
        }
        
        return clearedFeatures;
    }

    _clearAllSelections(suppressEvent = false) {
        const clearedFeatures = [];
        
        console.log('[StateManager] Clearing all selections');
        console.log('[StateManager] Current selected features before clearing:', 
            Array.from(this._selectedFeatures.entries()).map(([layerId, features]) => 
                ({ layerId, featureIds: Array.from(features) })));
        
        this._selectedFeatures.forEach((features, layerId) => {
            features.forEach(featureId => {
                const state = this._featureStates.get(featureId);
                if (state) {
                    clearedFeatures.push({ featureId, layerId });
                    
                    // Remove Mapbox feature state for selection
                    this._removeMapboxFeatureState(featureId, layerId, 'selected');
                    
                    if (!state.isHovered) {
                        console.log(`[StateManager] Removing feature state completely: ${featureId}`);
                        this._featureStates.delete(featureId);
                    } else {
                        console.log(`[StateManager] Clearing selection but keeping feature state: ${featureId} (hovered: ${state.isHovered})`);
                        this._updateFeatureState(featureId, { isSelected: false });
                    }
                } else {
                    console.warn(`[StateManager] Selected feature ${featureId} not found in feature states`);
                }
            });
        });
        
        this._selectedFeatures.clear();
        
        // Emit event for cleared selections if any were cleared
        if (clearedFeatures.length > 0) {
            console.log('[StateManager] Cleared selections:', clearedFeatures);
            if (!suppressEvent) {
                this._emitStateChange('selections-cleared', { clearedFeatures });
            }
        }
        
        console.log('[StateManager] Selected features after clearing:', 
            Array.from(this._selectedFeatures.entries()).map(([layerId, features]) => 
                ({ layerId, featureIds: Array.from(features) })));
        
        return clearedFeatures;
    }

    /**
     * Get all features for a layer
     */
    getLayerFeatures(layerId) {
        const features = new Map();
        
        this._featureStates.forEach((state, featureId) => {
            if (state.layerId === layerId) {
                // Check if this feature is selected
                const isSelected = this._selectedFeatures.get(layerId)?.has(featureId) || false;
                
                // Enhance state with computed properties
                const enhancedState = {
                    ...state,
                    isSelected: isSelected
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
            
            // Click handling is now done globally by the map-feature-control
            // to properly handle overlapping features from multiple layers
        });
    }

    _getMatchingLayerIds(layerConfig) {
        const layerId = layerConfig.id;
        
        // Check cache first
        if (this._layerIdCache.has(layerId)) {
            return this._layerIdCache.get(layerId);
        }
        
        const style = this._map.getStyle();
        if (!style.layers) {
            this._layerIdCache.set(layerId, []);
            return [];
        }
        
        const matchingIds = [];
        
        // Use the same efficient approach as map-layer-controls.js
        // Strategy 1: Direct ID match
        if (style.layers.some(l => l.id === layerId)) {
            matchingIds.push(layerId);
        }
        
        // Strategy 2: For vector layers with sourceLayer property (most common case)
        if (layerConfig.sourceLayer) {
            const sourceLayerMatches = style.layers
                .filter(l => l['source-layer'] === layerConfig.sourceLayer)
                .map(l => l.id);
            matchingIds.push(...sourceLayerMatches);
        }
        
        // Strategy 3: For layers with source matching
        if (layerConfig.source) {
            const sourceMatches = style.layers
                .filter(l => l.source === layerConfig.source)
                .map(l => l.id);
            matchingIds.push(...sourceMatches);
        }
        
        // Strategy 4: GeoJSON source matching
        if (layerConfig.type === 'geojson') {
            const sourceId = `geojson-${layerId}`;
            const geojsonMatches = style.layers
                .filter(l => l.source === sourceId)
                .map(l => l.id);
            matchingIds.push(...geojsonMatches);
        }
        
        // Strategy 5: Prefix matching for common patterns
        const prefixMatches = style.layers
            .filter(l => l.id.startsWith(`vector-layer-${layerId}`) || l.id.startsWith(`${layerId}-`))
            .map(l => l.id);
        matchingIds.push(...prefixMatches);
        
        // Remove duplicates and filter out non-interactive layers
        const uniqueIds = [...new Set(matchingIds)];
        const filteredIds = uniqueIds.filter(id => {
            const layer = style.layers.find(l => l.id === id);
            if (!layer) return false;
            
            // Skip non-interactive layer types
            if (['background', 'raster', 'hillshade'].includes(layer.type)) {
                return false;
            }
            
            return true;
        });
        
        // Cache the result
        this._layerIdCache.set(layerId, filteredIds);
        
        if (filteredIds.length === 0) {
            console.warn(`[StateManager] No interactive layers found for ${layerId}`);
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
                // Remove Mapbox feature state for hover
                this._removeMapboxFeatureState(featureId, layerId, 'hover');
                
                const state = this._featureStates.get(featureId);
                if (state && !state.isSelected) {
                    this._featureStates.delete(featureId);
                } else if (state) {
                    this._updateFeatureState(featureId, { isHovered: false });
                }
            });
            this._activeHoverFeatures.delete(layerId);
        }
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
        
        if (this._hoverDebounceTimeout) {
            clearTimeout(this._hoverDebounceTimeout);
        }
        
        this._activeInteractiveLayers.forEach(layerId => {
            this._removeLayerEvents(layerId);
        });
        
        this._featureStates.clear();
        this._activeHoverFeatures.clear();
        this._selectedFeatures.clear();
        this._layerConfig.clear();
        this._activeInteractiveLayers.clear();
        this._layerIdCache.clear();
    }

    /**
     * Set Mapbox feature state on the map - optimized to set once per source
     */
    _setMapboxFeatureState(featureId, layerId, state) {
        try {
            // Get the layer config to find the source information
            const layerConfig = this._layerConfig.get(layerId);
            if (!layerConfig) return;

            const matchingLayerIds = this._getMatchingLayerIds(layerConfig);
            
            // Group layers by source to avoid duplicate setFeatureState calls
            const sourceGroups = new Map();
            
            matchingLayerIds.forEach(actualLayerId => {
                const layer = this._map.getLayer(actualLayerId);
                if (layer && layer.source) {
                    const sourceKey = `${layer.source}:${layer['source-layer'] || 'default'}`;
                    if (!sourceGroups.has(sourceKey)) {
                        sourceGroups.set(sourceKey, {
                            source: layer.source,
                            sourceLayer: layer['source-layer'],
                            layerIds: []
                        });
                    }
                    sourceGroups.get(sourceKey).layerIds.push(actualLayerId);
                }
            });
            
            // Set feature state once per source
            sourceGroups.forEach((sourceInfo, sourceKey) => {
                try {
                    const featureIdentifier = {
                        source: sourceInfo.source,
                        id: featureId
                    };
                    
                    // Add source-layer if it exists (for vector tiles)
                    if (sourceInfo.sourceLayer) {
                        featureIdentifier.sourceLayer = sourceInfo.sourceLayer;
                    }
                    
                    this._map.setFeatureState(featureIdentifier, state);
                    console.log(`[StateManager] Set Mapbox feature state for ${featureId} on source ${sourceKey} (affects ${sourceInfo.layerIds.length} layers):`, state);
                } catch (error) {
                    // Ignore errors for sources that don't support feature state
                    console.warn(`[StateManager] Could not set feature state for source ${sourceKey}:`, error.message);
                }
            });
        } catch (error) {
            console.warn(`[StateManager] Error setting Mapbox feature state:`, error);
        }
    }

    /**
     * Remove Mapbox feature state from the map - optimized to remove once per source
     */
    _removeMapboxFeatureState(featureId, layerId, stateKey = null) {
        try {
            // Get the layer config to find the source information
            const layerConfig = this._layerConfig.get(layerId);
            if (!layerConfig) return;

            const matchingLayerIds = this._getMatchingLayerIds(layerConfig);
            
            // Group layers by source to avoid duplicate removeFeatureState calls
            const sourceGroups = new Map();
            
            matchingLayerIds.forEach(actualLayerId => {
                const layer = this._map.getLayer(actualLayerId);
                if (layer && layer.source) {
                    const sourceKey = `${layer.source}:${layer['source-layer'] || 'default'}`;
                    if (!sourceGroups.has(sourceKey)) {
                        sourceGroups.set(sourceKey, {
                            source: layer.source,
                            sourceLayer: layer['source-layer'],
                            layerIds: []
                        });
                    }
                    sourceGroups.get(sourceKey).layerIds.push(actualLayerId);
                }
            });
            
            // Remove feature state once per source
            sourceGroups.forEach((sourceInfo, sourceKey) => {
                try {
                    const featureIdentifier = {
                        source: sourceInfo.source,
                        id: featureId
                    };
                    
                    // Add source-layer if it exists (for vector tiles)
                    if (sourceInfo.sourceLayer) {
                        featureIdentifier.sourceLayer = sourceInfo.sourceLayer;
                    }
                    
                    // Remove specific state key or all states
                    if (stateKey) {
                        this._map.removeFeatureState(featureIdentifier, stateKey);
                        console.log(`[StateManager] Removed Mapbox feature state key '${stateKey}' for ${featureId} on source ${sourceKey} (affects ${sourceInfo.layerIds.length} layers)`);
                    } else {
                        this._map.removeFeatureState(featureIdentifier);
                        console.log(`[StateManager] Removed all Mapbox feature states for ${featureId} on source ${sourceKey} (affects ${sourceInfo.layerIds.length} layers)`);
                    }
                } catch (error) {
                    // Ignore errors for sources that don't support feature state
                    console.warn(`[StateManager] Could not remove feature state for source ${sourceKey}:`, error.message);
                }
            });
        } catch (error) {
            console.warn(`[StateManager] Error removing Mapbox feature state:`, error);
        }
    }
}

// Export for both ES6 modules and global usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapFeatureStateManager;
}
if (typeof window !== 'undefined') {
    window.MapFeatureStateManager = MapFeatureStateManager;
} 