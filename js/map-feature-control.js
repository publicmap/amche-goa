/**
 * MapFeatureControl - A Mapbox GL JS control for displaying feature information
 * 
 * This control displays a list of active layers in the bottom right corner of the map.
 * When users interact with features, it shows the feature information under the relevant layer
 * instead of using overlapping popups.
 * 
 * Architecture follows the mapbox-choropleth plugin pattern.
 */

export class MapFeatureControl {
    constructor(options = {}) {
        this.options = {
            position: 'bottom-right',
            maxHeight: '300px',
            maxWidth: '350px',
            minWidth: '250px',
            collapsed: false,
            showActiveLayersOnly: true,
            ...options
        };

        this._map = null;
        this._layerControl = null;
        this._container = null;
        this._layersContainer = null;
        this._activeLayers = new Map();
        this._isCollapsed = this.options.collapsed;
        
        // Feature state management
        this._featureStates = new Map(); // featureId -> { state: 'title'|'full'|'raw', starred: boolean, selected: boolean }
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
     * Initialize the control with layer configuration and layer control instance
     */
    initialize(layerConfig, layerControl) {
        this._layerConfig = layerConfig || [];
        this._layerControl = layerControl;
        
        console.log('[FeatureControl] Initialized with config:', layerConfig);
        console.log('[FeatureControl] Layer control:', layerControl);
        
        // Initial sync after layer control is ready
        setTimeout(() => {
            this._updateActiveLayers();
            this._render();
        }, 500);
        
        // Set up periodic cleanup of old features
        this._cleanupInterval = setInterval(() => {
            this._cleanupOldFeatures();
        }, 10000); // Clean up every 10 seconds
        
        return this;
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
     * Update the list of active layers based on layer visibility
     */
    _updateActiveLayers() {
        if (!this._layerConfig) return;

        this._activeLayers.clear();
        
        // Get the current layer states directly from the layer control
        const currentlyActiveLayers = this._getCurrentlyActiveLayers();
        console.log('[FeatureControl] Currently active layers from layer control:', currentlyActiveLayers);
        console.log('[FeatureControl] Layer config IDs:', this._layerConfig.map(l => l.id));
        
        // Only add layers that are explicitly in the active list
        this._layerConfig.forEach(layer => {
            const isActive = currentlyActiveLayers.includes(layer.id);
            console.log(`[FeatureControl] Layer ${layer.id} is ${isActive ? 'active' : 'inactive'}`);
            
            if (isActive) {
                this._activeLayers.set(layer.id, {
                    ...layer,
                    features: new Map()
                });
            }
        });

        console.log('[FeatureControl] Active layers:', Array.from(this._activeLayers.keys()));
    }

    /**
     * Get currently active layers from the layer control
     * This is the single source of truth for which layers are currently toggled on
     */
    _getCurrentlyActiveLayers() {
        const activeLayers = [];
        
        if (!this._layerControl || !this._layerControl._state || !this._layerControl._sourceControls) {
            console.warn('[FeatureControl] Layer control not properly initialized');
            return activeLayers;
        }
        
        // Check each group's current toggle state from the DOM
        this._layerControl._state.groups.forEach((group, index) => {
            const groupElement = this._layerControl._sourceControls[index];
            if (!groupElement) return;
            
            const toggleInput = groupElement.querySelector('.toggle-switch input[type="checkbox"]');
            const isCurrentlyChecked = toggleInput && toggleInput.checked;
            
            if (isCurrentlyChecked) {
                console.log(`[FeatureControl] Group ${index} (${group.id}) is currently toggled on`);
                
                if (group.type === 'layer-group') {
                    // For layer groups, find which radio button is selected
                    const radioGroup = groupElement.querySelector('.radio-group');
                    const selectedRadio = radioGroup?.querySelector('input[type="radio"]:checked');
                    if (selectedRadio) {
                        activeLayers.push(selectedRadio.value);
                        console.log(`[FeatureControl] Layer group ${group.id} has selected: ${selectedRadio.value}`);
                    }
                } else {
                    // For regular layers, add the group ID
                    activeLayers.push(group.id);
                }
            }
        });
        
        return activeLayers;
    }

    /**
     * Check if a layer is currently visible on the map (fallback method)
     */
    _isLayerVisible(layer) {
        if (!this._map || !layer.id) return false;
        
        try {
            const style = this._map.getStyle();
            if (!style.layers) return false;
            
            // Check for exact layer ID match first
            let layersWithId = style.layers.filter(l => l.id === layer.id);
            
            // If no exact match, check for layers that start with the layer ID
            if (layersWithId.length === 0) {
                layersWithId = style.layers.filter(l => l.id.startsWith(layer.id));
            }
            
            // If still no match, check for layers that contain the layer ID
            if (layersWithId.length === 0) {
                layersWithId = style.layers.filter(l => l.id.includes(layer.id));
            }
            
            console.log(`[FeatureControl] Checking layer ${layer.id}, found ${layersWithId.length} matching layers:`, layersWithId.map(l => l.id));
            
            return layersWithId.some(l => {
                const visibility = this._map.getLayoutProperty(l.id, 'visibility');
                const isVisible = visibility !== 'none';
                console.log(`[FeatureControl] Layer ${l.id} visibility: ${visibility}, isVisible: ${isVisible}`);
                return isVisible;
            });
        } catch (error) {
            console.warn('Error checking layer visibility:', error);
            return false;
        }
    }

    /**
     * Render the control UI
     */
    _render() {
        if (!this._layersContainer) return;

        this._layersContainer.innerHTML = '';

        if (this._activeLayers.size === 0) {
            this._renderEmptyState();
            return;
        }

        this._activeLayers.forEach((layer, layerId) => {
            this._renderLayer(layer);
        });
    }

    /**
     * Render empty state when no layers are active
     */
    _renderEmptyState() {
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
     * Render a single layer in the control
     */
    _renderLayer(layer) {
        const layerElement = document.createElement('div');
        layerElement.className = 'feature-control-layer';
        layerElement.setAttribute('data-layer-id', layer.id);
        layerElement.style.cssText = `border-bottom: 1px solid #eee;`;

        // Create layer header with background image support
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
        
        // Add background image if available
        if (layer.headerImage) {
            headerStyle += `
                background-image: url('${layer.headerImage}');
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
            `;
            
            // Add overlay for better text readability
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
        headerText.textContent = layer.title || layer.id;
        layerHeader.appendChild(headerText);

        // Only show features container if layer has inspect configuration
        if (layer.inspect) {
            const featuresContainer = document.createElement('div');
            featuresContainer.className = 'feature-control-features';
            featuresContainer.style.cssText = `
                max-height: 200px;
                overflow-y: auto;
            `;

            if (layer.features.size === 0) {
                // No features to show
            } else {
                // Sort features by priority: hovered first, then selected, then starred
                const sortedFeatures = this._getSortedFeatures(layer.features);
                sortedFeatures.forEach(([featureId, featureData]) => {
                    this._renderFeature(featuresContainer, featureData, layer);
                });
            }

            layerElement.appendChild(layerHeader);
            layerElement.appendChild(featuresContainer);
        } else {
            // If no inspect config, just show the header
            layerElement.appendChild(layerHeader);
        }
        
        this._layersContainer.appendChild(layerElement);
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
     * Render a feature's information with state management
     */
    _renderFeature(container, featureData, layer) {
        const featureId = this._getFeatureId(featureData.feature);
        const featureState = this._featureStates.get(featureId) || { 
            state: 'raw',  // Default to 'raw' state
            starred: false, 
            selected: false 
        };
        
        // Determine current display state
        let currentState = featureState.state;
        if (featureData.isHover && !featureState.selected) {
            currentState = 'title'; // Hover always shows title unless selected
        }
        
        // Selected features always show raw data
        if (featureState.selected) {
            currentState = 'raw';
        }

        const featureElement = document.createElement('div');
        featureElement.className = `feature-control-feature ${featureData.isHover ? 'hover' : 'click'} state-${currentState}`;
        featureElement.setAttribute('data-feature-id', featureId);
        
        let backgroundColor = '#fff';
        if (featureData.isHover) backgroundColor = '#f0f8ff';
        if (featureState.selected) backgroundColor = '#fff3cd';
        if (featureState.starred) backgroundColor = '#fff8e1';
        
        featureElement.style.cssText = `
            border-bottom: 1px solid #f0f0f0;
            font-size: 11px;
            background: ${backgroundColor};
            cursor: pointer;
        `;

        // Render based on current state (only title or raw)
        switch (currentState) {
            case 'title':
                this._renderFeatureTitle(featureElement, featureData, layer, featureState);
                break;
            case 'raw':
                this._renderFeatureRaw(featureElement, featureData, layer, featureState);
                break;
        }

        // Add click handler for state changes
        if (currentState === 'title') {
            featureElement.addEventListener('click', (e) => {
                e.stopPropagation();
                this._toggleFeatureState(featureId, 'raw', true);
            });
        }

        container.appendChild(featureElement);
    }

    /**
     * Render feature in title state (compact)
     */
    _renderFeatureTitle(container, featureData, layer, featureState) {
        container.style.padding = '8px 12px';
        
        const titleText = document.createElement('div');
        titleText.style.cssText = 'font-weight: 600; color: #333;';
        
        const labelField = layer.inspect?.label;
        const titleValue = labelField ? featureData.feature.properties[labelField] : 'Feature';
        titleText.textContent = titleValue || 'Unnamed Feature';
        
        container.appendChild(titleText);
    }

    /**
     * Render feature in raw state (combined formatted and raw data)
     */
    _renderFeatureRaw(container, featureData, layer, featureState) {
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
        
        let actionButton;
        
        if (featureState.selected) {
            // Show close button for selected features
            actionButton = document.createElement('sl-icon-button');
            actionButton.setAttribute('name', 'x-lg');
            actionButton.style.cssText = `
                --sl-color-primary-600: #ef4444;
                font-size: 14px;
            `;
        } else {
            // Show star button for non-selected features
            actionButton = document.createElement('sl-icon-button');
            actionButton.setAttribute('name', featureState.starred ? 'star-fill' : 'star');
            actionButton.style.cssText = `
                --sl-color-primary-600: ${featureState.starred ? '#fbbf24' : '#6b7280'};
                font-size: 14px;
            `;
        }
        
        header.appendChild(headerTitle);
        header.appendChild(actionButton);
        
        // Add click handlers
        const featureId = this._getFeatureId(featureData.feature);
        
        if (featureState.selected) {
            // Close button handler - removes selected state and feature
            actionButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this._closeSelectedFeature(featureId);
            });
        } else {
            // Star button handler
            actionButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this._toggleFeatureStar(featureId);
            });
        }
        
        // Content area with intelligently formatted properties table
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
        
        const properties = featureData.feature.properties || {};
        const inspect = layer.inspect || {};
        
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
            this._exportFeatureKML(featureData.feature, layer);
        });
        
