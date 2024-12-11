class MapLayerControl {
    constructor(options) {
        this._options = {
            groups: Array.isArray(options) ? options : [options]
        };
        MapLayerControl.instances = (MapLayerControl.instances || 0) + 1;
        this._instanceId = MapLayerControl.instances;
        this._initialized = false;
        this._animationTimeouts = [];
        this._collapsed = window.innerWidth < 768;
        this._sourceControls = [];
    }

    onAdd(map) {
        this._map = map;
        
        this._wrapper = $('<div>', {
            class: 'mapboxgl-ctrl mapboxgl-ctrl-group layer-control-wrapper'
        })[0];
        
        this._toggleButton = $('<button>', {
            class: 'layer-control-toggle' + (this._collapsed ? '' : ' is-open'),
            html: this._collapsed ? '≡' : '×',
            click: (e) => {
                e.stopPropagation();
                this._toggleCollapse();
            }
        })[0];
        
        this._container = $('<div>', {
            class: 'mapboxgl-ctrl layer-control' + (this._collapsed ? ' collapsed' : '')
        })[0];

        this._wrapper.appendChild(this._toggleButton);
        this._wrapper.appendChild(this._container);

        if (this._map.isStyleLoaded()) {
            this._initializeControl();
        } else {
            this._map.on('style.load', () => {
                this._initializeControl();
            });
        }

        if (window.innerWidth < 768) {
            $(this._container).addClass('collapsed no-transition');
            setTimeout(() => {
                $(this._container).removeClass('no-transition');
            }, 100);
        }

        return this._wrapper;
    }

    _toggleCollapse() {
        this._collapsed = !this._collapsed;
        $(this._container).toggleClass('collapsed');
        $(this._toggleButton)
            .toggleClass('is-open')
            .html(this._collapsed ? '≡' : '×');
    }

    _handleResize() {
        if (window.innerWidth < 768 && !this._collapsed) {
            this._toggleCollapse();
        }
    }

    _initializeControl() {
        const getNextLayerIndex = (type, groupIndex) => {
            const layers = this._map.getStyle().layers;
            console.log('Current layer stack:', layers.map(l => ({ id: l.id, type: l.type })));
            
            // Find the satellite/base layer
            const baseLayerIndex = layers.findIndex(layer => 
                layer.type === 'raster' && layer.id.includes('satellite')
            );
            console.log('Base layer index:', baseLayerIndex);
            
            // Calculate insert position based on type and group order
            let insertIndex;
            if (type === 'tms' || type === 'raster' || type === 'layer-group' || type === 'osm' || !type) {
                // Insert after the base layer in reverse order
                // Using total number of groups minus current index to reverse the order
                const totalGroups = this._options.groups.length;
                const reversedIndex = totalGroups - (groupIndex || 0) - 1;
                insertIndex = baseLayerIndex + 1 + reversedIndex;
            } else {
                // Vector and other layers go at the end
                insertIndex = layers.length;
            }
            
            console.log(`Adding ${type} layer at index ${insertIndex} (groupIndex: ${groupIndex})`);
            return insertIndex;
        };

        this._initializeLayers();

        this._options.groups.forEach((group, groupIndex) => {
            const $groupContainer = $('<div>', { class: 'layer-group' });
            const $groupHeader = $('<div>', { class: 'group-header' });

            if (group.headerImage) {
                $groupHeader.css({
                    backgroundImage: `url(${group.headerImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative'
                });
                
                $('<div>', { class: 'header-overlay' }).appendTo($groupHeader);
            }

            const $label = $('<label>');
            const $checkbox = $('<input>', {
                type: 'checkbox',
                checked: false
            });

            const $titleSpan = $('<span>', { text: group.title });
            if (group.headerImage) {
                $titleSpan.css({
                    color: 'white',
                    position: 'relative',
                    zIndex: '1'
                });
            }

            $label.append($checkbox, $titleSpan);
            $groupHeader.append($label);
            $groupContainer.append($groupHeader);

            const $sourceControl = $('<div>', {
                class: 'source-control collapsed'
            });
            this._sourceControls[groupIndex] = $sourceControl[0];

            // Add opacity slider inside the source control
            const $opacityContainer = $('<div>', { 
                class: 'opacity-control mt-2 px-2' 
            });
            
            const $opacitySlider = $('<input>', {
                type: 'range',
                min: '0',
                max: '1',
                step: '0.1',
                value: '1',
                class: 'w-full'
            });
            
            const $opacityValue = $('<span>', { 
                class: 'text-sm text-gray-600 ml-2',
                text: '100%'
            });

            $opacityContainer.append(
                $('<label>', { 
                    class: 'block text-sm text-gray-700 mb-1',
                    text: 'Layer Opacity'
                }),
                $('<div>', { class: 'flex items-center' }).append($opacitySlider, $opacityValue)
            );

            $opacitySlider.on('input', (e) => {
                const value = parseFloat(e.target.value);
                $opacityValue.text(`${Math.round(value * 100)}%`);
                
                if (group.type === 'geojson') {
                    const sourceId = `geojson-${group.id}`;
                    if (this._map.getLayer(`${sourceId}-fill`)) {
                        this._map.setPaintProperty(`${sourceId}-fill`, 'fill-opacity', value * 0.5);
                    }
                    if (this._map.getLayer(`${sourceId}-line`)) {
                        this._map.setPaintProperty(`${sourceId}-line`, 'line-opacity', value);
                    }
                    if (this._map.getLayer(`${sourceId}-label`)) {
                        this._map.setPaintProperty(`${sourceId}-label`, 'text-opacity', value);
                    }
                } else if (group.type === 'tms') {
                    const layerId = `tms-layer-${group.id}`;
                    if (this._map.getLayer(layerId)) {
                        this._map.setPaintProperty(layerId, 'raster-opacity', value);
                    }
                } else if (group.layers) {
                    group.layers.forEach(layer => {
                        if (this._map.getLayer(layer.id)) {
                            const layerType = this._map.getLayer(layer.id).type;
                            switch (layerType) {
                                case 'raster':
                                    this._map.setPaintProperty(layer.id, 'raster-opacity', value);
                                    break;
                                case 'fill':
                                    this._map.setPaintProperty(layer.id, 'fill-opacity', value);
                                    break;
                                case 'line':
                                    this._map.setPaintProperty(layer.id, 'line-opacity', value);
                                    break;
                                case 'symbol':
                                    this._map.setPaintProperty(layer.id, 'text-opacity', value);
                                    this._map.setPaintProperty(layer.id, 'icon-opacity', value);
                                    break;
                            }
                        }
                    });
                } else if (group.type === 'vector') {
                    const sourceId = `vector-${group.id}`;
                    const layerId = `vector-layer-${group.id}`;

                    if (this._map.getLayer(layerId)) {
                        // Update opacity for both fill and outline layers
                        this._map.setPaintProperty(layerId, 'fill-opacity', value * (group.style?.fillOpacity || 0.1));
                        this._map.setPaintProperty(`${layerId}-outline`, 'line-opacity', value);
                    }
                } else {
                    const $radioGroup = $('<div>', { class: 'radio-group' });

                    group.layers.forEach((layer, index) => {
                        const $radioLabel = $('<label>', { class: 'radio-label' });
                        const $radio = $('<input>', {
                            type: 'radio',
                            name: `layer-group-${this._instanceId}-${groupIndex}`,
                            value: layer.id,
                            checked: index === 0
                        });

                        $radio.on('change', () => this._handleLayerChange(layer.id, group.layers));

                        $radioLabel.append(
                            $radio,
                            $('<span>', { text: layer.label })
                        );
                        $radioGroup.append($radioLabel);
                    });

                    $sourceControl.append($radioGroup);
                }
            });

            if (group.type !== 'terrain') {
                $sourceControl.append($opacityContainer);
            }

            if (group.groupTitle) {
                $('<div>', {
                    class: 'title',
                    text: group.groupTitle
                }).appendTo($sourceControl);
            }

            if (group.type === 'geojson') {
                const sourceId = `geojson-${group.id}`;
                if (!this._map.getSource(sourceId)) {
                    this._map.addSource(sourceId, {
                        type: 'geojson',
                        data: group.data
                    });

                    const style = group.style || {
                        fill: {
                            color: '#ff0000',
                            opacity: 0.5
                        },
                        line: {
                            color: '#ff0000',
                            width: 2
                        },
                        label: {
                            color: '#000000',
                            haloColor: '#ffffff',
                            haloWidth: 2,
                            size: 12
                        }
                    };

                    if (style.fill !== false) {
                        this._map.addLayer({
                            id: `${sourceId}-fill`,
                            type: 'fill',
                            source: sourceId,
                            paint: {
                                'fill-color': style.fill?.color || '#ff0000',
                                'fill-opacity': style.fill?.opacity || 0.5
                            },
                            layout: {
                                'visibility': 'none'
                            }
                        });
                    }

                    this._map.addLayer({
                        id: `${sourceId}-line`,
                        type: 'line',
                        source: sourceId,
                        paint: {
                            'line-color': style.line?.color || '#ff0000',
                            'line-width': style.line?.width || 2
                        },
                        layout: {
                            'visibility': 'none'
                        }
                    });

                    this._map.addLayer({
                        id: `${sourceId}-label`,
                        type: 'symbol',
                        source: sourceId,
                        layout: {
                            'visibility': 'none',
                            'text-field': ['get', 'name'],
                            'text-size': style.label?.size || 12,
                            'text-anchor': 'center',
                            'text-offset': [0, 0],
                            'text-allow-overlap': false,
                            'text-ignore-placement': false
                        },
                        paint: {
                            'text-color': style.label?.color || '#000000',
                            'text-halo-color': style.label?.haloColor || '#ffffff',
                            'text-halo-width': style.label?.haloWidth || 2
                        }
                    });
                }

                if (group.description) {
                    $('<div>', {
                        class: 'text-sm text-gray-600 mt-2 px-2',
                        text: group.description
                    }).appendTo($sourceControl);
                }
            } else if (group.type === 'terrain') {
                const $sliderContainer = $('<div>', { class: 'slider-container mt-2' });
                
                const $contoursContainer = $('<div>', { class: 'mb-4' });
                const $contoursLabel = $('<label>', { class: 'flex items-center' });
                const $contoursCheckbox = $('<input>', {
                    type: 'checkbox',
                    class: 'mr-2',
                    checked: false
                });
                
                $contoursLabel.append(
                    $contoursCheckbox,
                    $('<span>', { 
                        class: 'text-sm text-gray-700',
                        text: 'Contours'
                    })
                );
                
                $contoursCheckbox.on('change', (e) => {
                    const contourLayers = [
                        'contour lines',
                        'contour labels'
                    ];
                    
                    contourLayers.forEach(layerId => {
                        if (this._map.getLayer(layerId)) {
                            this._map.setLayoutProperty(
                                layerId,
                                'visibility',
                                e.target.checked ? 'visible' : 'none'
                            );
                        }
                    });
                });
                
                $contoursContainer.append($contoursLabel);
                $sourceControl.append($contoursContainer);

                const $exaggerationSlider = $('<input>', {
                    type: 'range',
                    min: '0',
                    max: '10',
                    step: '0.2',
                    value: '1.5',
                    class: 'w-full'
                });
                
                const $exaggerationValue = $('<span>', { 
                    class: 'text-sm text-gray-600 ml-2',
                    text: '1.5x'
                });

                const $fogContainer = $('<div>', { class: 'mt-4' });
                const $fogSlider = $('<div>', { class: 'fog-range-slider' });
                
                const $fogStartSlider = $('<input>', {
                    type: 'range',
                    min: '-20',
                    max: '20',
                    step: '0.5',
                    value: '-1',
                    class: 'w-full'
                });
                
                const $fogEndSlider = $('<input>', {
                    type: 'range',
                    min: '-20',
                    max: '20',
                    step: '0.5',
                    value: '2',
                    class: 'w-full'
                });
                
                const $fogValue = $('<span>', { 
                    class: 'text-sm text-gray-600 ml-2',
                    text: '[-1, 2]'
                });

                const $horizonContainer = $('<div>', { class: 'mt-4' });
                const $horizonSlider = $('<input>', {
                    type: 'range',
                    min: '0',
                    max: '1',
                    step: '0.01',
                    value: '0.3',
                    class: 'w-full'
                });
                
                const $horizonValue = $('<span>', { 
                    class: 'text-sm text-gray-600 ml-2',
                    text: '0.3'
                });

                const $colorContainer = $('<div>', { class: 'mt-4' });
                const $colorPicker = $('<input>', {
                    type: 'color',
                    value: '#ffffff',
                    class: 'w-8 h-8 rounded cursor-pointer'
                });
                
                const $colorValue = $('<span>', { 
                    class: 'text-sm text-gray-600 ml-2',
                    text: '#ffffff'
                });

                const $highColorContainer = $('<div>', { class: 'mt-2' });
                const $highColorPicker = $('<input>', {
                    type: 'color',
                    value: '#add8e6',
                    class: 'w-8 h-8 rounded cursor-pointer'
                });
                
                const $highColorValue = $('<span>', { 
                    class: 'text-sm text-gray-600 ml-2',
                    text: '#add8e6'
                });

                const $spaceColorContainer = $('<div>', { class: 'mt-2' });
                const $spaceColorPicker = $('<input>', {
                    type: 'color',
                    value: '#d8f2ff',
                    class: 'w-8 h-8 rounded cursor-pointer'
                });
                
                const $spaceColorValue = $('<span>', { 
                    class: 'text-sm text-gray-600 ml-2',
                    text: '#d8f2ff'
                });

                $exaggerationSlider.on('input', (e) => {
                    const value = parseFloat(e.target.value);
                    $exaggerationValue.text(`${value}x`);
                    if (this._map.getTerrain()) {
                        this._map.setTerrain({
                            'source': 'mapbox-dem',
                            'exaggeration': value
                        });
                    }
                });

                const updateFog = () => {
                    const start = parseFloat($fogStartSlider.val());
                    const end = parseFloat($fogEndSlider.val());
                    const horizonBlend = parseFloat($horizonSlider.val());
                    const fogColor = $colorPicker.val();
                    const highColor = $highColorPicker.val();
                    const spaceColor = $spaceColorPicker.val();
                    
                    $fogValue.text(`[${start.toFixed(1)}, ${end.toFixed(1)}]`);
                    
                    if (this._map.getFog()) {
                        this._map.setFog({
                            'range': [start, end],
                            'horizon-blend': horizonBlend,
                            'color': fogColor,
                            'high-color': highColor,
                            'space-color': spaceColor,
                            'star-intensity': 0.0
                        });
                    }
                };

                $fogStartSlider.on('input', (e) => {
                    const start = parseFloat(e.target.value);
                    const end = parseFloat($fogEndSlider.val());
                    if (start < end) {
                        updateFog();
                    }
                });

                $fogEndSlider.on('input', (e) => {
                    const start = parseFloat($fogStartSlider.val());
                    const end = parseFloat(e.target.value);
                    if (end > start) {
                        updateFog();
                    }
                });

                $horizonSlider.on('input', (e) => {
                    const value = parseFloat(e.target.value);
                    $horizonValue.text(value.toFixed(2));
                    updateFog();
                });

                $colorPicker.on('input', (e) => {
                    const color = e.target.value;
                    $colorValue.text(color);
                    updateFog();
                });

                $highColorPicker.on('input', (e) => {
                    const color = e.target.value;
                    $highColorValue.text(color);
                    updateFog();
                });

                $spaceColorPicker.on('input', (e) => {
                    const color = e.target.value;
                    $spaceColorValue.text(color);
                    updateFog();
                });

                $sliderContainer.append(
                    $('<label>', { 
                        class: 'block text-sm text-gray-700 mb-1',
                        text: 'Terrain Exaggeration'
                    }),
                    $('<div>', { class: 'flex items-center' }).append($exaggerationSlider, $exaggerationValue)
                );

                $fogContainer.append(
                    $('<label>', { 
                        class: 'block text-sm text-gray-700 mb-1',
                        text: 'Fog Range'
                    }),
                    $fogSlider.append($fogStartSlider, $fogEndSlider),
                    $('<div>', { class: 'flex items-center' }).append($fogValue)
                );

                $horizonContainer.append(
                    $('<label>', { 
                        class: 'block text-sm text-gray-700 mb-1',
                        text: 'Horizon Blend'
                    }),
                    $('<div>', { class: 'flex items-center' }).append($horizonSlider, $horizonValue)
                );

                $colorContainer.append(
                    $('<label>', { 
                        class: 'block text-sm text-gray-700 mb-1',
                        text: 'Fog Color'
                    }),
                    $('<div>', { class: 'flex items-center' }).append($colorPicker, $colorValue),
                    
                    $('<label>', { 
                        class: 'block text-sm text-gray-700 mb-1 mt-2',
                        text: 'High Color'
                    }),
                    $('<div>', { class: 'flex items-center' }).append($highColorPicker, $highColorValue),
                    
                    $('<label>', { 
                        class: 'block text-sm text-gray-700 mb-1 mt-2',
                        text: 'Space Color'
                    }),
                    $('<div>', { class: 'flex items-center' }).append($spaceColorPicker, $spaceColorValue)
                );

                const $fogSettingsContainer = $('<div>', { class: 'mt-4' });
                const $fogSettingsLabel = $('<label>', { class: 'flex items-center' });
                const $fogSettingsCheckbox = $('<input>', {
                    type: 'checkbox',
                    class: 'mr-2',
                    checked: false
                });
                
                $fogSettingsLabel.append(
                    $fogSettingsCheckbox,
                    $('<span>', { 
                        class: 'text-sm text-gray-700',
                        text: 'Fog Settings'
                    })
                );

                const $fogSettingsContent = $('<div>', { 
                    class: 'fog-settings-content mt-2 hidden' 
                });

                $fogSettingsContent.append(
                    $fogContainer, 
                    $horizonContainer,
                    $colorContainer
                );

                $fogSettingsCheckbox.on('change', (e) => {
                    $fogSettingsContent.toggleClass('hidden', !e.target.checked);
                });

                $fogSettingsContainer.append($fogSettingsLabel, $fogSettingsContent);

                $sourceControl.append(
                    $sliderContainer,
                    $fogSettingsContainer
                );
            } else if (group.type === 'tms') {
                const sourceId = `tms-${group.id}`;
                const layerId = `tms-layer-${group.id}`;

                if (!this._map.getSource(sourceId)) {
                    this._map.addSource(sourceId, {
                        type: 'raster',
                        tiles: [group.url],
                        tileSize: 256,
                    });

                    this._map.addLayer({
                        id: layerId,
                        type: 'raster',
                        source: sourceId,
                        layout: {
                            visibility: 'none'
                        },
                        paint: {
                            'raster-opacity': group.opacity || 1
                        }
                    }, this._getInsertPosition('tms', groupIndex));
                }

                if (group.description) {
                    $('<div>', {
                        class: 'text-sm text-gray-600 mt-2 px-2',
                        text: group.description
                    }).appendTo($sourceControl);
                }
            } else if (group.type === 'vector') {
                const sourceId = `vector-${group.id}`;
                const layerId = `vector-layer-${group.id}`;

                if (!this._map.getSource(sourceId)) {
                    this._map.addSource(sourceId, {
                        type: 'vector',
                        tiles: [group.url],
                        maxzoom: 15,
                        promoteId: group.inspect?.id || 'id'
                    });

                    this._map.addLayer({
                        id: layerId,
                        type: 'fill',
                        source: sourceId,
                        'source-layer': group.sourceLayer || 'default',
                        layout: {
                            visibility: 'none'
                        },
                        paint: {
                            'fill-color': group.style?.color || '#FF0000',
                            'fill-opacity': group.style?.fillOpacity || 0.1
                        }
                    }, this._getInsertPosition('vector'));

                    this._map.addLayer({
                        id: `${layerId}-outline`,
                        type: 'line',
                        source: sourceId,
                        'source-layer': group.sourceLayer || 'default',
                        layout: {
                            visibility: 'none'
                        },
                        paint: {
                            'line-color': group.style?.color || '#FF0000',
                            'line-width': group.style?.width || 1,
                            'line-opacity': 1
                        }
                    }, this._getInsertPosition('vector'));

                    if (group.inspect) {
                        const popup = new mapboxgl.Popup({
                            closeButton: true,
                            closeOnClick: true
                        });

                        const hoverPopup = new mapboxgl.Popup({
                            closeButton: false,
                            closeOnClick: false,
                            className: 'hover-popup'
                        });

                        let hoveredFeatureId = null;
                        let selectedFeatureId = null;

                        // Get the source layer from group config, with a fallback
                        const sourceLayer = group.sourceLayer || 'default';

                        [layerId, `${layerId}-outline`].forEach(id => {
                            // Update hover and selection paint properties
                            if (id === layerId) {
                                this._map.setPaintProperty(id, 'fill-opacity', [
                                    'case',
                                    ['boolean', ['feature-state', 'selected'], false],
                                    0.2, // Selected opacity
                                    ['boolean', ['feature-state', 'hover'], false],
                                    0.8, // Hover opacity
                                    group.style?.fillOpacity || 0.1 // Default opacity
                                ]);
                            } else {
                                this._map.setPaintProperty(id, 'line-width', [
                                    'case',
                                    ['boolean', ['feature-state', 'selected'], false],
                                    4, // Selected width (thicker)
                                    ['boolean', ['feature-state', 'hover'], false],
                                    3, // Hover width
                                    group.style?.width || 1 // Default width
                                ]);
                                
                                // Add line-color variation for selected state
                                this._map.setPaintProperty(id, 'line-color', [
                                    'case',
                                    ['boolean', ['feature-state', 'selected'], false],
                                    '#000000', // Selected color (black)
                                    group.style?.color || '#FF0000' // Default color
                                ]);
                            }

                            // Update hover events
                            this._map.on('mousemove', id, (e) => {
                                if (e.features.length > 0) {
                                    const feature = e.features[0];
                                    
                                    // Update feature state for hover effect
                                    if (hoveredFeatureId !== null) {
                                        this._map.setFeatureState(
                                            { 
                                                source: sourceId, 
                                                sourceLayer: sourceLayer,
                                                id: hoveredFeatureId 
                                            },
                                            { hover: false }
                                        );
                                    }
                                    hoveredFeatureId = feature.id;
                                    this._map.setFeatureState(
                                        { 
                                            source: sourceId, 
                                            sourceLayer: sourceLayer,
                                            id: hoveredFeatureId 
                                        },
                                        { hover: true }
                                    );

                                    // Show hover popup
                                    if (group.inspect?.label) {
                                        const labelValue = feature.properties[group.inspect.label];
                                        if (labelValue) {
                                            hoverPopup
                                                .setLngLat(e.lngLat)
                                                .setDOMContent(this._createPopupContent(feature, group, true))
                                                .addTo(this._map);
                                        }
                                    }
                                }
                            });

                            this._map.on('mouseleave', id, () => {
                                // Clear hover state
                                if (hoveredFeatureId !== null) {
                                    this._map.setFeatureState(
                                        { 
                                            source: sourceId, 
                                            sourceLayer: sourceLayer,
                                            id: hoveredFeatureId 
                                        },
                                        { hover: false }
                                    );
                                    hoveredFeatureId = null;
                                }

                                // Remove hover popup
                                hoverPopup.remove();
                            });

                            // Update click event to handle selection
                            this._map.on('click', id, (e) => {
                                if (e.features.length > 0) {
                                    const feature = e.features[0];
                                    
                                    // Clear previous selection
                                    if (selectedFeatureId !== null) {
                                        this._map.setFeatureState(
                                            { 
                                                source: sourceId, 
                                                sourceLayer: sourceLayer,
                                                id: selectedFeatureId 
                                            },
                                            { selected: false }
                                        );
                                    }

                                    // Set new selection
                                    selectedFeatureId = feature.id;
                                    this._map.setFeatureState(
                                        { 
                                            source: sourceId, 
                                            sourceLayer: sourceLayer,
                                            id: selectedFeatureId 
                                        },
                                        { selected: true }
                                    );

                                    // Use the _createPopupContent method to create popup content
                                    const content = this._createPopupContent(feature, group);

                                    popup
                                        .setLngLat(e.lngLat)
                                        .setDOMContent(content)
                                        .addTo(this._map);
                                }
                            });

                            // Existing cursor style events
                            this._map.on('mouseenter', id, () => {
                                this._map.getCanvas().style.cursor = 'pointer';
                            });

                            this._map.on('mouseleave', id, () => {
                                this._map.getCanvas().style.cursor = '';
                            });
                        });
                    }
                }

                if (group.description) {
                    $('<div>', {
                        class: 'text-sm text-gray-600 mt-2 px-2',
                        text: group.description
                    }).appendTo($sourceControl);
                }
            } else {
                const $radioGroup = $('<div>', { class: 'radio-group' });

                group.layers.forEach((layer, index) => {
                    const $radioLabel = $('<label>', { class: 'radio-label' });
                    const $radio = $('<input>', {
                        type: 'radio',
                        name: `layer-group-${this._instanceId}-${groupIndex}`,
                        value: layer.id,
                        checked: index === 0
                    });

                    $radio.on('change', () => this._handleLayerChange(layer.id, group.layers));

                    $radioLabel.append(
                        $radio,
                        $('<span>', { text: layer.label })
                    );
                    $radioGroup.append($radioLabel);
                });

                $sourceControl.append($radioGroup);
            }

            if (group.legendImage) {
                const $legendContainer = $('<div>', {
                    class: 'legend-container mt-4 px-2'
                });

                const $legendImage = $('<img>', {
                    src: group.legendImage,
                    class: 'w-full rounded-lg shadow-sm cursor-pointer',
                    alt: 'Layer Legend'
                });

                // Add a collapsible toggle for the legend
                const $legendToggle = $('<button>', {
                    class: 'text-sm text-gray-700 flex items-center gap-2 mb-2 hover:text-gray-900',
                    html: '<span class="legend-icon">▼</span> Show Legend'
                });

                const $legendContent = $('<div>', {
                    class: 'legend-content hidden'
                }).append($legendImage);

                // Create modal elements
                const $modal = $('<div>', {
                    class: 'legend-modal hidden',
                    click: (e) => {
                        if (e.target === $modal[0]) {
                            $modal.addClass('hidden');
                        }
                    }
                });

                const $modalContent = $('<div>', {
                    class: 'legend-modal-content'
                });

                const $modalImage = $('<img>', {
                    src: group.legendImage,
                    alt: 'Layer Legend (Full Size)'
                });

                const $closeButton = $('<button>', {
                    class: 'legend-modal-close',
                    html: '×',
                    click: () => $modal.addClass('hidden')
                });

                $modalContent.append($closeButton, $modalImage);
                $modal.append($modalContent);
                $('body').append($modal);

                // Add click handler to legend image
                $legendImage.on('click', () => {
                    $modal.removeClass('hidden');
                });

                $legendToggle.on('click', () => {
                    $legendContent.toggleClass('hidden');
                    const $icon = $legendToggle.find('.legend-icon');
                    $icon.text($legendContent.hasClass('hidden') ? '▼' : '▲');
                    $legendToggle.html(`${$icon[0].outerHTML} ${$legendContent.hasClass('hidden') ? 'Show' : 'Hide'} Legend`);
                });

                $legendContainer.append($legendToggle, $legendContent);
                $sourceControl.append($legendContainer);
            }

            $groupContainer.append($sourceControl);
            $(this._container).append($groupContainer);

            $checkbox.on('change', () => {
                const isChecked = $checkbox.prop('checked');
                this._toggleSourceControl(groupIndex, isChecked);
            });
        });

        if (!this._initialized) {
            this._initializeWithAnimation();
        }

        window.addEventListener('resize', () => this._handleResize());
    }

    _initializeLayers() {
        this._options.groups.forEach(group => {
            if (!group.layers || group.type === 'terrain') return;
            
            group.layers.forEach(layer => {
                if (this._map.getLayer(layer.id)) {
                    this._map.setLayoutProperty(
                        layer.id,
                        'visibility',
                        'none'
                    );
                }
            });
        });
    }

    _toggleSourceControl(groupIndex, isChecked) {
        const sourceControl = this._sourceControls[groupIndex];
        const group = this._options.groups[groupIndex];
        
        if (isChecked) {
            sourceControl.classList.remove('collapsed');
            
            if (group.type === 'vector') {
                const layerId = `vector-layer-${group.id}`;
                if (this._map.getLayer(layerId)) {
                    this._map.setLayoutProperty(layerId, 'visibility', 'visible');
                    this._map.setLayoutProperty(`${layerId}-outline`, 'visibility', 'visible');
                }
            } else if (group.type === 'geojson') {
                const sourceId = `geojson-${group.id}`;
                if (this._map.getLayer(`${sourceId}-fill`)) {
                    this._map.setLayoutProperty(`${sourceId}-fill`, 'visibility', 'visible');
                }
                this._map.setLayoutProperty(`${sourceId}-line`, 'visibility', 'visible');
                this._map.setLayoutProperty(`${sourceId}-label`, 'visibility', 'visible');
            } else if (group.type === 'terrain') {
                this._map.setTerrain({
                    'source': 'mapbox-dem',
                    'exaggeration': 1.5
                });
            } else if (group.type === 'tms') {
                const layerId = `tms-layer-${group.id}`;
                if (this._map.getLayer(layerId)) {
                    this._map.setLayoutProperty(layerId, 'visibility', 'visible');
                }
            } else if (group.layers && group.layers.length > 0) {
                const firstLayer = group.layers[0];
                if (this._map.getLayer(firstLayer.id)) {
                    this._map.setLayoutProperty(
                        firstLayer.id,
                        'visibility',
                        'visible'
                    );
                    
                    const firstRadio = sourceControl.querySelector(`input[value="${firstLayer.id}"]`);
                    if (firstRadio) {
                        firstRadio.checked = true;
                        this._handleLayerChange(firstLayer.id, group.layers);
                    }
                }
            }
        } else {
            sourceControl.classList.add('collapsed');
            
            if (group.type === 'vector') {
                const layerId = `vector-layer-${group.id}`;
                if (this._map.getLayer(layerId)) {
                    this._map.setLayoutProperty(layerId, 'visibility', 'none');
                    this._map.setLayoutProperty(`${layerId}-outline`, 'visibility', 'none');
                }
            } else if (group.type === 'geojson') {
                const sourceId = `geojson-${group.id}`;
                if (this._map.getLayer(`${sourceId}-fill`)) {
                    this._map.setLayoutProperty(`${sourceId}-fill`, 'visibility', 'none');
                }
                this._map.setLayoutProperty(`${sourceId}-line`, 'visibility', 'none');
                this._map.setLayoutProperty(`${sourceId}-label`, 'visibility', 'none');
            } else if (group.type === 'terrain') {
                this._map.setTerrain(null);
            } else if (group.type === 'tms') {
                const layerId = `tms-layer-${group.id}`;
                if (this._map.getLayer(layerId)) {
                    this._map.setLayoutProperty(layerId, 'visibility', 'none');
                }
            } else if (group.layers) {
                group.layers.forEach(layer => {
                    if (this._map.getLayer(layer.id)) {
                        this._map.setLayoutProperty(
                            layer.id,
                            'visibility',
                            'none'
                        );
                    }
                });
            }
        }
    }

    _handleLayerChange(selectedLayerId, layers) {
        layers.forEach(layer => {
            if (this._map.getLayer(layer.id)) {
                const isVisible = layer.id === selectedLayerId;
                this._map.setLayoutProperty(
                    layer.id,
                    'visibility',
                    isVisible ? 'visible' : 'none'
                );

                const $radioInput = $(`input[value="${layer.id}"]`, this._container);
                if ($radioInput.length) {
                    const $label = $radioInput.closest('.radio-label');
                    $('.layer-info', $label.parent()).remove();

                    if (isVisible) {
                        const links = [];
                        if (layer.sourceUrl) {
                            links.push(`<a href="${layer.sourceUrl}" target="_blank" class="hover:underline">Source</a>`);
                        }
                        if (layer.location) {
                            links.push(`<a href="#" class="hover:underline view-link" data-location="${layer.location}">View</a>`);
                        }

                        const $infoDiv = $('<div>', {
                            class: 'layer-info text-xs pl-5 text-gray-600',
                            html: links.join(' | ')
                        });

                        $infoDiv.find('.view-link').on('click', (e) => {
                            e.preventDefault();
                            this._flyToLocation(layer.location);
                        });

                        $infoDiv.insertAfter($label);
                    }
                }
            }
        });
    }

    async _flyToLocation(location) {
        try {
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?access_token=${mapboxgl.accessToken}&country=in`
            );
            const data = await response.json();
            
            if (data.features && data.features.length > 0) {
                const [lng, lat] = data.features[0].center;
                this._map.flyTo({
                    center: [lng, lat],
                    zoom: 12,
                    duration: 2000
                });
            }
        } catch (error) {
            console.error('Error flying to location:', error);
        }
    }

    _initializeWithAnimation() {
        const groupHeaders = this._container.querySelectorAll('.layer-group > .group-header input[type="checkbox"]');
        
        groupHeaders.forEach((checkbox) => {
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));
        });

        setTimeout(() => {
            groupHeaders.forEach((checkbox, index) => {
                const group = this._options.groups[index];
                if (!group?.initiallyChecked) {
                    setTimeout(() => {
                        checkbox.checked = false;
                        checkbox.dispatchEvent(new Event('change'));
                    }, index * 200);
                }
            });
        }, 2000);

        this._initialized = true;
    }

    onRemove() {
        this._animationTimeouts.forEach(timeout => clearTimeout(timeout));
        this._animationTimeouts = [];
        
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
        window.removeEventListener('resize', () => this._handleResize());
    }

    _createPopupContent(feature, group, isHover = false) {
        const content = document.createElement('div');
        content.className = 'map-popup p-4 font-sans';
        
        // For hover state, only show label
        if (isHover) {
            if (group.inspect?.label) {
                const labelValue = feature.properties[group.inspect.label];
                if (labelValue) {
                    const labelDiv = document.createElement('div');
                    labelDiv.className = 'text-sm font-medium text-white';
                    labelDiv.textContent = labelValue;
                    content.appendChild(labelDiv);
                }
            }
            return content;
        }
        
        // Full popup content for click state
        if (group.inspect?.title) {
            const title = document.createElement('h3');
            title.className = 'text-xs uppercase tracking-wider mb-3 text-gray-500 font-medium';
            title.textContent = group.inspect.title;
            content.appendChild(title);
        }

        const grid = document.createElement('div');
        grid.className = 'grid gap-4 mb-4';
        
        // Add label field first if it exists
        if (group.inspect?.label) {
            const labelValue = feature.properties[group.inspect.label];
            if (labelValue) {
                const labelDiv = document.createElement('div');
                labelDiv.className = 'text-2xl font-light mb-2';
                labelDiv.textContent = labelValue;
                grid.appendChild(labelDiv);
            }
        }
        
        // Add fields
        if (group.inspect?.fields) {
            const fieldsGrid = document.createElement('div');
            fieldsGrid.className = 'grid grid-cols-2 gap-3 text-sm';
            
            group.inspect.fields.forEach((field, index) => {
                // Check if the field exists in feature properties
                if (feature.properties.hasOwnProperty(field) && field !== group.inspect.label) {
                    const value = feature.properties[field];
                    
                    // Create field container
                    const fieldContainer = document.createElement('div');
                    fieldContainer.className = 'col-span-2 grid grid-cols-2 gap-2 border-b border-gray-100 py-2';
                    
                    // Create and add field label using fieldTitles if available
                    const fieldLabel = document.createElement('div');
                    fieldLabel.className = 'text-gray-500 uppercase text-xs tracking-wider';
                    // Use fieldTitles if available, otherwise fallback to the field name
                    fieldLabel.textContent = group.inspect?.fieldTitles?.[index] || field;
                    fieldContainer.appendChild(fieldLabel);
                    
                    // Create and add field value
                    const fieldValue = document.createElement('div');
                    fieldValue.className = 'font-medium text-xs text-right';
                    fieldValue.textContent = value;
                    fieldContainer.appendChild(fieldValue);
                    
                    fieldsGrid.appendChild(fieldContainer);
                }
            });
            
            // Only append fieldsGrid if it has children
            if (fieldsGrid.children.length > 0) {
                grid.appendChild(fieldsGrid);
            }
        }
        
        content.appendChild(grid);

        // Add custom HTML if it exists
        if (group.inspect?.customHtml) {
            const customContent = document.createElement('div');
            customContent.className = 'text-xs text-gray-600 pt-3 mt-3 border-t border-gray-200';
            customContent.innerHTML = group.inspect.customHtml;
            content.appendChild(customContent);
        }

        return content;
    }

    _getInsertPosition(type, groupIndex) {
        const layers = this._map.getStyle().layers;
        
        if (type === 'vector') {
            // Vector layers should go at the end (top) of the style
            return undefined; // This will add it at the end
        }
        
        if (type === 'tms' || type === 'osm') {
            // Find the satellite/base layer
            const baseLayerIndex = layers.findIndex(layer => 
                layer.type === 'raster' && layer.id.includes('satellite')
            );
            
            if (baseLayerIndex !== -1) {
                // Insert just above the base layer
                // Earlier groups should be higher in the stack (later in the array)
                const insertBeforeId = layers[baseLayerIndex + 1]?.id;
                
                console.log(`Adding ${type} layer before: ${insertBeforeId}`, {
                    baseLayerIndex,
                    groupIndex,
                    layerStack: layers.map(l => ({ id: l.id, type: l.type }))
                });
                return insertBeforeId;
            }
        }
        
        console.log(`Adding layer at end of style (top of map)`, {
            type,
            layerStack: layers.map(l => ({ id: l.id, type: l.type }))
        });
        return undefined; // Add at the end (top) by default
    }
}

window.MapLayerControl = MapLayerControl; 