class MapLayerControl {
    constructor(options) {
        this._options = {
            groups: Array.isArray(options) ? options : [options]
        };
        MapLayerControl.instances = (MapLayerControl.instances || 0) + 1;
        this._instanceId = MapLayerControl.instances;
        this._initialized = false;
        this._animationTimeouts = [];
        this._collapsed = false;
        this._sourceControls = [];
    }

    onAdd(map) {
        this._map = map;
        
        this._wrapper = $('<div>', {
            class: 'layer-control-wrapper'
        })[0];
        
        this._toggleButton = $('<button>', {
            class: 'layer-control-toggle',
            html: '≡',
            click: (e) => {
                e.stopPropagation();
                this._toggleCollapse();
            }
        })[0];
        
        this._container = $('<div>', {
            class: 'mapboxgl-ctrl layer-control'
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
        $(this._toggleButton).html(this._collapsed ? '≡' : '×');
    }

    _handleResize() {
        if (window.innerWidth < 768 && !this._collapsed) {
            this._toggleCollapse();
        }
    }

    _initializeControl() {
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
                    value: '#ffffff',  // Default white
                    class: 'w-8 h-8 rounded cursor-pointer'
                });
                
                const $colorValue = $('<span>', { 
                    class: 'text-sm text-gray-600 ml-2',
                    text: '#ffffff'
                });

                // Add high-color picker
                const $highColorContainer = $('<div>', { class: 'mt-2' });
                const $highColorPicker = $('<input>', {
                    type: 'color',
                    value: '#add8e6',  // Default light blue
                    class: 'w-8 h-8 rounded cursor-pointer'
                });
                
                const $highColorValue = $('<span>', { 
                    class: 'text-sm text-gray-600 ml-2',
                    text: '#add8e6'
                });

                // Add space-color picker
                const $spaceColorContainer = $('<div>', { class: 'mt-2' });
                const $spaceColorPicker = $('<input>', {
                    type: 'color',
                    value: '#d8f2ff',  // Default light sky blue
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
                    
                    // Add high-color section
                    $('<label>', { 
                        class: 'block text-sm text-gray-700 mb-1 mt-2',
                        text: 'High Color'
                    }),
                    $('<div>', { class: 'flex items-center' }).append($highColorPicker, $highColorValue),
                    
                    // Add space-color section
                    $('<label>', { 
                        class: 'block text-sm text-gray-700 mb-1 mt-2',
                        text: 'Space Color'
                    }),
                    $('<div>', { class: 'flex items-center' }).append($spaceColorPicker, $spaceColorValue)
                );

                // Add fog settings checkbox
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

                // Create collapsible container for fog settings
                const $fogSettingsContent = $('<div>', { 
                    class: 'fog-settings-content mt-2 hidden' 
                });

                // Move all fog-related controls into the collapsible container
                $fogSettingsContent.append(
                    $fogContainer, 
                    $horizonContainer,
                    $colorContainer
                );

                // Toggle visibility of fog settings
                $fogSettingsCheckbox.on('change', (e) => {
                    $fogSettingsContent.toggleClass('hidden', !e.target.checked);
                });

                $fogSettingsContainer.append($fogSettingsLabel, $fogSettingsContent);

                // Append everything to source control
                $sourceControl.append(
                    $sliderContainer,
                    $fogSettingsContainer
                );
            } else if (group.type === 'wms') {
                const $checkboxGroup = $('<div>', { class: 'checkbox-group' });

                group.layers.forEach((layer) => {
                    const sourceId = `wms-source-${layer.id}`;
                    const layerId = `wms-${layer.id}`;

                    if (!this._map.getSource(sourceId)) {
                        const wmsUrl = `${group.baseUrl}?${new URLSearchParams({
                            'SERVICE': 'WMS',
                            'VERSION': '1.3.0',
                            'REQUEST': 'GetMap',
                            'FORMAT': 'image/png',
                            'TRANSPARENT': 'true',
                            'LAYERS': layer.wmsLayer,
                            'WIDTH': 512,
                            'HEIGHT': 512,
                            'CRS': 'EPSG:3857',
                            'BBOX': '{bbox-epsg-3857}',
                            'STYLES': 'default'
                        }).toString()}`;

                        const customTransform = {
                            transformRequest: (url, resourceType) => {
                                if (resourceType === 'Tile' && url.includes('onemapgoa')) {
                                    return {
                                        url: url.replace('onemapgoa.in', 'onemapgoagis.goa.gov.in'),
                                        headers: {
                                            'Referer': 'https://onemapgoa.in/',
                                            'Origin': 'https://onemapgoa.in'
                                        }
                                    };
                                }
                                return { url };
                            }
                        };

                        this._map.addSource(sourceId, {
                            type: 'raster',
                            tiles: [wmsUrl],
                            tileSize: 512,
                            ...customTransform
                        });

                        this._map.addLayer({
                            id: layerId,
                            type: 'raster',
                            source: sourceId,
                            layout: {
                                visibility: layer.initiallyChecked ? 'visible' : 'none'
                            },
                            paint: {
                                'raster-opacity': 0.7
                            }
                        });
                    }

                    const $checkboxLabel = $('<label>', { class: 'checkbox-label' });
                    const $checkbox = $('<input>', {
                        type: 'checkbox',
                        value: layerId,
                        checked: layer.initiallyChecked || false
                    });

                    $checkbox.on('change', () => {
                        this._map.setLayoutProperty(
                            layerId,
                            'visibility',
                            $checkbox.prop('checked') ? 'visible' : 'none'
                        );
                    });

                    $checkboxLabel.append(
                        $checkbox,
                        $('<span>', { text: layer.label })
                    );
                    $checkboxGroup.append($checkboxLabel);
                });

                $sourceControl.append($checkboxGroup);
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

            $groupContainer.append($sourceControl);
            $(this._container).append($groupContainer);

            $checkbox.on('change', () => {
                this._toggleSourceControl(groupIndex, $checkbox.prop('checked'));
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
            
            if (group.type === 'geojson') {
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
            
            if (group.type === 'geojson') {
                const sourceId = `geojson-${group.id}`;
                if (this._map.getLayer(`${sourceId}-fill`)) {
                    this._map.setLayoutProperty(`${sourceId}-fill`, 'visibility', 'none');
                }
                this._map.setLayoutProperty(`${sourceId}-line`, 'visibility', 'none');
                this._map.setLayoutProperty(`${sourceId}-label`, 'visibility', 'none');
            } else if (group.type === 'terrain') {
                this._map.setTerrain(null);
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
        
        // First, check all checkboxes and show all layers
        groupHeaders.forEach((checkbox) => {
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));
        });

        // After 2 seconds, start unchecking boxes that shouldn't be checked
        setTimeout(() => {
            groupHeaders.forEach((checkbox, index) => {
                const group = this._options.groups[index];
                if (!group?.initiallyChecked) {
                    // Uncheck sequentially with 200ms delay between each
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
}

window.MapLayerControl = MapLayerControl; 