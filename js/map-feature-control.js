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
            case 'feature-click':
            case 'feature-star-toggle':
            case 'feature-close':
                this._renderLayer(data.layerId);
                break;
            case 'feature-leave':
                this._renderLayer(data.layerId);
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

        // Track what needs updating
        const currentLayerIds = new Set(activeLayers.keys());
        const previousLayerIds = new Set(this._lastRenderState.keys());
        
        // Remove layers that are no longer active
        previousLayerIds.forEach(layerId => {
            if (!currentLayerIds.has(layerId)) {
                this._removeLayerElement(layerId);
                this._lastRenderState.delete(layerId);
            }
        });

        // Add or update layers
        activeLayers.forEach((layerData, layerId) => {
            const layerHash = this._getLayerDataHash(layerData);
            const previousHash = this._lastRenderState.get(layerId);
            
            if (layerHash !== previousHash) {
                this._renderSingleLayer(layerId, layerData);
                this._lastRenderState.set(layerId, layerHash);
            }
        });
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
     * Render a single layer (optimized for selective updates)
     */
    _renderSingleLayer(layerId, layerData) {
        const { config, features } = layerData;
        
        // Remove existing layer element
        this._removeLayerElement(layerId);
        
        const layerElement = document.createElement('div');
        layerElement.className = 'feature-control-layer';
        layerElement.setAttribute('data-layer-id', layerId);
        layerElement.style.cssText = `border-bottom: 1px solid #eee;`;

        // Create layer header
        const layerHeader = this._createLayerHeader(config);
        layerElement.appendChild(layerHeader);

        // Create features container
        if (config.inspect && features.size > 0) {
            const featuresContainer = document.createElement('div');
            featuresContainer.className = 'feature-control-features';
            featuresContainer.style.cssText = `
                max-height: 200px;
                overflow-y: auto;
            `;

            // Sort and render features
            const sortedFeatures = this._getSortedFeatures(features);
            sortedFeatures.forEach(([featureId, featureState]) => {
                this._renderFeature(featuresContainer, featureState, config);
            });

            layerElement.appendChild(featuresContainer);
        }
        
        this._layersContainer.appendChild(layerElement);
    }

    /**
     * Render a single layer by ID (for selective updates)
     */
    _renderLayer(layerId) {
        if (!this._stateManager) return;
        
        const activeLayers = this._stateManager.getActiveLayers();
        const layerData = activeLayers.get(layerId);
        
        if (layerData) {
            this._renderSingleLayer(layerId, layerData);
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
     * Sort features by priority: hovered first, then selected, then starred
     */
    _getSortedFeatures(featuresMap) {
        const features = Array.from(featuresMap.entries());
        
        return features.sort(([aId, aData], [bId, bData]) => {
            const aState = this._featureStates.get(aId) || {};
            const bState = this._featureStates.get(bId) || {};
            
            // Hovered features first
            if (aData.isHover && !bData.isHover) return -1;
            if (!aData.isHover && bData.isHover) return 1;
            
            // Then selected features
            if (aState.selected && !bState.selected) return -1;
            if (!aState.selected && bState.selected) return 1;
            
            // Then starred features
            if (aState.starred && !bState.starred) return -1;
            if (!aState.starred && bState.starred) return 1;
            
            // Finally by timestamp (most recent first)
            return bData.timestamp - aData.timestamp;
        });
    }

    /**
     * Render feature with improved interaction handling
     */
    _renderFeature(container, featureState, layerConfig) {
        const featureElement = document.createElement('div');
        const featureId = this._getFeatureId(featureState.feature);
        
        const displayClass = featureState.isHovered ? 'hover' : (featureState.isSelected ? 'selected' : 'normal');
        featureElement.className = `feature-control-feature ${displayClass}`;
        featureElement.setAttribute('data-feature-id', featureId);
        
        // Dynamic styling based on state
        let backgroundColor = '#fff';
        if (featureState.isHovered) backgroundColor = '#f0f8ff';
        if (featureState.isSelected) backgroundColor = '#fff3cd';
        if (featureState.isStarred) backgroundColor = '#fff8e1';
        
        featureElement.style.cssText = `
            border-bottom: 1px solid #f0f0f0;
            font-size: 11px;
            background: ${backgroundColor};
            cursor: pointer;
        `;

        // Render content based on state
        if (featureState.isHovered && !featureState.isSelected) {
            this._renderFeatureTitle(featureElement, featureState, layerConfig);
        } else {
            this._renderFeatureDetails(featureElement, featureState, layerConfig);
        }

        container.appendChild(featureElement);
    }

    /**
     * Render compact feature title
     */
    _renderFeatureTitle(container, featureState, layerConfig) {
        container.style.padding = '8px 12px';
        
        const titleText = document.createElement('div');
        titleText.style.cssText = 'font-weight: 600; color: #333;';
        
        const labelField = layerConfig.inspect?.label;
        const titleValue = labelField ? featureState.feature.properties[labelField] : 'Feature';
        titleText.textContent = titleValue || 'Unnamed Feature';
        
        container.appendChild(titleText);
        
        // Click to expand
        container.addEventListener('click', (e) => {
            e.stopPropagation();
            const featureId = this._getFeatureId(featureState.feature);
            this._stateManager.onFeatureClick(featureState.feature, featureState.layerId, featureState.lngLat);
        });
    }

    /**
     * Render detailed feature information
     */
    _renderFeatureDetails(container, featureState, layerConfig) {
        container.style.padding = '0';
        
        // Header with feature info
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: #f1f5f9;
            border-bottom: 1px solid #eee;
            cursor: pointer;
        `;
        
        const headerTitle = document.createElement('span');
        headerTitle.textContent = 'Feature Data';
        headerTitle.style.cssText = 'font-weight: 600; font-size: 10px; color: #333;';
        
        const actionButton = this._createActionButton(featureState);
        
        header.appendChild(headerTitle);
        header.appendChild(actionButton);
        
        // Content area
        const content = this._createFeatureContent(featureState, layerConfig);
        
        container.appendChild(header);
        container.appendChild(content);
    }

    /**
     * Create action button (star/close)
     */
    _createActionButton(featureState) {
        const actionButton = document.createElement('sl-icon-button');
        const featureId = this._getFeatureId(featureState.feature);
        
        if (featureState.isSelected) {
            actionButton.setAttribute('name', 'x-lg');
            actionButton.style.cssText = `--sl-color-primary-600: #ef4444; font-size: 14px;`;
            
            actionButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this._stateManager.closeSelectedFeature(featureId);
            });
        } else {
            actionButton.setAttribute('name', featureState.isStarred ? 'star-fill' : 'star');
            actionButton.style.cssText = `
                --sl-color-primary-600: ${featureState.isStarred ? '#fbbf24' : '#6b7280'};
                font-size: 14px;
            `;
            
            actionButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this._stateManager.toggleFeatureStar(featureId);
            });
        }
        
        return actionButton;
    }

    /**
     * Create feature content with properties table
     */
    _createFeatureContent(featureState, layerConfig) {
        const content = document.createElement('div');
        content.style.cssText = 'padding: 8px 12px; max-height: 250px; overflow-y: auto;';
        
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
                color: ${field.isLabel ? '#1e40af' : field.isPriority ? '#6b7280' : '#9ca3af'};
                width: 40%;
                vertical-align: top;
                line-height: 1.2;
            `;
            
            // Create field name display with alias emphasis
            if (field.displayName !== field.key && !field.isLabel) {
                // Show alias prominently with raw field name below
                const aliasDiv = document.createElement('div');
                aliasDiv.style.cssText = 'font-weight: 600; margin-bottom: 1px;';
                aliasDiv.textContent = field.displayName;
                
                const rawDiv = document.createElement('div');
                rawDiv.style.cssText = 'font-size: 8px; font-weight: 400; color: #9ca3af; font-style: italic;';
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
                font-size: ${field.isLabel ? '11px' : '9px'};
                font-weight: ${field.isLabel ? '600' : '400'};
                color: ${field.isLabel ? '#1e40af' : '#374151'};
                line-height: 1.2;
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
        
        content.appendChild(table);
        content.appendChild(exportButton);
        
        return content;
    }

    /**
     * Toggle feature state between title and raw
     */
    _toggleFeatureState(featureId, newState, setSelected = false) {
        const currentState = this._featureStates.get(featureId) || { 
            state: 'raw',  // Default to raw state
            starred: false, 
            selected: false 
        };
        
        this._featureStates.set(featureId, {
            ...currentState,
            state: newState,
            selected: setSelected || currentState.selected
        });
        
        this._render();
    }

    /**
     * Toggle feature starred state
     */
    _toggleFeatureStar(featureId) {
        const currentState = this._featureStates.get(featureId) || { 
            state: 'raw',  // Changed to match new default
            starred: false, 
            selected: false 
        };
        
        const newStarred = !currentState.starred;
        
        this._featureStates.set(featureId, {
            ...currentState,
            starred: newStarred
        });
        
        // If unstarred, also unselect unless it's currently being hovered
        if (!newStarred) {
            // Check if this feature is currently being hovered
            let isCurrentlyHovered = false;
            this._activeLayers.forEach(layerData => {
                layerData.features.forEach(featureData => {
                    if (this._getFeatureId(featureData.feature) === featureId && featureData.isHover) {
                        isCurrentlyHovered = true;
                    }
                });
            });
            
            if (!isCurrentlyHovered) {
                // Remove from layer features if not starred and not hovered
                this._activeLayers.forEach(layerData => {
                    layerData.features.forEach((featureData, fId) => {
                        if (this._getFeatureId(featureData.feature) === featureId && !featureData.isHover) {
                            layerData.features.delete(fId);
                        }
                    });
                });
            }
        }
        
        this._render();
    }

    /**
     * Close selected feature - remove selected state and feature from display
     */
    _closeSelectedFeature(featureId) {
        // Remove the feature state
        this._featureStates.delete(featureId);
        
        // Remove the feature from all layers unless it's currently being hovered
        let isCurrentlyHovered = false;
        this._activeLayers.forEach(layerData => {
            layerData.features.forEach((featureData, fId) => {
                if (this._getFeatureId(featureData.feature) === featureId) {
                    if (featureData.isHover) {
                        isCurrentlyHovered = true;
                    } else {
                        layerData.features.delete(fId);
                    }
                }
            });
        });
        
        // If the feature is currently being hovered, keep it but mark as not selected
        if (isCurrentlyHovered) {
            this._activeLayers.forEach(layerData => {
                layerData.features.forEach((featureData, fId) => {
                    if (this._getFeatureId(featureData.feature) === featureId && featureData.isHover) {
                        // Keep as hover-only feature with no selection state
                        layerData.features.set(fId, {
                            ...featureData,
                            isHover: true
                        });
                    }
                });
            });
        }
        
        this._render();
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

    // The old public methods are no longer needed as the state manager handles all interactions

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

    /**
     * Clean up old features that may have accumulated
     */
    _cleanupOldFeatures() {
        const now = Date.now();
        const maxAge = 30000; // 30 seconds
        
        this._activeLayers.forEach((layerData) => {
            const keysToDelete = [];
            layerData.features.forEach((featureData, featureId) => {
                const featureStateId = this._getFeatureId(featureData.feature);
                const featureState = this._featureStates.get(featureStateId);
                
                // Only clean up hover features that are old and not starred/selected
                if (featureData.isHover && 
                    (now - featureData.timestamp) > maxAge &&
                    (!featureState || (!featureState.starred && !featureState.selected))) {
                    keysToDelete.push(featureId);
                    
                    // Also clean up the feature state if it exists
                    if (featureState) {
                        this._featureStates.delete(featureStateId);
                    }
                }
            });
            keysToDelete.forEach(key => layerData.features.delete(key));
        });
    }

    // Helper methods for new architecture
    _removeLayerElement(layerId) {
        const existing = this._layersContainer.querySelector(`[data-layer-id="${layerId}"]`);
        if (existing) {
            existing.remove();
        }
    }

    _getLayerDataHash(layerData) {
        // Simple hash to detect changes
        const featureIds = Array.from(layerData.features.keys()).sort();
        const timestamps = Array.from(layerData.features.values()).map(f => f.timestamp);
        return JSON.stringify({ featureIds, timestamps });
    }

    _hasVisibleFeatures(removedFeatures) {
        // Check if any of the removed features were currently visible
        return removedFeatures.some(featureId => {
            return this._layersContainer.querySelector(`[data-feature-id="${featureId}"]`);
        });
    }

    /**
     * Clean up event listeners and references
     */
    _cleanup() {
        if (this._stateManager && this._stateChangeListener) {
            this._stateManager.removeEventListener('state-change', this._stateChangeListener);
        }
        this._lastRenderState.clear();
    }

    // These public methods are no longer needed - the state manager handles layer management
}

// Make available globally for backwards compatibility
if (typeof window !== 'undefined') {
    window.MapFeatureControl = MapFeatureControl;
} 