        content.appendChild(table);
        content.appendChild(exportButton);
        
        container.appendChild(header);
        container.appendChild(content);
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

    /**
     * Public method to handle feature hover events
     */
    onFeatureHover(feature, layer, lngLat) {
        if (!feature || !layer) return;

        const layerData = this._activeLayers.get(layer.id);
        if (!layerData) return;

        const newFeatureId = this._getFeatureId(feature);

        // Clear only previous hover features that are not selected
        const keysToDelete = [];
        layerData.features.forEach((featureData, featureId) => {
            if (featureData.isHover && featureId !== newFeatureId) {
                const featureStateId = this._getFeatureId(featureData.feature);
                const featureState = this._featureStates.get(featureStateId);
                
                // Only remove if not selected or starred
                if (!featureState || (!featureState.selected && !featureState.starred)) {
                    keysToDelete.push(featureId);
                }
            }
        });
        keysToDelete.forEach(key => layerData.features.delete(key));

        // Add or update the hover feature
        const existingFeature = layerData.features.get(newFeatureId);
        if (existingFeature) {
            // Update existing feature to mark as hovered
            layerData.features.set(newFeatureId, {
                ...existingFeature,
                isHover: true,
                timestamp: Date.now()
            });
        } else {
            // Add new hover feature
            layerData.features.set(newFeatureId, {
                feature,
                layer,
                lngLat,
                isHover: true,
                timestamp: Date.now()
            });
        }

        this._render();
    }

