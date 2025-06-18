/**
 * MapFeatureControl - Enhanced version using event-driven architecture
 * 
 * This control displays a list of active layers in the bottom right corner of the map.
 * When users interact with features, it shows the feature information under the relevant layer
 * instead of using overlapping popups.
 * 
 * Now uses centralized MapFeatureStateManager for all state management.
 * Updated to use config JSON as source of truth for active layers.
 */

export class MapFeatureControl {
    constructor(options = {}) {
        this.options = {
            position: 'bottom-right',
            maxHeight: '300px',
            maxWidth: '350px',
            minWidth: '250px',
            collapsed: false,
            showHoverPopups: true, // New option to control hover popups
            ...options
        };

        this._map = null;
        this._stateManager = null;
        this._container = null;
        this._layersContainer = null;
        this._isCollapsed = this.options.collapsed;
        this._config = null; // Store config reference
        
        // UI optimization - only re-render changed layers
        this._lastRenderState = new Map();
        this._stateChangeListener = null;
        this._renderScheduled = false;
        
        // Hover popup management
        this._hoverPopup = null;
        this._currentHoveredFeature = null;
        
        // Initialized
    }

    /**
     * Standard Mapbox GL JS control method - called when control is added to map
     */
    onAdd(map) {
        this._map = map;
        this._createContainer();
        return this._container;
    }

    /**
     * Standard Mapbox GL JS control method - called when control is removed from map
     */
    onRemove() {
        this._cleanup();
        if (this._container && this._container.parentNode) {
            this._container.parentNode.removeChild(this._container);
        }
        this._map = null;
        this._stateManager = null;
    }

    /**
     * Standard Mapbox GL JS control method - returns default position
     */
    getDefaultPosition() {
        return this.options.position;
    }

    /**
     * Public method to add the control to a map (following mapbox-choropleth pattern)
     */
    addTo(map) {
        map.addControl(this, this.options.position);
        return this;
    }

    /**
     * Initialize the control with the centralized state manager
     */
    initialize(stateManager, config = null) {
        this._stateManager = stateManager;
        this._config = config;
        
        // If no config provided, try to get it from global state
        if (!this._config && window.layerControl && window.layerControl._config) {
            this._config = window.layerControl._config;
        }
        
        // State manager and config set
        
        // Listen to state changes from the centralized manager
        this._stateChangeListener = (event) => {
            this._handleStateChange(event.detail);
        };
        this._stateManager.addEventListener('state-change', this._stateChangeListener);
        
        // Set up global click handler for feature interactions
        this._setupGlobalClickHandler();
        
        // Initial render
        this._render();
        
        return this;
    }

    /**
     * Set the configuration reference
     */
    setConfig(config) {
        this._config = config;
        this._scheduleRender();
    }

    /**
     * Create the main container and structure
     */
    _createContainer() {
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group map-feature-control';
        
        // Add custom styles
        this._container.style.cssText = `
            background: #666;
            box-shadow: 0 0 0 2px rgba(0,0,0,.1);
            max-height: ${this.options.maxHeight};
            max-width: ${this.options.maxWidth};
            min-width: ${this.options.minWidth};
            overflow: hidden;
            display: flex;
            flex-direction: column;
        `;

        this._createHeader();
        
        this._layersContainer = document.createElement('div');
        this._layersContainer.className = 'feature-control-layers';
        this._layersContainer.style.cssText = `
            flex: 1;
            overflow-y: auto;
            max-height: calc(${this.options.maxHeight} - 50px);
            display: ${this._isCollapsed ? 'none' : 'block'};
        `;
        
        this._container.appendChild(this._layersContainer);
    }

    /**
     * Create the header with title and collapse button
     */
    _createHeader() {
        const header = document.createElement('div');
        header.className = 'feature-control-header';
        header.style.cssText = `
            padding: 2px 12px;
            border-bottom: 1px solid #eee;
            background: #222;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            color: orange;
            cursor: pointer;
        `;

        const title = document.createElement('span');
        title.textContent = 'Map Information';
        
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'feature-control-toggle';
        toggleBtn.innerHTML = this._isCollapsed ? '▲' : '▼';
        toggleBtn.style.cssText = `
            background: none;
            border: none;
            font-size: 10px;
            cursor: pointer;
            color: orange;
        `;

        header.appendChild(title);
        header.appendChild(toggleBtn);

        header.addEventListener('click', () => {
            this._isCollapsed = !this._isCollapsed;
            this._layersContainer.style.display = this._isCollapsed ? 'none' : 'block';
            toggleBtn.innerHTML = this._isCollapsed ? '▲' : '▼';
        });

        this._container.appendChild(header);
    }

