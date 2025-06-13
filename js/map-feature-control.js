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
        
        // Add a small delay to ensure layer control is fully initialized
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
            background: white;
            border-radius: 4px;
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
            padding: 10px 12px;
            border-bottom: 1px solid #eee;
            background: #f8f9fa;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            font-weight: 600;
            color: #333;
            cursor: pointer;
        `;

        const title = document.createElement('span');
        title.textContent = 'Feature Info';
        
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'feature-control-toggle';
        toggleBtn.innerHTML = this._isCollapsed ? '▲' : '▼';
        toggleBtn.style.cssText = `
            background: none;
            border: none;
            font-size: 10px;
            cursor: pointer;
            color: #666;
            padding: 2px 4px;
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
        
        // Get visible layers from the layer control if available
        if (this._layerControl && typeof this._layerControl._getVisibleLayers === 'function') {
            const visibleLayers = this._layerControl._getVisibleLayers();
            console.log('[FeatureControl] Visible layers from layer control:', visibleLayers);
            console.log('[FeatureControl] Layer config IDs:', this._layerConfig.map(l => l.id));
            
            // Check for direct matches first
            this._layerConfig.forEach(layer => {
                let isVisible = false;
                
                // Check for direct ID match
                if (visibleLayers.includes(layer.id)) {
                    isVisible = true;
                } else {
                    // Check if any visible layer matches this config layer
                    // Handle layer-group type layers that might have child layers
                    for (const visibleLayerId of visibleLayers) {
                        if (typeof visibleLayerId === 'string') {
                            if (visibleLayerId === layer.id || 
                                visibleLayerId.includes(layer.id) || 
                                layer.id.includes(visibleLayerId)) {
                                isVisible = true;
                                break;
                            }
                        } else if (visibleLayerId && visibleLayerId.id === layer.id) {
                            isVisible = true;
                            break;
                        }
                    }
                }
                
                console.log(`[FeatureControl] Layer ${layer.id} is ${isVisible ? 'visible' : 'hidden'}`);
                
                if (isVisible) {
                    this._activeLayers.set(layer.id, {
                        ...layer,
                        features: new Map()
                    });
                }
            });
            
            // Also check if layer control has state information
            if (this._layerControl._state && this._layerControl._state.groups) {
                console.log('[FeatureControl] Layer control state groups:', this._layerControl._state.groups);
                this._layerControl._state.groups.forEach((group, index) => {
                    if (group.initiallyChecked) {
                        console.log(`[FeatureControl] Group ${index} (${group.id}) is initially checked`);
                        const layerConfig = this._layerConfig.find(l => l.id === group.id);
                        if (layerConfig && !this._activeLayers.has(layerConfig.id)) {
                            this._activeLayers.set(layerConfig.id, {
                                ...layerConfig,
                                features: new Map()
                            });
                        }
                    }
                });
            }
        } else {
            // Fallback to checking map style if layer control method not available
            console.log('[FeatureControl] Falling back to map style checking');
            this._layerConfig.forEach(layer => {
                if (this._isLayerVisible(layer)) {
                    this._activeLayers.set(layer.id, {
                        ...layer,
                        features: new Map()
                    });
                }
            });
        }

        console.log('[FeatureControl] Active layers:', Array.from(this._activeLayers.keys()));
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
            state: 'title', 
            starred: false, 
            selected: false 
        };
        
        // Determine current display state
        let currentState = featureState.state;
        if (featureData.isHover && !featureState.selected) {
            currentState = 'title'; // Hover always shows title unless selected
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

        // Render based on current state
        switch (currentState) {
            case 'title':
                this._renderFeatureTitle(featureElement, featureData, layer, featureState);
                break;
            case 'full':
                this._renderFeatureFull(featureElement, featureData, layer, featureState);
                break;
            case 'raw':
                this._renderFeatureRaw(featureElement, featureData, layer, featureState);
                break;
        }

        // Add click handler for state changes
        if (currentState === 'title') {
            featureElement.addEventListener('click', (e) => {
                e.stopPropagation();
                this._toggleFeatureState(featureId, 'full', true);
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
     * Render feature in full state (formatted metadata)
     */
    _renderFeatureFull(container, featureData, layer, featureState) {
        container.style.padding = '0';
        
        // Header with "Form Data" and star button
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: #f8f9fa;
            border-bottom: 1px solid #eee;
            cursor: pointer;
        `;
        
        const headerTitle = document.createElement('span');
        headerTitle.textContent = 'Form Data';
        headerTitle.style.cssText = 'font-weight: 600; font-size: 10px; color: #333;';
        
        const starButton = document.createElement('sl-icon-button');
        starButton.setAttribute('name', featureState.starred ? 'star-fill' : 'star');
        starButton.style.cssText = `
            --sl-color-primary-600: ${featureState.starred ? '#fbbf24' : '#6b7280'};
            font-size: 14px;
        `;
        
        header.appendChild(headerTitle);
        header.appendChild(starButton);
        
        // Add click handlers
        const featureId = this._getFeatureId(featureData.feature);
        headerTitle.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleFeatureState(featureId, 'raw', false);
        });
        
        starButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleFeatureStar(featureId);
        });
        
        // Content area with formatted popup content
        const content = document.createElement('div');
        content.style.cssText = 'padding: 8px 12px;';
        
        if (this._layerControl && typeof this._layerControl._createPopupContent === 'function') {
            try {
                const popupContent = this._layerControl._createPopupContent(
                    featureData.feature, 
                    layer, 
                    false, // not hover
                    featureData.lngLat
                );
                
                if (popupContent) {
                    const adaptedContent = this._adaptPopupContent(popupContent);
                    content.appendChild(adaptedContent);
                }
            } catch (error) {
                console.warn('Error generating feature content:', error);
                content.textContent = 'Error displaying feature info';
            }
        } else {
            this._renderBasicFeature(content, featureData.feature, layer);
        }
        
        container.appendChild(header);
        container.appendChild(content);
    }

    /**
     * Render feature in raw state (all properties + KML export)
     */
    _renderFeatureRaw(container, featureData, layer, featureState) {
        container.style.padding = '0';
        
        // Header with "Raw Data"
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
        headerTitle.textContent = 'Raw Data';
        headerTitle.style.cssText = 'font-weight: 600; font-size: 10px; color: #333;';
        
        header.appendChild(headerTitle);
        
        // Add click handler to go back to full state
        const featureId = this._getFeatureId(featureData.feature);
        headerTitle.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleFeatureState(featureId, 'full', false);
        });
        
        // Content area with raw properties table
        const content = document.createElement('div');
        content.style.cssText = 'padding: 8px 12px; max-height: 200px; overflow-y: auto;';
        
        // Properties table
        const table = document.createElement('table');
        table.style.cssText = `
            width: 100%;
            font-size: 9px;
            border-collapse: collapse;
            margin-bottom: 8px;
        `;
        
        const properties = featureData.feature.properties || {};
        Object.entries(properties).forEach(([key, value]) => {
            const row = document.createElement('tr');
            row.style.cssText = 'border-bottom: 1px solid #f0f0f0;';
            
            const keyCell = document.createElement('td');
            keyCell.style.cssText = 'padding: 2px 4px; font-weight: 600; color: #666; width: 40%;';
            keyCell.textContent = key;
            
            const valueCell = document.createElement('td');
            valueCell.style.cssText = 'padding: 2px 4px; word-break: break-word;';
            valueCell.textContent = value !== null && value !== undefined ? String(value) : '';
            
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
     * Adapt popup content for the control panel
     */
    _adaptPopupContent(popupContent) {
        const adapted = popupContent.cloneNode(true);
        
        adapted.classList.remove('map-popup');
        adapted.classList.add('feature-control-content');
        
        adapted.style.cssText = `
            padding: 0;
            font-size: 10px;
            line-height: 1.3;
        `;

        const elements = adapted.querySelectorAll('*');
        elements.forEach(el => {
            if (el.style.padding) {
                el.style.padding = '2px 0';
            }
            if (el.style.margin) {
                el.style.margin = '1px 0';
            }
            if (el.style.fontSize || el.classList.contains('text-2xl')) {
                el.style.fontSize = '12px';
            }
            if (el.classList.contains('text-sm')) {
                el.style.fontSize = '9px';
            }
        });

        // Remove close button if present
        const closeBtn = adapted.querySelector('.close-button, [data-close]');
        if (closeBtn) {
            closeBtn.remove();
        }

        return adapted;
    }

    /**
     * Render basic feature information as fallback
     */
    _renderBasicFeature(container, feature, layer) {
        const props = feature.properties || {};
        
        let label = 'Feature';
        if (layer.inspect?.label && props[layer.inspect.label]) {
            label = props[layer.inspect.label];
        } else if (props.name || props.Name || props.title || props.Title) {
            label = props.name || props.Name || props.title || props.Title;
        }

        const labelDiv = document.createElement('div');
        labelDiv.style.cssText = 'font-weight: 600; margin-bottom: 4px;';
        labelDiv.textContent = label;
        container.appendChild(labelDiv);

        const keyProps = layer.inspect?.fields || Object.keys(props).slice(0, 3);
        keyProps.forEach(prop => {
            if (props[prop] && prop !== layer.inspect?.label) {
                const propDiv = document.createElement('div');
                propDiv.style.cssText = 'color: #666; margin-bottom: 2px;';
                propDiv.innerHTML = `<span style="color: #999;">${prop}:</span> ${props[prop]}`;
                container.appendChild(propDiv);
            }
        });
    }

    /**
     * Toggle feature state between title, full, and raw
     */
    _toggleFeatureState(featureId, newState, setSelected = false) {
        const currentState = this._featureStates.get(featureId) || { 
            state: 'title', 
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
            state: 'title', 
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

        // Clear all previous hover features for this layer to avoid accumulation
        const keysToDelete = [];
        layerData.features.forEach((featureData, featureId) => {
            if (featureData.isHover) {
                keysToDelete.push(featureId);
            }
        });
        keysToDelete.forEach(key => layerData.features.delete(key));

        // Add the new hover feature
        const featureId = this._getFeatureId(feature);
        layerData.features.set(featureId, {
            feature,
            layer,
            lngLat,
            isHover: true,
            timestamp: Date.now()
        });

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

        // Clear hover features but preserve starred or selected features
        let hasChanges = false;
        const keysToDelete = [];
        
        layerData.features.forEach((featureData, featureId) => {
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
        this._updateActiveLayers();
        this._render();
    }
}

// Export for both ES6 modules and global usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapFeatureControl;
}
if (typeof window !== 'undefined') {
    window.MapFeatureControl = MapFeatureControl;
} 