    /**
     * Public method to handle feature click events
     */
    onFeatureClick(feature, layer, lngLat) {
        if (!feature || !layer) return;

        const layerData = this._activeLayers.get(layer.id);
        if (!layerData) return;

        const featureId = this._getFeatureId(feature);
        
        // Add or update the feature in the layer
        layerData.features.set(featureId, {
            feature,
            layer,
            lngLat,
            isHover: false,
            timestamp: Date.now()
        });

        // Toggle to full state and mark as selected
        this._toggleFeatureState(featureId, 'full', true);
    }

    /**
     * Public method to handle feature leave events
     */
    onFeatureLeave(feature, layer) {
        if (!layer) return;

        const layerData = this._activeLayers.get(layer.id);
        if (!layerData) return;

        const leftFeatureId = feature ? this._getFeatureId(feature) : null;

        // Clear hover features but preserve starred or selected features
        let hasChanges = false;
        const keysToDelete = [];
        
        layerData.features.forEach((featureData, featureId) => {
            // Only process if this is the feature being left or if no specific feature was provided
            if (!leftFeatureId || this._getFeatureId(featureData.feature) === leftFeatureId) {
                if (featureData.isHover) {
                    const featureStateId = this._getFeatureId(featureData.feature);
                    const featureState = this._featureStates.get(featureStateId);
                    
                    // Only remove if not starred or selected
                    if (!featureState || (!featureState.starred && !featureState.selected)) {
                        keysToDelete.push(featureId);
                        hasChanges = true;
                    } else {
                        // Keep the feature but mark it as not hovered
                        layerData.features.set(featureId, {
                            ...featureData,
                            isHover: false
                        });
                        hasChanges = true;
                    }
                }
            }
        });
        
        if (hasChanges) {
            keysToDelete.forEach(key => layerData.features.delete(key));
            this._render();
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

    /**
     * Clean up event listeners and references
     */
    _cleanup() {
        this._activeLayers.clear();
        this._featureStates.clear();
        if (this._cleanupInterval) {
            clearInterval(this._cleanupInterval);
        }
    }

    /**
     * Public method to clear all feature interactions
     */
    clearFeatures() {
        this._activeLayers.forEach(layer => {
            layer.features.clear();
        });
        this._render();
    }

    /**
     * Public method to update layer configuration
     */
    updateLayers(layerConfig) {
        this._layerConfig = layerConfig;
        this._updateActiveLayers();
        this._render();
    }

    /**
     * Public method to refresh active layers (called when layer visibility changes)
     */
    refreshLayers() {
        console.log('[FeatureControl] Refreshing layers...');
        
        // Store previous active layers for comparison
        const previousActiveLayers = new Set(this._activeLayers.keys());
        
        // Update active layers
        this._updateActiveLayers();
        
        // Check if active layers changed
        const currentActiveLayers = new Set(this._activeLayers.keys());
        const layersChanged = previousActiveLayers.size !== currentActiveLayers.size ||
            !Array.from(previousActiveLayers).every(id => currentActiveLayers.has(id));
        
        if (layersChanged) {
            console.log('[FeatureControl] Active layers changed, re-rendering');
            console.log('[FeatureControl] Previous layers:', Array.from(previousActiveLayers));
            console.log('[FeatureControl] Current layers:', Array.from(currentActiveLayers));
            this._render();
        } else {
            console.log('[FeatureControl] No layer changes detected, skipping render');
        }
    }
}

// Export for both ES6 modules and global usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapFeatureControl;
}
if (typeof window !== 'undefined') {
    window.MapFeatureControl = MapFeatureControl;
} 