    /**
     * Handle state changes from the state manager
     */
    _handleStateChange(detail) {
        const { eventType, data } = detail;
        
        // Optimize rendering based on event type
        switch (eventType) {
            case 'feature-hover':
                this._handleFeatureHover(data);
                // Only update layer header styling for hover, don't render features
                this._updateLayerHeaderHoverState(data.layerId, true);
                break;
            case 'features-batch-hover':
                // Handle batch hover events (PERFORMANCE OPTIMIZED)
                this._handleBatchFeatureHover(data);
                // Update layer header styling for all affected layers
                data.affectedLayers.forEach(layerId => {
                    this._updateLayerHeaderHoverState(layerId, true);
                });
                break;
            case 'features-hover-cleared':
            case 'map-mouse-leave':
                // Clear all hover states
                this._handleAllFeaturesLeave();
                break;
            case 'feature-click':
                // Handle cleared features first if they exist, then the new selection
                if (data.clearedFeatures && data.clearedFeatures.length > 0) {
                    console.log('[FeatureControl] Processing cleared features from click event:', data.clearedFeatures);
                    this._handleSelectionsCleared(data.clearedFeatures);
                }
                // Then render the clicked feature's layer
                this._renderLayer(data.layerId);
                break;
            case 'feature-click-multiple':
                // Handle multiple feature selections from overlapping click
                if (data.clearedFeatures && data.clearedFeatures.length > 0) {
                    console.log('[FeatureControl] Processing cleared features from multiple click event:', data.clearedFeatures);
                    this._handleSelectionsCleared(data.clearedFeatures);
                }
                // Render all affected layers
                const affectedLayers = new Set(data.selectedFeatures.map(f => f.layerId));
                affectedLayers.forEach(layerId => {
                    this._renderLayer(layerId);
                });
                break;
            case 'selections-cleared':
                this._handleSelectionsCleared(data.clearedFeatures);
                break;
            case 'feature-close':
                this._renderLayer(data.layerId);
                break;
            case 'feature-deselected':
                // Handle feature deselection (toggle off)
                console.log(`[FeatureControl] Feature deselected: ${data.featureId} in layer ${data.layerId}`);
                this._renderLayer(data.layerId);
                break;
            case 'features-batch-deselected':
                // Handle batch deselection of multiple features
                console.log(`[FeatureControl] Batch deselected ${data.deselectedFeatures.length} features from layers:`, data.affectedLayers);
                data.affectedLayers.forEach(layerId => {
                    this._renderLayer(layerId);
                });
                break;
            case 'feature-leave':
                this._handleFeatureLeave(data);
                // Remove hover styling from layer header
                this._updateLayerHeaderHoverState(data.layerId, false);
                break;
            case 'layer-registered':
                // Re-render when layers are registered (turned on)
                console.log(`[FeatureControl] Layer registered: ${data.layerId}`);
                this._scheduleRender();
                break;
            case 'layer-unregistered':
                // Re-render when layers are unregistered (turned off)
                // This ensures the feature control stays in sync with layer toggles
                console.log(`[FeatureControl] Layer unregistered: ${data.layerId}`);
                this._scheduleRender();
                break;
            case 'cleanup':
                // Only re-render if visible features were cleaned up
                if (this._hasVisibleFeatures(data.removedFeatures)) {
                    this._scheduleRender();
                }
                break;
        }
    }

    /**
     * Update layer header visual state for hover indication
     */
    _updateLayerHeaderHoverState(layerId, isHovered) {
        const layerElement = this._layersContainer.querySelector(`[data-layer-id="${layerId}"]`);
        if (layerElement) {
            const headerElement = layerElement.querySelector('.feature-control-layer-header');
            if (headerElement) {
                if (isHovered) {
                    headerElement.style.borderColor = '#fbbf24'; // Yellow border for hover
                } else {
                    headerElement.style.borderColor = 'transparent'; // Back to transparent
                }
            }
        }
    }

    /**
     * Handle cleared selections - update UI for all cleared features
     */
    _handleSelectionsCleared(clearedFeatures) {
        console.log('[FeatureControl] Handling cleared selections:', clearedFeatures);
        
        // Get unique layer IDs that had selections cleared
        const affectedLayerIds = [...new Set(clearedFeatures.map(item => item.layerId))];
        
        // Force re-render of all affected layers by clearing their hash cache
        // This ensures the UI properly reflects the cleared state
        affectedLayerIds.forEach(layerId => {
            this._lastRenderState.delete(layerId); // Force update by clearing hash
            this._renderLayer(layerId);
        });
        
        // If no layers had selections, do a full render to ensure clean state
        if (affectedLayerIds.length === 0) {
            this._scheduleRender();
        }
    }

    /**
     * Get active layers from state manager - SINGLE SOURCE OF TRUTH
     */
    _getActiveLayersFromConfig() {
        // Always use state manager as the single source of truth
        // The state manager already knows which layers are registered and interactive
        if (!this._stateManager) {
            return new Map();
        }
        
        const activeLayers = this._stateManager.getActiveLayers();
        console.log(`[FeatureControl] Active layers count: ${activeLayers.size}`, Array.from(activeLayers.keys()));
        return activeLayers;
    }

    /**
     * Schedule a render to avoid excessive re-rendering
     */
    _scheduleRender() {
        if (this._renderScheduled) return;
        
        this._renderScheduled = true;
        // Use immediate requestAnimationFrame for better responsiveness
        requestAnimationFrame(() => {
            this._render();
            this._renderScheduled = false;
        });
    }

    /**
     * Get currently active layers from the layer control (DEPRECATED - kept for compatibility)
     */
    _getCurrentlyActiveLayers() {
        return this._getActiveLayersFromConfig();
    }

