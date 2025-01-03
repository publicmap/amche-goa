class MapLayerControl {
    constructor(options) {
        this._domCache = {};
        this._options = {
            groups: Array.isArray(options) ? options : [options]
        };
        MapLayerControl.instances = (MapLayerControl.instances || 0) + 1;
        this._instanceId = MapLayerControl.instances;
        this._initialized = false;
        this._animationTimeouts = [];
        this._collapsed = window.innerWidth < 768;
        this._sourceControls = [];
        this._editMode = false;
        const editModeToggle = document.getElementById('edit-mode-toggle');
        if (editModeToggle) {
            editModeToggle.addEventListener('click', () => {
                this._editMode = !this._editMode;
                editModeToggle.classList.toggle('active');
                editModeToggle.style.backgroundColor = this._editMode ? '#006dff' : '';
            });
        }
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
        if (this._resizeTimeout) {
            clearTimeout(this._resizeTimeout);
        }
        this._resizeTimeout = setTimeout(() => {
            if (window.innerWidth < 768 && !this._collapsed) {
                this._toggleCollapse();
            }
        }, 250);
    }

    _initializeControl() {
        this._initializeLayers();

        this._options.groups.forEach((group, groupIndex) => {
            const $groupContainer = $('<div>', { class: 'layer-group' });
            const $groupHeader = $('<div>', { class: 'group-header' });
            const $sourceControl = $('<div>', { class: 'source-control collapsed' });
            this._sourceControls[groupIndex] = $sourceControl[0];

            if (group.headerImage) {
                $groupHeader.css({
                    backgroundImage: `url(${group.headerImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative'
                });

                $('<div>', { class: 'header-overlay' }).appendTo($groupHeader);
            }

            const $label = $('<label>', { class: 'header-label' });
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

            // Create opacity button if layer type supports it
            let $opacityButton;
            if (['tms', 'vector', 'geojson', 'layer-group'].includes(group.type)) {
                $opacityButton = $('<button>', {
                    class: 'opacity-toggle hidden',
                    'data-opacity': '0.95',
                    title: '95% opacity'
                });
                
                // Add click handler for opacity button
                $opacityButton.on('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const currentOpacity = parseFloat($opacityButton.attr('data-opacity'));
                    const newOpacity = currentOpacity === 0.95 ? 0.5 : 0.95;
                    $opacityButton.attr('data-opacity', newOpacity);
                    $opacityButton.attr('title', `${newOpacity * 100}% opacity`);
                    
                    // Update layer opacity based on layer type
                    if (group.type === 'layer-group') {
                        const allLayers = this._map.getStyle().layers.map(layer => layer.id);
                        group.groups.forEach(subGroup => {
                            const matchingLayers = allLayers.filter(layerId => 
                                layerId === subGroup.id || 
                                layerId.startsWith(`${subGroup.id}-`) ||
                                layerId.startsWith(`${subGroup.id} `)
                            );
                            
                            matchingLayers.forEach(layerId => {
                                if (this._map.getLayer(layerId)) {
                                    const layer = this._map.getLayer(layerId);
                                    // Apply opacity based on layer type
                                    if (layer.type === 'fill') {
                                        this._map.setPaintProperty(layerId, 'fill-opacity', newOpacity * 0.5);
                                    } else if (layer.type === 'line') {
                                        this._map.setPaintProperty(layerId, 'line-opacity', newOpacity);
                                    } else if (layer.type === 'symbol') {
                                        this._map.setPaintProperty(layerId, 'text-opacity', newOpacity);
                                    } else if (layer.type === 'raster') {
                                        this._map.setPaintProperty(layerId, 'raster-opacity', newOpacity);
                                    }
                                }
                            });
                        });
                    } else if (group.type === 'geojson') {
                        const sourceId = `geojson-${group.id}`;
                        if (this._map.getLayer(`${sourceId}-fill`)) {
                            this._map.setPaintProperty(`${sourceId}-fill`, 'fill-opacity', newOpacity * 0.5);
                        }
                        if (this._map.getLayer(`${sourceId}-line`)) {
                            this._map.setPaintProperty(`${sourceId}-line`, 'line-opacity', newOpacity);
                        }
                        if (this._map.getLayer(`${sourceId}-label`)) {
                            this._map.setPaintProperty(`${sourceId}-label`, 'text-opacity', newOpacity);
                        }
                    } else if (group.type === 'tms') {
                        const layerId = `tms-layer-${group.id}`;
                        if (this._map.getLayer(layerId)) {
                            this._map.setPaintProperty(layerId, 'raster-opacity', newOpacity);
                        }
                    } else if (group.type === 'vector') {
                        const layerId = `vector-layer-${group.id}`;
                        if (this._map.getLayer(layerId)) {
                            this._map.setPaintProperty(layerId, 'fill-opacity', newOpacity * 0.5);
                            this._map.setPaintProperty(`${layerId}-outline`, 'line-opacity', newOpacity);
                        }
                    }
                });
            } else {
                // For unsupported types, create an empty span instead
                $opacityButton = $('<span>');
            }

            // Update checkbox change handler
            $checkbox.on('change', () => {
                const isChecked = $checkbox.prop('checked');
                if (['tms', 'vector', 'geojson', 'layer-group'].includes(group.type)) {
                    $opacityButton.toggleClass('hidden', !isChecked);
                }
                this._toggleSourceControl(groupIndex, isChecked);
            });

            // Append elements in the correct order
            $label.append($checkbox, $titleSpan, $opacityButton);
            $groupHeader.append($label);
            $groupContainer.append($groupHeader);
            $groupContainer.append($sourceControl);

            if (group.description) {
                $('<div>', {
                    class: 'title',
                    text: group.description
                }).appendTo($sourceControl);
            }

            if (group.type === 'layer-group') {
                const $radioGroup = $('<div>', { class: 'radio-group mt-2' });

                group.groups.forEach((subGroup, index) => {
                    const $radioLabel = $('<label>', { class: 'radio-label' });
                    const $radio = $('<input>', {
                        type: 'radio',
                        name: `layer-group-${this._instanceId}-${groupIndex}`,
                        value: subGroup.id,
                        checked: index === 0
                    });

                    $radio.on('change', () => this._handleLayerGroupChange(subGroup.id, group.groups));

                    $radioLabel.append(
                        $radio,
                        $('<span>', { text: subGroup.title })
                    );
                    $radioGroup.append($radioLabel);

                    if (subGroup.attribution || subGroup.location) {
                        const links = [];
                        if (subGroup.attribution) {
                            links.push(`<a href="${subGroup.attribution}" target="_blank" class="hover:underline">Source</a>`);
                        }
                        if (subGroup.location) {
                            links.push(`<a href="#" class="hover:underline view-link" data-location="${subGroup.location}">View</a>`);
                        }

                        const $infoDiv = $('<div>', {
                            class: 'layer-info text-xs pl-5 text-gray-600',
                            html: links.join(' | ')
                        });

                        $infoDiv.find('.view-link').on('click', (e) => {
                            e.preventDefault();
                            this._flyToLocation(subGroup.location);
                        });

                        $radioLabel.append($infoDiv);
                    }
                });

                $sourceControl.append($radioGroup);
            } else if (group.type === 'geojson') {
                const sourceId = `geojson-${group.id}`;
                if (!this._map.getSource(sourceId)) {
                    this._map.addSource(sourceId, {
                        type: 'geojson',
                        data: group.data
                    });

                    const style = group.style || {
                        fill: {
                            color: '#ff0000'
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
                                'fill-opacity': 0.95
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

                if (group.attribution) {
                    $('<div>', {
                        class: 'text-sm text-gray-600 mt-2 px-2',
                        html: group.attribution.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ')
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
                    value: '0',
                    class: 'w-full'
                });

                const $fogEndSlider = $('<input>', {
                    type: 'range',
                    min: '-20',
                    max: '20',
                    step: '0.5',
                    value: '10',
                    class: 'w-full'
                });

                const $fogValue = $('<span>', {
                    class: 'text-sm text-gray-600 ml-2',
                    text: '[0, 10]'
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

                const $highColorPicker = $('<input>', {
                    type: 'color',
                    value: '#add8e6',
                    class: 'w-8 h-8 rounded cursor-pointer'
                });

                const $highColorValue = $('<span>', {
                    class: 'text-sm text-gray-600 ml-2',
                    text: '#add8e6'
                });

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
                    }, this._getInsertPosition('tms'));
                }

                if (group.attribution) {
                    $('<div>', {
                        class: 'text-sm text-gray-600 mt-2 px-2',
                        html: group.attribution.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ')
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
                            'fill-opacity': 0.95
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

                        const sourceLayer = group.sourceLayer || 'default';

                        [layerId, `${layerId}-outline`].forEach(id => {
                            if (id === layerId) {
                                this._map.setPaintProperty(id, 'fill-opacity', [
                                    'case',
                                    ['boolean', ['feature-state', 'selected'], false],
                                    0.2,
                                    ['boolean', ['feature-state', 'hover'], false],
                                    0.8,
                                    0.95
                                ]);
                            } else {
                                this._map.setPaintProperty(id, 'line-width', [
                                    'case',
                                    ['boolean', ['feature-state', 'selected'], false],
                                    4,
                                    ['boolean', ['feature-state', 'hover'], false],
                                    3,
                                    group.style?.width || 1
                                ]);

                                this._map.setPaintProperty(id, 'line-color', [
                                    'case',
                                    ['boolean', ['feature-state', 'selected'], false],
                                    '#000000',
                                    group.style?.color || '#FF0000'
                                ]);
                            }

                            this._map.on('mousemove', id, (e) => {
                                if (e.features.length > 0) {
                                    const feature = e.features[0];

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

                                hoverPopup.remove();
                            });

                            this._map.on('click', id, (e) => {
                                if (this._editMode) {
                                    const lat = e.lngLat.lat.toFixed(6);
                                    const lng = e.lngLat.lng.toFixed(6);
                                    const visibleLayers = this._getVisibleLayers();
                                    const layersParam = encodeURIComponent(JSON.stringify(visibleLayers));
                                    const formUrl = `https://docs.google.com/forms/d/e/1FAIpQLScdWsTn3VnG8Xwh_zF7euRTyXirZ-v55yhQVLsGeWGwtX6MSQ/viewform?usp=pp_url&entry.1264011794=${lat}&entry.1677697288=${lng}&entry.650960474=${layersParam}`;

                                    new mapboxgl.Popup()
                                        .setLngLat(e.lngLat)
                                        .setHTML(`
                                            <div class="p-2">
                                                <p class="mb-2">Location: ${lat}, ${lng}</p>
                                                <p class="mb-2 text-xs text-gray-600">Visible layers: ${visibleLayers}</p>
                                                <a href="${formUrl}" target="_blank" class="text-blue-500 hover:text-blue-700 underline">Add note for this location</a>
                                            </div>
                                        `)
                                        .addTo(this._map);
                                    return;
                                }

                                if (e.features.length > 0) {
                                    const feature = e.features[0];

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

                                    selectedFeatureId = feature.id;
                                    this._map.setFeatureState(
                                        {
                                            source: sourceId,
                                            sourceLayer: sourceLayer,
                                            id: selectedFeatureId
                                        },
                                        { selected: true }
                                    );

                                    const content = this._createPopupContent(feature, group, false, e.lngLat);

                                    popup
                                        .setLngLat(e.lngLat)
                                        .setDOMContent(content)
                                        .addTo(this._map);
                                }
                            });

                            this._map.on('mouseenter', id, () => {
                                this._map.getCanvas().style.cursor = 'pointer';
                            });

                            this._map.on('mouseleave', id, () => {
                                this._map.getCanvas().style.cursor = '';
                            });
                        });
                    }
                }

                if (group.attribution) {
                    $('<div>', {
                        class: 'text-sm text-gray-600 mt-2 px-2',
                        html: group.attribution.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ')
                    }).appendTo($sourceControl);
                }
            } else if (group.type === 'markers' && group.dataUrl) {
                fetch(group.dataUrl)
                    .then(response => response.text())
                    .then(data => {
                        data = gstableToArray(JSON.parse(data.slice(47, -2)).table)
                        const sourceId = `markers-${group.id}`;

                        if (!this._map.getSource(sourceId)) {
                            this._map.addSource(sourceId, {
                                type: 'geojson',
                                data: {
                                    type: 'FeatureCollection',
                                    features: data.map(item => ({
                                        type: 'Feature',
                                        geometry: { type: 'Point', coordinates: [item.Longitude, item.Latitude] },
                                        properties: item
                                    }))
                                }
                            });

                            this._map.addLayer({
                                id: `${sourceId}-circles`,
                                type: 'circle',
                                source: sourceId,
                                paint: {
                                    'circle-radius': group.style?.radius || 6,
                                    'circle-color': group.style?.color || '#FF0000',
                                    'circle-opacity': 0.9,
                                    'circle-stroke-width': 1,
                                    'circle-stroke-color': '#ffffff'
                                },
                                layout: {
                                    'visibility': 'none'
                                }
                            });

                            this._map.on('click', `${sourceId}-circles`, (e) => {
                                if (e.features.length > 0) {
                                    const feature = e.features[0];
                                    const coordinates = feature.geometry.coordinates.slice();
                                    const content = this._createPopupContent(feature, group, false, {
                                        lng: coordinates[0],
                                        lat: coordinates[1]
                                    });
                                    new mapboxgl.Popup()
                                        .setLngLat(coordinates)
                                        .setDOMContent(content)
                                        .addTo(this._map);
                                }
                            });
                        }
                    });
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

                const $legendToggle = $('<button>', {
                    class: 'text-sm text-gray-700 flex items-center gap-2 mb-2 hover:text-gray-900',
                    html: '<span class="legend-icon">▼</span> Show Legend'
                });

                const $legendContent = $('<div>', {
                    class: 'legend-content hidden'
                }).append($legendImage);

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

            if (group.type === 'terrain') {
                // Enable terrain with default settings
                this._map.setTerrain({ 
                    'source': 'mapbox-dem',
                    'exaggeration': 1.5 
                });
                
                // Get existing fog settings or use defaults
                const existingFog = this._map.getFog() || {
                    'range': [-1, 2],
                    'horizon-blend': 0.3,
                    'color': '#ffffff',
                    'high-color': '#add8e6',
                    'space-color': '#d8f2ff',
                    'star-intensity': 0.0
                };

                // Set fog using existing or default values
                this._map.setFog(existingFog);

                // Update the UI controls to match existing values
                const $fogStartSlider = $(sourceControl).find('.fog-range-slider input').first();
                const $fogEndSlider = $(sourceControl).find('.fog-range-slider input').last();
                const $horizonSlider = $(sourceControl).find('.mt-4 input[type="range"]').first();
                const $colorPicker = $(sourceControl).find('input[type="color"]').eq(0);
                const $highColorPicker = $(sourceControl).find('input[type="color"]').eq(1);
                const $spaceColorPicker = $(sourceControl).find('input[type="color"]').eq(2);

                if ($fogStartSlider.length && $fogEndSlider.length) {
                    $fogStartSlider.val(existingFog.range[0]);
                    $fogEndSlider.val(existingFog.range[1]);
                    $(sourceControl).find('.fog-range-slider').next().find('span')
                        .text(`[${existingFog.range[0]}, ${existingFog.range[1]}]`);
                }

                if ($horizonSlider.length) {
                    $horizonSlider.val(existingFog['horizon-blend']);
                    $horizonSlider.next('span').text(existingFog['horizon-blend'].toFixed(2));
                }

                if ($colorPicker.length) $colorPicker.val(existingFog.color);
                if ($highColorPicker.length) $highColorPicker.val(existingFog['high-color']);
                if ($spaceColorPicker.length) $spaceColorPicker.val(existingFog['space-color']);
            } else if (group.type === 'layer-group') {
                const firstRadio = sourceControl.querySelector('input[type="radio"]');
                if (firstRadio) {
                    firstRadio.checked = true;
                    this._handleLayerGroupChange(firstRadio.value, group.groups);
                }
            } else if (group.type === 'geojson') {
                const sourceId = `geojson-${group.id}`;
                ['fill', 'line', 'label'].forEach(type => {
                    const layerId = `${sourceId}-${type}`;
                    if (this._map.getLayer(layerId)) {
                        this._map.setLayoutProperty(
                            layerId,
                            'visibility',
                            'visible'
                        );
                    }
                });
            } else if (group.type === 'tms') {
                const layerId = `tms-layer-${group.id}`;
                if (this._map.getLayer(layerId)) {
                    this._map.setLayoutProperty(layerId, 'visibility', 'visible');
                }
            } else if (group.type === 'vector') {
                const layerId = `vector-layer-${group.id}`;
                if (this._map.getLayer(layerId)) {
                    this._map.setLayoutProperty(layerId, 'visibility', 'visible');
                    this._map.setLayoutProperty(`${layerId}-outline`, 'visibility', 'visible');
                }
            } else if (group.type === 'markers') {
                const sourceId = `markers-${group.id}`;
                if (this._map.getLayer(`${sourceId}-circles`)) {
                    this._map.setLayoutProperty(`${sourceId}-circles`, 'visibility', 'visible');
                }
            } else if (group.layers) {
                const firstRadio = sourceControl.querySelector('input[type="radio"]');
                if (firstRadio) {
                    firstRadio.checked = true;
                    this._handleLayerChange(firstRadio.value, group.layers);
                }
            }
        } else {
            sourceControl.classList.add('collapsed');

            if (group.type === 'terrain') {
                // Disable terrain
                this._map.setTerrain(null);
                
                // Reset fog
                this._map.setFog(null);
                
                // Hide contour layers if they exist
                const contourLayers = ['contour lines', 'contour labels'];
                contourLayers.forEach(layerId => {
                    if (this._map.getLayer(layerId)) {
                        this._map.setLayoutProperty(
                            layerId,
                            'visibility',
                            'none'
                        );
                    }
                });
            } else if (group.type === 'layer-group') {
                const allLayers = this._map.getStyle().layers.map(layer => layer.id);
                group.groups.forEach(subGroup => {
                    const matchingLayers = allLayers.filter(layerId => 
                        layerId === subGroup.id || 
                        layerId.startsWith(`${subGroup.id}-`) ||
                        layerId.startsWith(`${subGroup.id} `)
                    );
                    
                    matchingLayers.forEach(layerId => {
                        if (this._map.getLayer(layerId)) {
                            this._map.setLayoutProperty(layerId, 'visibility', 'none');
                        }
                    });
                });
            } else if (group.type === 'geojson') {
                const sourceId = `geojson-${group.id}`;
                ['fill', 'line', 'label'].forEach(type => {
                    const layerId = `${sourceId}-${type}`;
                    if (this._map.getLayer(layerId)) {
                        this._map.setLayoutProperty(layerId, 'visibility', 'none');
                    }
                });
            } else if (group.type === 'tms') {
                const layerId = `tms-layer-${group.id}`;
                if (this._map.getLayer(layerId)) {
                    this._map.setLayoutProperty(layerId, 'visibility', 'none');
                }
            } else if (group.type === 'vector') {
                const layerId = `vector-layer-${group.id}`;
                if (this._map.getLayer(layerId)) {
                    this._map.setLayoutProperty(layerId, 'visibility', 'none');
                    this._map.setLayoutProperty(`${layerId}-outline`, 'visibility', 'none');
                }
            } else if (group.type === 'markers') {
                const sourceId = `markers-${group.id}`;
                if (this._map.getLayer(`${sourceId}-circles`)) {
                    this._map.setLayoutProperty(`${sourceId}-circles`, 'visibility', 'none');
                }
            } else if (group.layers) {
                group.layers.forEach(layer => {
                    if (this._map.getLayer(layer.id)) {
                        this._map.setLayoutProperty(layer.id, 'visibility', 'none');
                    }
                });
            }
        }
    }

    _handleLayerChange(selectedLayerId, layers) {
        const allLayers = this._map.getStyle().layers.map(layer => layer.id);
        
        layers.forEach(layer => {
            // Find all layers that start with this ID
            const matchingLayers = allLayers.filter(layerId => 
                layerId === layer.id || layerId.startsWith(`${layer.id} `)
            );
            
            matchingLayers.forEach(layerId => {
                if (this._map.getLayer(layerId)) {
                    const isVisible = layer.id === selectedLayerId;
                    this._map.setLayoutProperty(
                        layerId,
                        'visibility',
                        isVisible ? 'visible' : 'none'
                    );
                }
            });

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

        groupHeaders.forEach((checkbox, index) => {
            const group = this._options.groups[index];
            checkbox.checked = group?.initiallyChecked ?? false;
            checkbox.dispatchEvent(new Event('change'));
        });

        this._initialized = true;
    }

    onRemove() {
        this._cleanup();
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
        window.removeEventListener('resize', () => this._handleResize());
    }

    _createPopupContent(feature, group, isHover = false) {
        const content = document.createElement('div');
        content.className = 'map-popup p-2 text-sm';

        if (group.inspect?.label) {
            const labelValue = feature.properties[group.inspect.label];
            if (labelValue) {
                const labelDiv = document.createElement('div');
                labelDiv.className = 'font-medium';
                labelDiv.textContent = labelValue;
                content.appendChild(labelDiv);
            }
        }

        // Add fields in a compact format
        if (group.inspect?.fields) {
            const fieldsDiv = document.createElement('div');
            fieldsDiv.className = 'text-xs text-gray-600 mt-1';
            
            group.inspect.fields.forEach((field, index) => {
                if (feature.properties.hasOwnProperty(field) && field !== group.inspect.label) {
                    const value = feature.properties[field];
                    const fieldTitle = group.inspect?.fieldTitles?.[index] || field;
                    fieldsDiv.innerHTML += `${value}${index < group.inspect.fields.length - 1 ? ' • ' : ''}`;
                }
            });

            content.appendChild(fieldsDiv);
        }

        return content;
    }

    _getInsertPosition(type) {
        const layers = this._map.getStyle().layers;
        const baseLayerIndex = layers.findIndex(layer =>
            layer.type === 'raster' && layer.id.includes('satellite')
        );

        if (type === 'vector') {
            return undefined;
        }

        if (type === 'tms' || type === 'osm' || type === 'raster') {
            if (baseLayerIndex !== -1 && baseLayerIndex + 1 < layers.length) {
                const insertBeforeId = layers[baseLayerIndex + 1].id;

                return insertBeforeId;
            }
        }

        return undefined;
    }

    _getVisibleLayers() {
        return this._options.groups.flatMap(group => {
            const isLayerVisible = (id) =>
                this._map.getLayer(id) &&
                this._map.getLayoutProperty(id, 'visibility') === 'visible';

            switch (group.type) {
                case 'layer-group':
                    return group.groups
                        .map(subGroup => subGroup.id)
                        .filter(isLayerVisible);
                case 'vector':
                    const vectorId = `vector-layer-${group.id}`;
                    return isLayerVisible(vectorId) ? [vectorId] : [];
                case 'geojson':
                    const baseId = `geojson-${group.id}`;
                    return ['fill', 'line', 'label']
                        .map(type => `${baseId}-${type}`)
                        .filter(isLayerVisible);
                case 'tms':
                    const tmsId = `tms-layer-${group.id}`;
                    return isLayerVisible(tmsId) ? [tmsId] : [];
                default:
                    return (group.layers || [])
                        .map(layer => layer.id)
                        .filter(isLayerVisible);
            }
        });
    }

    _handleLayerGroupChange(selectedId, groups) {
        const allLayers = this._map.getStyle().layers
            .map(layer => layer.id)
            .filter(id => groups.some(group => 
                id === group.id || 
                id.startsWith(`${group.id}-`) ||
                id.startsWith(`${group.id} `)
            ));

        this._updateLayerVisibility(allLayers, false);
        
        const selectedLayers = allLayers.filter(id => 
            id === selectedId || 
            id.startsWith(`${selectedId}-`) ||
            id.startsWith(`${selectedId} `)
        );
        this._updateLayerVisibility(selectedLayers, true);
    }

    _updateLayerVisibility(layers, isVisible) {
        if (typeof this._map.batch === 'function') {
            this._map.batch(() => {
                this._updateLayerVisibilityImpl(layers, isVisible);
            });
        } else {
            this._updateLayerVisibilityImpl(layers, isVisible);
        }
    }

    _updateLayerVisibilityImpl(layers, isVisible) {
        layers.forEach(layerId => {
            if (this._map.getLayer(layerId)) {
                this._map.setLayoutProperty(
                    layerId,
                    'visibility',
                    isVisible ? 'visible' : 'none'
                );
            }
        });
    }

    _cleanup() {
        this._visibilityCache?.clear();
        this._domCache = {};
        if (this._resizeTimeout) {
            clearTimeout(this._resizeTimeout);
        }
        this._animationTimeouts.forEach(clearTimeout);
        this._animationTimeouts = [];
    }
}

function gstableToArray(tableData) {
    const { cols, rows } = tableData;
    const headers = cols.map(col => col.label);
    const result = rows.map(row => {
        const obj = {};
        row.c.forEach((cell, index) => {
            const key = headers[index];
            // Check if this is a timestamp column and has a value
            obj[key] = cell ? cell.v : null;
            if (cell && cell.v && key.toLowerCase().includes('timestamp')) {
                let timestamp = new Date(...cell.v.match(/\d+/g).map((v, i) => i === 1 ? +v - 1 : +v));
                timestamp = timestamp.setMonth(timestamp.getMonth() + 1)
                const now = new Date();
                const diffTime = Math.abs(now - timestamp);
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                // Create a human-readable "days ago" string
                let daysAgoText;
                if (diffDays === 0) {
                    daysAgoText = 'Today';
                } else if (diffDays === 1) {
                    daysAgoText = 'Yesterday';
                } else {
                    daysAgoText = `${diffDays} days ago`;
                }
                // Add the days ago text as a new field
                obj[`${key}_ago`] = daysAgoText;
            }
        });
        return obj;
    });
    return result;
}

window.MapLayerControl = MapLayerControl; 