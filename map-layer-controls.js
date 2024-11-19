class MapLayerControl {
    constructor(options) {
        this._options = {
            groups: Array.isArray(options) ? options : [options]
        };
        MapLayerControl.instances = (MapLayerControl.instances || 0) + 1;
        this._instanceId = MapLayerControl.instances;
        this._initialized = false;
        this._animationTimeouts = [];
    }

    onAdd(map) {
        this._map = map;
        this._container = $('<div>', {
            class: 'mapboxgl-ctrl layer-control'
        })[0];
        this._sourceControls = [];

        if (this._map.isStyleLoaded()) {
            this._initializeControl();
        } else {
            this._map.on('style.load', () => {
                this._initializeControl();
            });
        }

        return this._container;
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

                    this._map.addLayer({
                        id: `${sourceId}-fill`,
                        type: 'fill',
                        source: sourceId,
                        paint: {
                            'fill-color': '#ff0000',
                            'fill-opacity': 0.5
                        },
                        layout: {
                            'visibility': 'none'
                        }
                    });

                    this._map.addLayer({
                        id: `${sourceId}-line`,
                        type: 'line',
                        source: sourceId,
                        paint: {
                            'line-color': '#ff0000',
                            'line-width': 2
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
                            'text-size': 12,
                            'text-anchor': 'center',
                            'text-offset': [0, 0],
                            'text-allow-overlap': false,
                            'text-ignore-placement': false
                        },
                        paint: {
                            'text-color': '#000000',
                            'text-halo-color': '#ffffff',
                            'text-halo-width': 2
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
                const $slider = $('<input>', {
                    type: 'range',
                    min: '0',
                    max: '10',
                    step: '0.2',
                    value: '1.5',
                    class: 'w-full'
                });
                
                const $value = $('<span>', { 
                    class: 'text-sm text-gray-600 ml-2',
                    text: '1.5x'
                });

                $slider.on('input', (e) => {
                    const value = parseFloat(e.target.value);
                    $value.text(`${value}x`);
                    if (this._map.getTerrain()) {
                        this._map.setTerrain({
                            'source': 'mapbox-dem',
                            'exaggeration': value
                        });
                    }
                });

                $sliderContainer.append(
                    $('<label>', { 
                        class: 'block text-sm text-gray-700 mb-1',
                        text: 'Terrain Exaggeration'
                    }),
                    $('<div>', { class: 'flex items-center' }).append($slider, $value)
                );
                $sourceControl.append($sliderContainer);
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
                this._map.setLayoutProperty(`${sourceId}-fill`, 'visibility', 'visible');
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
                this._map.setLayoutProperty(`${sourceId}-fill`, 'visibility', 'none');
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
        const checkboxes = this._container.querySelectorAll('input[type="checkbox"]');
        
        // First, check all checkboxes and show all layers
        checkboxes.forEach((checkbox) => {
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));
        });

        // After 2 seconds, start unchecking boxes that shouldn't be checked
        setTimeout(() => {
            checkboxes.forEach((checkbox, index) => {
                const group = this._options.groups[index];
                if (!group.initiallyChecked) {
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
    }
}

window.MapLayerControl = MapLayerControl; 