    /**
     * Render the control UI - uses state manager as single source of truth
     */
    _render() {
        if (!this._layersContainer || !this._stateManager) return;

        // Get active layers from state manager (single source of truth)
        const activeLayers = this._getActiveLayersFromConfig();
        
        // Don't show empty state immediately - layers might be loading
        if (activeLayers.size === 0) {
            // Only show empty state after a brief delay to avoid flicker during layer loading
            setTimeout(() => {
                const currentActiveLayers = this._getActiveLayersFromConfig();
                if (currentActiveLayers.size === 0) {
                    this._renderEmptyState();
                    this._lastRenderState.clear();
                }
            }, 500);
            return;
        }

        // Clear empty state if it exists
        const emptyState = this._layersContainer.querySelector('.feature-control-empty');
        if (emptyState) {
            emptyState.remove();
        }

        // Get current layer order from config to maintain stable ordering
        const configOrder = this._getConfigLayerOrder();
        const currentLayerIds = new Set(activeLayers.keys());
        const previousLayerIds = new Set(this._lastRenderState.keys());
        
        // Remove layers that are no longer active
        previousLayerIds.forEach(layerId => {
            if (!currentLayerIds.has(layerId)) {
                this._removeLayerElement(layerId);
                this._lastRenderState.delete(layerId);
            }
        });

        // Process layers in config order to maintain stable ordering
        configOrder.forEach(layerId => {
            if (activeLayers.has(layerId)) {
                const layerData = activeLayers.get(layerId);
                const layerHash = this._getLayerDataHash(layerData);
                const previousHash = this._lastRenderState.get(layerId);
                
                if (layerHash !== previousHash) {
                    this._updateSingleLayer(layerId, layerData);
                    this._lastRenderState.set(layerId, layerHash);
                }
            }
        });
    }

    /**
     * Get layer order from config to maintain stable ordering
     */
    _getConfigLayerOrder() {
        if (!this._config || !this._config.groups) {
            // Fallback to alphabetical ordering if no config
            return Array.from(this._stateManager.getActiveLayers().keys()).sort();
        }
        
        // Return layers in the order they appear in config
        return this._config.groups
            .filter(group => group.inspect && this._stateManager.isLayerInteractive(group.id))
            .map(group => group.id);
    }

    /**
     * Update a single layer (preserves position, only updates content)
     */
    _updateSingleLayer(layerId, layerData) {
        const { config, features } = layerData;
        
        // Find existing layer element or create new one
        let layerElement = this._layersContainer.querySelector(`[data-layer-id="${layerId}"]`);
        let isNewElement = false;
        
        if (!layerElement) {
            layerElement = document.createElement('div');
            layerElement.className = 'feature-control-layer';
            layerElement.setAttribute('data-layer-id', layerId);
            layerElement.style.cssText = `border-bottom: 1px solid #eee;`;
            isNewElement = true;
        }

        // Clear existing content
        layerElement.innerHTML = '';

        // Create layer header
        const layerHeader = this._createLayerHeader(config);
        layerElement.appendChild(layerHeader);

        // Only show selected features in inspector
        const selectedFeatures = new Map();
        features.forEach((featureState, featureId) => {
            if (featureState.isSelected) {
                selectedFeatures.set(featureId, featureState);
            }
        });

        console.log(`[FeatureControl] Layer ${layerId}: ${selectedFeatures.size} selected features (${features.size} total)`);

        // Create features container only if there are selected features
        if (config.inspect && selectedFeatures.size > 0) {
            const featuresContainer = document.createElement('div');
            featuresContainer.className = 'feature-control-features';
            featuresContainer.style.cssText = `
                max-height: 200px;
                overflow-y: auto;
            `;

            // Sort and render only selected features
            const sortedFeatures = this._getSortedFeatures(selectedFeatures);
            sortedFeatures.forEach(([featureId, featureState]) => {
                this._renderFeature(featuresContainer, featureState, config);
            });

            layerElement.appendChild(featuresContainer);
        }
        
        // Add to container if it's a new element, maintaining config order
        if (isNewElement) {
            this._insertLayerInOrder(layerElement, layerId);
        }
    }

    /**
     * Insert layer element in the correct position based on config order
     */
    _insertLayerInOrder(layerElement, layerId) {
        const configOrder = this._getConfigLayerOrder();
        const layerIndex = configOrder.indexOf(layerId);
        
        if (layerIndex === -1) {
            // Not found in config, append at end
            this._layersContainer.appendChild(layerElement);
            return;
        }
        
        // Find the position to insert based on config order
        const existingLayers = Array.from(this._layersContainer.children);
        let insertBeforeElement = null;
        
        for (let i = layerIndex + 1; i < configOrder.length; i++) {
            const nextLayerId = configOrder[i];
            const nextElement = existingLayers.find(el => el.getAttribute('data-layer-id') === nextLayerId);
            if (nextElement) {
                insertBeforeElement = nextElement;
                break;
            }
        }
        
        if (insertBeforeElement) {
            this._layersContainer.insertBefore(layerElement, insertBeforeElement);
        } else {
            this._layersContainer.appendChild(layerElement);
        }
    }

    /**
     * Render empty state when no layers are active
     */
    _renderEmptyState() {
        // Clear existing content first
        this._layersContainer.innerHTML = '';
        
        const emptyState = document.createElement('div');
        emptyState.className = 'feature-control-empty';
        emptyState.style.cssText = `
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 12px;
        `;
        emptyState.textContent = 'No active layers to display';
        this._layersContainer.appendChild(emptyState);
    }

    /**
     * Render a single layer by ID (for selective updates)
     */
    _renderLayer(layerId) {
        if (!this._stateManager) return;
        
        const activeLayers = this._stateManager.getActiveLayers();
        const layerData = activeLayers.get(layerId);
        
        if (layerData) {
            this._updateSingleLayer(layerId, layerData);
            this._lastRenderState.set(layerId, this._getLayerDataHash(layerData));
        }
    }

    /**
     * Create layer header with background image support
     */
    _createLayerHeader(config) {
        const layerHeader = document.createElement('div');
        layerHeader.className = 'feature-control-layer-header';
        
        let headerStyle = `
            padding: 8px 12px;
            font-size: 11px;
            font-weight: 600;
            color: #fff;
            border-bottom: 1px solid #eee;
            border: 2px solid transparent;
            border-radius: 4px;
            position: relative;
            background: #333;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.7);
        `;
        
        if (config.headerImage) {
            headerStyle += `
                background-image: url('${config.headerImage}');
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
            `;
            
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.4);
                z-index: 1;
            `;
            layerHeader.appendChild(overlay);
        }
        
        layerHeader.style.cssText = headerStyle;
        
        const headerText = document.createElement('span');
        headerText.style.cssText = 'position: relative; z-index: 2;';
        headerText.textContent = config.title || config.id;
        layerHeader.appendChild(headerText);

        return layerHeader;
    }

    /**
     * Sort features by priority: selected first, then by timestamp
     */
    _getSortedFeatures(featuresMap) {
        const features = Array.from(featuresMap.entries());
        
        return features.sort(([aId, aData], [bId, bData]) => {
            // Sort by timestamp (most recent first)
            return bData.timestamp - aData.timestamp;
        });
    }

    /**
     * Render feature with improved interaction handling
     */
    _renderFeature(container, featureState, layerConfig) {
        const featureElement = document.createElement('div');
        const featureId = this._getFeatureId(featureState.feature);
        
        featureElement.className = 'feature-control-feature selected';
        featureElement.setAttribute('data-feature-id', featureId);
        
        // Selected feature styling
        featureElement.style.cssText = `
            border-bottom: 1px solid #f0f0f0;
            font-size: 11px;
            background:#eee;
            cursor: pointer;
            padding: 0;
        `;

        // Render detailed content for selected features
        const content = this._createFeatureContent(featureState, layerConfig);
        featureElement.appendChild(content);

        container.appendChild(featureElement);
    }

    /**
     * Create feature content with properties table
     */
    _createFeatureContent(featureState, layerConfig) {
        const content = document.createElement('div');
        content.style.cssText = 'padding: 0;';
        
        // Header with feature info

        
        // Properties table content
        const tableContent = document.createElement('div');
        tableContent.style.cssText = 'padding: 8px 12px; max-height: 250px; overflow-y: auto;';
        
        // Build the properties table with intelligent formatting
        const table = document.createElement('table');
        table.style.cssText = `
            width: 100%;
            font-size: 9px;
            border-collapse: collapse;
            margin-bottom: 8px;
        `;
        
        const properties = featureState.feature.properties || {};
        const inspect = layerConfig.inspect || {};
        
        // Get field configuration
        const priorityFields = inspect.fields || [];
        const fieldTitles = inspect.fieldTitles || [];
        const labelField = inspect.label;
        
        // Create field title mapping
        const fieldTitleMap = {};
        priorityFields.forEach((field, index) => {
            if (fieldTitles[index]) {
                fieldTitleMap[field] = fieldTitles[index];
            }
        });
        
        // Organize properties: label first, then priority fields, then remaining fields
        const organizedFields = [];
        
        // 1. Add label field first if it exists and has a value
        if (labelField && properties[labelField] !== undefined && properties[labelField] !== null && properties[labelField] !== '') {
            organizedFields.push({
                key: labelField,
                value: properties[labelField],
                isLabel: true,
                displayName: inspect.title || fieldTitleMap[labelField] || labelField
            });
        }
        
        // 2. Add priority fields in order (excluding label field to avoid duplication)
        priorityFields.forEach(field => {
            if (field !== labelField && properties[field] !== undefined && properties[field] !== null && properties[field] !== '') {
                organizedFields.push({
                    key: field,
                    value: properties[field],
                    isPriority: true,
                    displayName: fieldTitleMap[field] || field
                });
            }
        });
        
        // 3. Add remaining fields
        Object.entries(properties).forEach(([key, value]) => {
            // Skip if already added as label or priority field
            if (key === labelField || priorityFields.includes(key)) {
                return;
            }
            
            // Skip empty values
            if (value === undefined || value === null || value === '') {
                return;
            }
            
            organizedFields.push({
                key: key,
                value: value,
                isOther: true,
                displayName: key
            });
        });
        
        // Render the organized fields
        organizedFields.forEach(field => {
            const row = document.createElement('tr');
            row.style.cssText = 'border-bottom: 1px solid #f0f0f0;';
            
            const keyCell = document.createElement('td');
            keyCell.style.cssText = `
                padding: ${field.isLabel ? '6px 4px' : '4px 4px'};
                font-weight: 600;
                color: ${field.isLabel ? '#111' : field.isPriority ? '#444' : '#666'};
                width: 40%;
                vertical-align: top;
                line-height: 1.2;
            `;
            
            // Create field name display with alias emphasis
            if (field.displayName !== field.key) {
                // Show alias prominently with raw field name below (for all fields including label)
                const aliasDiv = document.createElement('div');
                aliasDiv.style.cssText = `font-weight: 600; margin-bottom: 1px; ${field.isLabel ? 'font-size: 12px;' : ''}`;
                aliasDiv.textContent = field.displayName;
                
                const rawDiv = document.createElement('div');
                rawDiv.style.cssText = `font-size: 8px; font-weight: 400; color: #9ca3af; font-style: italic; ${field.isLabel ? 'color: #6366f1;' : ''}`;
                rawDiv.textContent = field.key;
                
                keyCell.appendChild(aliasDiv);
                keyCell.appendChild(rawDiv);
            } else {
                keyCell.textContent = field.displayName;
            }
            
            const valueCell = document.createElement('td');
            valueCell.style.cssText = `
                padding: ${field.isLabel ? '6px 4px' : '4px 4px'};
                word-break: break-word;
                font-size: ${field.isLabel ? '13px' : '9px'};
                font-weight: ${field.isLabel ? '700' : '400'};
                color: ${field.isLabel ? '#111' : '#333'};
                line-height: 1.2;
                ${field.isLabel ? 'background: #fff;' : ''}
            `;
            valueCell.textContent = String(field.value);
            
            row.appendChild(keyCell);
            row.appendChild(valueCell);
            table.appendChild(row);
        });
        
        // KML export button
        const exportButton = document.createElement('button');
        exportButton.style.cssText = `
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 9px;
            cursor: pointer;
            margin-top: 8px;
        `;
        exportButton.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Export KML
        `;
        
        exportButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this._exportFeatureKML(featureState.feature, layerConfig);
        });
        
        tableContent.appendChild(table);
        tableContent.appendChild(exportButton);
        
        content.appendChild(tableContent);
        
        return content;
    }

    /**
     * Export feature as KML
     */
    _exportFeatureKML(feature, layer) {
        try {
            // Use existing KML conversion function if available
            if (typeof convertToKML === 'function') {
                const fieldValues = layer.inspect?.fields
                    ? layer.inspect.fields
                        .map(field => feature.properties[field])
                        .filter(value => value)
                        .join('_')
                    : '';
                const groupTitle = feature.properties[layer.inspect?.label] || 'Exported';
                const title = fieldValues
                    ? `${fieldValues}_${groupTitle}`
                    : feature.properties[layer.inspect?.label] || 'Exported_Feature';
                const description = layer.inspect?.title || 'Exported from Amche Goa';

                const kmlContent = convertToKML(feature, { title, description });

                const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
                const url = URL.createObjectURL(blob);

                const downloadLink = document.createElement('a');
                downloadLink.href = url;
                downloadLink.download = `${title}.kml`;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                URL.revokeObjectURL(url);
            } else {
                console.warn('KML conversion function not available');
                alert('KML export not available');
            }
        } catch (error) {
            console.error('Error exporting KML:', error);
            alert('Error exporting KML. Please check the console for details.');
        }
    }

    /**
     * Get a unique identifier for a feature
     */
    _getFeatureId(feature) {
        if (feature.id !== undefined) return feature.id;
        if (feature.properties?.id) return feature.properties.id;
        if (feature.properties?.fid) return feature.properties.fid;
        
        const geomStr = JSON.stringify(feature.geometry);
        return this._hashCode(geomStr);
    }

    /**
     * Get a feature ID specifically for deduplication purposes
     * Uses a more comprehensive approach to identify unique features
     */
    _getFeatureIdForDeduplication(feature) {
        // Try standard ID fields first
        if (feature.id !== undefined) return feature.id;
        if (feature.properties?.id) return feature.properties.id;
        if (feature.properties?.fid) return feature.properties.fid;
        
        // For features without explicit IDs, use a combination of key properties
        const props = feature.properties || {};
        
        // Try common identifying properties
        const identifyingProps = ['name', 'title', 'label', 'gid', 'objectid', 'osm_id'];
        for (const prop of identifyingProps) {
            if (props[prop] !== undefined && props[prop] !== null) {
                return `${prop}:${props[prop]}`;
            }
        }
        
        // Fallback to geometry hash for features without identifying properties
        const geomStr = JSON.stringify(feature.geometry);
        return `geom:${this._hashCode(geomStr)}`;
    }

    /**
     * Simple hash function for generating feature IDs
     */
    _hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }

    // Helper methods for new architecture
    _removeLayerElement(layerId) {
        const existing = this._layersContainer.querySelector(`[data-layer-id="${layerId}"]`);
        if (existing) {
            existing.remove();
        }
    }

    _getLayerDataHash(layerData) {
        // Create a comprehensive hash that includes feature selection states
        const features = Array.from(layerData.features.entries());
        const featureHashes = features.map(([featureId, featureState]) => {
            return JSON.stringify({
                id: featureId,
                selected: featureState.isSelected || false,
                timestamp: featureState.timestamp
            });
        });
        
        return JSON.stringify({
            layerId: layerData.config.id,
            featureCount: features.length,
            featureHashes: featureHashes.sort() // Sort for consistent hashing
        });
    }

    _hasVisibleFeatures(removedFeatures) {
        // Check if any of the removed features were currently visible
        return removedFeatures.some(featureId => {
            return this._layersContainer.querySelector(`[data-feature-id="${featureId}"]`);
        });
    }

    /**
     * Set up global click handler to process all feature clicks at once
     */
    _setupGlobalClickHandler() {
        if (this._globalClickHandlerAdded) return;
        
        this._map.on('click', (e) => {
            // Query all features at the click point
            const features = this._map.queryRenderedFeatures(e.point);
            
            // Filter for interactive features from registered layers
            const interactiveFeatures = [];
            
            features.forEach(feature => {
                // Find which registered layer this feature belongs to
                const layerId = this._findLayerIdForFeature(feature);
                if (layerId && this._stateManager.isLayerInteractive(layerId)) {
                    interactiveFeatures.push({
                        feature,
                        layerId,
                        lngLat: e.lngLat
                    });
                }
            });
            
            // Pass all interactive features to the state manager
            if (interactiveFeatures.length > 0) {
                this._stateManager.handleFeatureClicks(interactiveFeatures);
            } else {
                // Clear selections if clicking on empty area
                this._stateManager.clearAllSelections();
            }
        });
        
        // Set up global mousemove handler for better performance
        this._map.on('mousemove', (e) => {
            // Use queryRenderedFeatures with deduplication for optimal performance
            this._handleMouseMoveWithQueryRendered(e);
            
            // Update hover popup position to follow mouse smoothly
            this._updateHoverPopupPosition(e.lngLat);
        });
        
        // Set up global mouseleave handler for the entire map
        this._map.on('mouseleave', () => {
            this._stateManager.handleMapMouseLeave();
        });
        
        this._globalClickHandlerAdded = true;
    }

    /**
     * Find which registered layer a feature belongs to
     */
    _findLayerIdForFeature(feature) {
        if (!feature.layer || !feature.layer.id) return null;
        
        const actualLayerId = feature.layer.id;
        
        // Check all registered layers to see which one this feature belongs to
        const activeLayers = this._stateManager.getActiveLayers();
        for (const [layerId, layerData] of activeLayers) {
            const layerConfig = layerData.config;
            const matchingLayerIds = this._getMatchingLayerIds(layerConfig);
            if (matchingLayerIds.includes(actualLayerId)) {
                return layerId;
            }
        }
        
        return null;
    }

    /**
     * Get matching layer IDs (simplified version of state manager's method)
     */
    _getMatchingLayerIds(layerConfig) {
        const style = this._map.getStyle();
        if (!style.layers) return [];
        
        const layerId = layerConfig.id;
        const matchingIds = [];
        
        // Direct ID match
        if (style.layers.some(l => l.id === layerId)) {
            matchingIds.push(layerId);
        }
        
        // Source layer matching
        if (layerConfig.sourceLayer) {
            const sourceLayerMatches = style.layers
                .filter(l => l['source-layer'] === layerConfig.sourceLayer)
                .map(l => l.id);
            matchingIds.push(...sourceLayerMatches);
        }
        
        // Prefix matching
        const prefixMatches = style.layers
            .filter(l => l.id.startsWith(`vector-layer-${layerId}`) || l.id.startsWith(`${layerId}-`))
            .map(l => l.id);
        matchingIds.push(...prefixMatches);
        
        return [...new Set(matchingIds)];
    }

    /**
     * Clean up event listeners and references
     */
    _cleanup() {
        if (this._stateManager && this._stateChangeListener) {
            this._stateManager.removeEventListener('state-change', this._stateChangeListener);
        }
        
        // Clean up hover popup completely on cleanup
        this._removeHoverPopup();
        this._currentHoveredFeature = null;
        
        this._lastRenderState.clear();
    }

    // These public methods are no longer needed - the state manager handles layer management

    /**
     * Handle feature hover - create popup at mouse location
     */
    _handleFeatureHover(data) {
        const { featureId, layerId, lngLat, feature } = data;
        
        // Skip if hover popups are disabled
        if (!this.options.showHoverPopups) return;
        
        // Skip on mobile devices to avoid conflicts with touch interactions
        if ('ontouchstart' in window) return;
        
        // Update popup with all currently hovered features
        this._updateHoverPopup(lngLat);
    }

    /**
     * Handle batch feature hover (PERFORMANCE OPTIMIZED)
     */
    _handleBatchFeatureHover(data) {
        const { hoveredFeatures, lngLat, affectedLayers } = data;
        
        // Skip if hover popups are disabled
        if (!this.options.showHoverPopups) return;
        
        // Skip on mobile devices to avoid conflicts with touch interactions
        if ('ontouchstart' in window) return;
        
        // Update popup with all currently hovered features in a single operation
        this._updateHoverPopupFromBatch(hoveredFeatures, lngLat);
    }

    /**
     * Handle all features leaving (map mouse leave or hover cleared)
     */
    _handleAllFeaturesLeave() {
        // Clear all layer header hover states
        this._clearAllLayerHeaderHoverStates();
        
        // Hide hover popup smoothly instead of removing it
        this._hideHoverPopup();
        this._currentHoveredFeature = null;
    }

    /**
     * Clear hover states from all layer headers
     */
    _clearAllLayerHeaderHoverStates() {
        const layerElements = this._layersContainer.querySelectorAll('.feature-control-layer');
        layerElements.forEach(layerElement => {
            const headerElement = layerElement.querySelector('.feature-control-layer-header');
            if (headerElement) {
                headerElement.style.borderColor = 'transparent';
            }
        });
    }

    /**
     * Handle feature leave - update or remove hover popup
     */
    _handleFeatureLeave(data) {
        // Check if there are any remaining hovered features
        const hasHoveredFeatures = this._hasAnyHoveredFeatures();
        
        if (!hasHoveredFeatures) {
            // No more hovered features, hide popup smoothly
            this._hideHoverPopup();
            this._currentHoveredFeature = null;
        } else {
            // Still have hovered features, update popup content
            this._updateHoverPopup();
        }
    }

    /**
     * Check if there are any currently hovered features across all layers
     */
    _hasAnyHoveredFeatures() {
        if (!this._stateManager) return false;
        
        const activeLayers = this._stateManager.getActiveLayers();
        for (const [layerId, layerData] of activeLayers) {
            for (const [featureId, featureState] of layerData.features) {
                if (featureState.isHovered) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Update hover popup with all currently hovered features
     */
    _updateHoverPopup(lngLat = null) {
        if (!this._map) return;
        
        // Get all currently hovered features from state manager
        const hoveredFeatures = this._getAllHoveredFeatures();
        
        if (hoveredFeatures.length === 0) {
            this._removeHoverPopup();
            return;
        }
        
        // Use provided lngLat or get from the first hovered feature
        const popupLocation = lngLat || hoveredFeatures[0].featureState.lngLat;
        if (!popupLocation) return;
        
        const content = this._createHoverPopupContent(hoveredFeatures);
        if (!content) return;
        
        // Remove existing popup and create new one
        this._removeHoverPopup();
        
        this._hoverPopup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            className: 'hover-popup'
        })
        .setLngLat(popupLocation)
        .setDOMContent(content)
        .addTo(this._map);
    }

    /**
     * Get all currently hovered features from the state manager
     */
    _getAllHoveredFeatures() {
        if (!this._stateManager) return [];
        
        const hoveredFeatures = [];
        const activeLayers = this._stateManager.getActiveLayers();
        
        activeLayers.forEach((layerData, layerId) => {
            const layerConfig = layerData.config;
            layerData.features.forEach((featureState, featureId) => {
                if (featureState.isHovered && layerConfig.inspect) {
                    hoveredFeatures.push({
                        featureId,
                        layerId,
                        layerConfig,
                        featureState
                    });
                }
            });
        });
        
        return hoveredFeatures;
    }

    /**
     * Remove hover popup completely (for cleanup)
     */
    _removeHoverPopup() {
        if (this._hoverPopup) {
            this._hoverPopup.remove();
            this._hoverPopup = null;
        }
    }

    /**
     * Create hover popup content for single or multiple features
     * Shows feature title, up to 2 additional fields, and layer name
     */
    _createHoverPopupContent(hoveredFeatures) {
        if (hoveredFeatures.length === 0) return null;
        
        const container = document.createElement('div');
        container.className = 'map-popup';
        container.style.cssText = `
            max-width: 280px;
            background: white;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            padding: 6px 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 11px;
            line-height: 1.3;
        `;

        // Render each feature with layer context
        hoveredFeatures.forEach((item, index) => {
            const { featureState, layerConfig, layerId } = item;
            const feature = featureState.feature;
            
            // Add separator between features
            if (index > 0) {
                const separator = document.createElement('div');
                separator.style.cssText = 'border-top: 1px solid #e5e7eb; margin: 6px -2px; padding-top: 6px;';
                container.appendChild(separator);
            }
            
            const featureDiv = document.createElement('div');
            featureDiv.style.cssText = 'padding: 2px;';
            
            // Get feature title from label field or fallback
            const inspect = layerConfig.inspect || {};
            let featureTitle = 'Feature';
            
            if (inspect.label && feature.properties[inspect.label]) {
                featureTitle = String(feature.properties[inspect.label]);
            } else if (feature.properties.name) {
                featureTitle = String(feature.properties.name);
            } else if (feature.properties.title) {
                featureTitle = String(feature.properties.title);
            }
            
            // Feature title with emphasis
            const titleDiv = document.createElement('div');
            titleDiv.style.cssText = 'font-weight: 700; color: #111827; margin-bottom: 3px; font-size: 12px;';
            titleDiv.textContent = featureTitle;
            featureDiv.appendChild(titleDiv);
            
            // Additional fields (up to 2)
            if (inspect.fields && inspect.fields.length > 0) {
                const fieldsContainer = document.createElement('div');
                fieldsContainer.style.cssText = 'margin-bottom: 3px;';
                
                let fieldCount = 0;
                const maxFields = 2;
                
                inspect.fields.forEach((field, fieldIndex) => {
                    if (fieldCount >= maxFields) return;
                    if (field === inspect.label) return; // Skip label field as it's the title
                    
                    const value = feature.properties[field];
                    if (value !== undefined && value !== null && value !== '') {
                        const fieldDiv = document.createElement('div');
                        fieldDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 1px;';
                        
                        const fieldName = document.createElement('span');
                        fieldName.style.cssText = 'color: #6b7280; font-size: 10px; font-weight: 500; flex-shrink: 0;';
                        fieldName.textContent = (inspect.fieldTitles && inspect.fieldTitles[fieldIndex]) || field;
                        
                        const fieldValue = document.createElement('span');
                        fieldValue.style.cssText = 'color: #374151; font-size: 10px; text-align: right; word-break: break-word;';
                        fieldValue.textContent = String(value);
                        
                        fieldDiv.appendChild(fieldName);
                        fieldDiv.appendChild(fieldValue);
                        fieldsContainer.appendChild(fieldDiv);
                        
                        fieldCount++;
                    }
                });
                
                if (fieldsContainer.children.length > 0) {
                    featureDiv.appendChild(fieldsContainer);
                }
            }
            
            // Layer name
            const layerDiv = document.createElement('div');
            layerDiv.style.cssText = 'font-size: 9px; color: #9ca3af; font-style: italic; margin-top: 2px;';
            layerDiv.textContent = `from ${layerConfig.title || layerId}`;
            featureDiv.appendChild(layerDiv);
            
            container.appendChild(featureDiv);
        });

        // Add "click for more" hint
        const hintDiv = document.createElement('div');
        hintDiv.style.cssText = 'font-size: 9px; color: #9ca3af; margin-top: 4px; padding-top: 4px; border-top: 1px solid #f3f4f6; text-align: center; font-style: italic;';
        hintDiv.textContent = hoveredFeatures.length === 1 ? 'Click for details' : `${hoveredFeatures.length} features - click for details`;
        container.appendChild(hintDiv);

        return container;
    }

    /**
     * Update hover popup with batch hover data (PERFORMANCE OPTIMIZED)
     */
    _updateHoverPopupFromBatch(hoveredFeatures, lngLat) {
        if (!this._map) return;
        
        // If no features to show, hide popup but keep it alive for smooth transitions
        if (!hoveredFeatures || hoveredFeatures.length === 0) {
            this._hideHoverPopup();
            return;
        }
        
        // Convert batch data to format expected by popup creation
        const formattedFeatures = hoveredFeatures.map(({ featureId, layerId, feature }) => {
            const layerConfig = this._stateManager.getLayerConfig(layerId);
            return {
                featureId,
                layerId,
                layerConfig,
                featureState: {
                    feature,
                    layerId,
                    lngLat,
                    isHovered: true
                }
            };
        }).filter(item => item.layerConfig && item.layerConfig.inspect);
        
        if (formattedFeatures.length === 0) {
            this._hideHoverPopup();
            return;
        }
        
        const content = this._createHoverPopupContent(formattedFeatures);
        if (!content) {
            this._hideHoverPopup();
            return;
        }
        
        // Create popup if it doesn't exist, or update existing popup
        if (!this._hoverPopup) {
            this._createHoverPopup(lngLat, content);
        } else {
            // Update existing popup content and position
            this._hoverPopup.setDOMContent(content);
            this._hoverPopup.setLngLat(lngLat);
        }
        
        // Show popup if it was hidden
        this._showHoverPopup();
    }

    /**
     * Create a persistent hover popup that follows the mouse
     */
    _createHoverPopup(lngLat, content) {
        this._hoverPopup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            closeOnMove: false, // Don't close when map moves
            className: 'hover-popup',
            maxWidth: '280px',
            offset: [0, -2] // Position 2px above the cursor as requested
        })
        .setLngLat(lngLat)
        .setDOMContent(content)
        .addTo(this._map);
        
        // Make popup non-interactive so it doesn't interfere with mouse events
        const popupElement = this._hoverPopup.getElement();
        if (popupElement) {
            popupElement.style.pointerEvents = 'none';
            popupElement.style.userSelect = 'none';
            // Add smooth transitions
            popupElement.style.transition = 'opacity 0.15s ease-in-out';
        }
    }

    /**
     * Show hover popup with smooth fade-in
     */
    _showHoverPopup() {
        if (!this._hoverPopup) return;
        
        const popupElement = this._hoverPopup.getElement();
        if (popupElement) {
            popupElement.style.opacity = '1';
            popupElement.style.visibility = 'visible';
        }
    }

    /**
     * Hide hover popup with smooth fade-out (but keep it alive)
     */
    _hideHoverPopup() {
        if (!this._hoverPopup) return;
        
        const popupElement = this._hoverPopup.getElement();
        if (popupElement) {
            popupElement.style.opacity = '0';
            popupElement.style.visibility = 'hidden';
        }
    }

    /**
     * Handle mousemove using queryRenderedFeatures with deduplication
     */
    _handleMouseMoveWithQueryRendered(e) {
        // Query all features at the mouse point once
        const features = this._map.queryRenderedFeatures(e.point);
        
        // Group features by source + feature ID to handle fill vs line layer priority
        const featureGroups = new Map(); // key: sourceId:featureId, value: features array
        
        features.forEach(feature => {
            // Find which registered layer this feature belongs to
            const layerId = this._findLayerIdForFeature(feature);
            if (layerId && this._stateManager.isLayerInteractive(layerId)) {
                const sourceId = feature.source || 'unknown';
                const featureId = this._getFeatureIdForDeduplication(feature);
                const groupKey = `${sourceId}:${featureId}`;
                
                if (!featureGroups.has(groupKey)) {
                    featureGroups.set(groupKey, []);
                }
                
                // Get the actual map layer to check its type
                const mapLayer = this._map.getLayer(feature.layer.id);
                const layerType = mapLayer?.type;
                
                featureGroups.get(groupKey).push({
                    feature,
                    layerId,
                    layerType,
                    lngLat: e.lngLat
                });
            }
        });
        
        // Process each feature group to prioritize fill over line
        const interactiveFeatures = [];
        const seenFeatures = new Set(); // Track unique features by layer
        
        featureGroups.forEach((featuresInGroup, groupKey) => {
            // Check if we have both fill and line layers for this feature
            const fillFeatures = featuresInGroup.filter(f => f.layerType === 'fill');
            const lineFeatures = featuresInGroup.filter(f => f.layerType === 'line');
            
            let featuresToUse = featuresInGroup;
            
            // If we have both fill and line, prioritize fill layers
            if (fillFeatures.length > 0 && lineFeatures.length > 0) {
                console.log(`[FeatureControl] Prioritizing fill over line for feature group: ${groupKey}`);
                featuresToUse = fillFeatures;
            }
            
            // Add to final list with deduplication by layerId
            featuresToUse.forEach(({ feature, layerId, lngLat }) => {
                const uniqueKey = `${groupKey}:${layerId}`;
                
                if (!seenFeatures.has(uniqueKey)) {
                    seenFeatures.add(uniqueKey);
                    interactiveFeatures.push({
                        feature,
                        layerId,
                        lngLat
                    });
                }
            });
        });
        
        // Pass all interactive features to the state manager for batch processing
        this._stateManager.handleFeatureHovers(interactiveFeatures, e.lngLat);
    }

    /**
     * Update hover popup position to follow mouse smoothly
     */
    _updateHoverPopupPosition(lngLat) {
        if (!this._hoverPopup) return;
        
        this._hoverPopup.setLngLat(lngLat);
    }
}

// Make available globally for backwards compatibility
if (typeof window !== 'undefined') {
    window.MapFeatureControl = MapFeatureControl;
}
