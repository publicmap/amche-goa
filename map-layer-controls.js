import { getQueryParameters, convertToWebMercator } from './map-utils.js';
import { convertToKML, gstableToArray } from './map-utils.js';

class MapLayerControl {
    constructor(options) {
        this._defaultStyles = {
            vector: {
                fill: {
                    'fill-color': '#FF0000',
                    'fill-opacity': [
                        'case',
                        ['boolean', ['feature-state', 'selected'], false],
                        0.2,
                        ['boolean', ['feature-state', 'hover'], false],
                        0.8,
                        0.03
                    ]
                },
                line: {
                    'line-color': 'green',
                    'line-width': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        10, [
                            'case',
                            ['boolean', ['feature-state', 'selected'], false],
                            2,
                            ['boolean', ['feature-state', 'hover'], false],
                            1.5,
                            0.5
                        ],
                        16, [
                            'case',
                            ['boolean', ['feature-state', 'selected'], false],
                            4,
                            ['boolean', ['feature-state', 'hover'], false],
                            3,
                            1
                        ]
                    ],
                    'line-opacity': 1
                }
            },
            geojson: {
                fill: {
                    'fill-color': '#ff0000',
                    'fill-opacity': 0.5
                },
                line: {
                    'line-color': '#ff0000',
                    'line-width': 2
                },
                text: {
                    'text-field': ['get', 'name'],
                    'text-size': 12,
                    'text-color': '#000000',
                    'text-halo-color': '#ffffff',
                    'text-halo-width': 2,
                    'text-offset': [0, 0],
                    'text-anchor': 'center',
                    'text-justify': 'center',
                    'text-allow-overlap': false
                }
            },
            markers: {
                circle: {
                    'circle-radius': 6,
                    'circle-color': '#FF0000',
                    'circle-opacity': 0.9,
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#ffffff'
                }
            },
            terrain: {
                exaggeration: 1.5,
                fog: {
                    range: [-1, 2],
                    'horizon-blend': 0.3,
                    color: '#ffffff',
                    'high-color': '#add8e6',
                    'space-color': '#d8f2ff',
                    'star-intensity': 0.0
                }
            }
        };

        // Add default layer type ordering
        this._layerTypeOrder = options.layerTypeOrder || {
            background: 0,
            raster: 1,
            fill: 2,
            line: 3,
            symbol: 4,
            circle: 5,
            'fill-extrusion': 6,
            heatmap: 7
        };

        this._domCache = {};
        this._options = {
            groups: Array.isArray(options) ? options : [options]
        };
        MapLayerControl.instances = (MapLayerControl.instances || 0) + 1;
        this._instanceId = MapLayerControl.instances;
        this._initialized = false;
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
        
        // Add share link handler
        this._initializeShareLink();
        
        // Add modal container to body if it doesn't exist
        this._initializeSettingsModal();
    }

    _initializeShareLink() {
        const shareButton = document.getElementById('share-link');
        if (!shareButton) return;

        shareButton.addEventListener('click', () => {
            // Get all visible layers
            const visibleLayers = this._getVisibleLayers();
            
            // Create new URL with layers parameter
            const url = new URL(window.location.href);
            
            // Set layers parameter with all visible layers including streetmap
            if (visibleLayers.length > 0) {
                url.searchParams.set('layers', visibleLayers.join(','));
            } else {
                url.searchParams.delete('layers');
            }
            
            // Remove streetmap parameter if it exists (since we're now using layers)
            url.searchParams.delete('streetmap');
            
            // Create pretty URL by manually replacing encoded characters
            const prettyUrl = decodeURIComponent(url.toString())
                .replace(/\+/g, ' '); // Replace plus signs with spaces if needed
            
            // Update browser URL without reloading the page
            window.history.replaceState({}, '', prettyUrl);
            
            // Copy to clipboard
            navigator.clipboard.writeText(prettyUrl).then(() => {
                // Show toast notification
                this._showToast('Link copied to clipboard!');
                
                // Generate QR code using the pretty URL
                const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(prettyUrl)}`;
                
                // Create QR code image for button
                const qrCode = document.createElement('img');
                qrCode.src = qrCodeUrl;
                qrCode.alt = 'QR Code';
                qrCode.style.width = '30px';
                qrCode.style.height = '30px';
                qrCode.style.cursor = 'pointer';
                
                // Store original button content
                const originalContent = shareButton.innerHTML;
                
                // Replace button content with QR code
                shareButton.innerHTML = '';
                shareButton.appendChild(qrCode);
                
                // Add click handler to QR code to show full screen overlay
                qrCode.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    // Create full screen overlay
                    const overlay = document.createElement('div');
                    overlay.style.position = 'fixed';
                    overlay.style.top = '0';
                    overlay.style.left = '0';
                    overlay.style.width = '100%';
                    overlay.style.height = '100%';
                    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
                    overlay.style.display = 'flex';
                    overlay.style.justifyContent = 'center';
                    overlay.style.alignItems = 'center';
                    overlay.style.zIndex = '9999';
                    overlay.style.cursor = 'pointer';
                    overlay.style.padding = '10px'; // Add padding to ensure some space from edges
                    
                    // Create large QR code
                    const largeQRCode = document.createElement('img');
                    largeQRCode.src = qrCodeUrl; // Use the same high-res QR code
                    largeQRCode.alt = 'QR Code';
                    largeQRCode.style.width = 'auto';
                    largeQRCode.style.height = 'auto';
                    largeQRCode.style.maxWidth = 'min(500px, 90vw)'; // Use the smaller of 500px or 90% viewport width
                    largeQRCode.style.maxHeight = '90vh'; // Maximum 90% of viewport height
                    largeQRCode.style.objectFit = 'contain'; // Maintain aspect ratio
                    
                    // Close overlay when clicked
                    overlay.addEventListener('click', () => {
                        document.body.removeChild(overlay);
                    });
                    
                    overlay.appendChild(largeQRCode);
                    document.body.appendChild(overlay);
                });
                
                // Auto-revert after 30 seconds
                setTimeout(() => {
                    if (shareButton.contains(qrCode)) {
                        shareButton.innerHTML = originalContent;
                    }
                }, 30000);
            }).catch(err => {
                console.error('Failed to copy link:', err);
                this._showToast('Failed to copy link', 'error');
            });
        });
    }

    _showToast(message, type = 'success') {
        // Create toast element if it doesn't exist
        let toast = document.querySelector('.toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast-notification';
            document.body.appendChild(toast);
        }

        // Set message and style based on type
        toast.textContent = message;
        toast.style.backgroundColor = type === 'success' ? '#4CAF50' : '#f44336';

        // Show toast
        requestAnimationFrame(() => {
            toast.classList.add('show');
            
            // Hide toast after 3 seconds
            setTimeout(() => {
                toast.classList.remove('show');
                
                // Remove element after animation
                setTimeout(() => {
                    toast.remove();
                }, 300);
            }, 3000);
        });
    }

    _getVisibleLayers() {
        const visibleLayers = [];
        
        this._options.groups.forEach((group, index) => {
            // Find the toggle input within the group header
            const groupHeader = this._sourceControls[index]?.closest('.group-header');
            const toggleInput = groupHeader?.querySelector('.toggle-switch input[type="checkbox"]');
            
            if (toggleInput?.checked) {
                if (group.type === 'terrain') {
                    visibleLayers.push('terrain');
                } else if (group.type === 'vector') {
                    visibleLayers.push(group.id);
                } else if (group.type === 'tms') {
                    visibleLayers.push(group.id);
                } else if (group.type === 'markers') {
                    visibleLayers.push(group.id);
                } else if (group.type === 'geojson') {
                    visibleLayers.push(group.id);
                } else if (group.type === 'style') {
                    // Add streetmap parameter if style layer is visible
                    visibleLayers.push('streetmap');
                } else if (group.type === 'layer-group') {
                    // Find which radio button is selected in this group
                    const radioGroup = groupHeader?.querySelector('.radio-group');
                    const selectedRadio = radioGroup?.querySelector('input[type="radio"]:checked');
                    if (selectedRadio) {
                        visibleLayers.push(selectedRadio.value);
                    }
                }
            }
        });

        return visibleLayers;
    }

    renderToContainer(container, map) {
        this._container = container;
        this._map = map;

        // Initialize visibility cache if not exists
        this._visibilityCache = new Map();

        const $controlContainer = $('<div>', {
            class: 'layer-control'
        });
        
        if (this._map.isStyleLoaded()) {
            this._initializeControl($controlContainer);
        } else {
            this._map.on('style.load', () => {
                this._initializeControl($controlContainer);
            });
        }
        
        $(container).append($controlContainer);
    }

    _initializeControl($container) {
        // Replace the line that's causing the error (around line 302)
        // FROM: const urlParams = getQueryParameters();
        // TO:
        const urlParams = new URLSearchParams(window.location.search);
        
        // If no layers parameter is specified, treat all initiallyChecked layers as active
        const activeLayers = urlParams.get('layers') ? 
            urlParams.get('layers').split(',').map(s => s.trim()) : 
            this._options.groups
                .filter(group => group.initiallyChecked)
                .map(group => group.type === 'style' ? 'streetmap' : group.id);

        this._options.groups.forEach((group, groupIndex) => {
            // Update initiallyChecked based on URL parameter or original setting
            if (urlParams.get('layers')) {
                if (group.type === 'style') {
                    group.initiallyChecked = activeLayers.includes('streetmap');
                } else if (group.type === 'layer-group') {
                    // For layer groups, check if any of its subgroups are active
                    const hasActiveSubgroup = group.groups.some(subgroup => 
                        activeLayers.includes(subgroup.id)
                    );
                    group.initiallyChecked = hasActiveSubgroup;
                } else {
                    group.initiallyChecked = activeLayers.includes(group.id);
                }
            }
            const $groupHeader = $('<sl-details>', {
                class: 'group-header w-full map-controls-group',
                open: group.initiallyChecked || false
            });
            this._sourceControls[groupIndex] = $groupHeader[0];

            // Update the sl-show/hide event handlers to properly sync toggle switch state
            $groupHeader[0].addEventListener('sl-show', (event) => {
                const group = this._options.groups[groupIndex];
                const toggleInput = event.target.querySelector('.toggle-switch input[type="checkbox"]');
                
                if (toggleInput && !toggleInput.checked) {
                    toggleInput.checked = true;
                }
                
                if (group.type === 'style') {
                    // Update sublayer toggles
                    const $sublayerToggles = $(event.target).find('.layer-controls .toggle-switch input[type="checkbox"]');
                    $sublayerToggles.prop('checked', true);
                    
                    // Update layer visibility
                    if (group.layers) {
                        const styleLayers = this._map.getStyle().layers;
                        group.layers.forEach(layer => {
                            const layerIds = styleLayers
                                .filter(styleLayer => styleLayer['source-layer'] === layer.sourceLayer)
                                .map(styleLayer => styleLayer.id);
                            
                            layerIds.forEach(layerId => {
                                if (this._map.getLayer(layerId)) {
                                    this._map.setLayoutProperty(layerId, 'visibility', 'visible');
                                }
                            });
                        });
                    }
                } else {
                    this._toggleSourceControl(groupIndex, true);
                }
                
                $opacityButton.toggleClass('hidden', false);
                $(event.target).closest('.layer-group').addClass('active');
            });

            $groupHeader[0].addEventListener('sl-hide', (event) => {
                const group = this._options.groups[groupIndex];
                const toggleInput = event.target.querySelector('.toggle-switch input[type="checkbox"]');
                
                if (toggleInput && toggleInput.checked) {
                    toggleInput.checked = false;
                }
                
                if (group.type === 'style') {
                    // Update sublayer toggles
                    const $sublayerToggles = $(event.target).find('.layer-controls .toggle-switch input[type="checkbox"]');
                    $sublayerToggles.prop('checked', false);
                    
                    // Update layer visibility
                    if (group.layers) {
                        const styleLayers = this._map.getStyle().layers;
                        group.layers.forEach(layer => {
                            const layerIds = styleLayers
                                .filter(styleLayer => styleLayer['source-layer'] === layer.sourceLayer)
                                .map(styleLayer => styleLayer.id);
                            
                            layerIds.forEach(layerId => {
                                if (this._map.getLayer(layerId)) {
                                    this._map.setLayoutProperty(layerId, 'visibility', 'none');
                                }
                            });
                        });
                    }
                } else {
                    this._toggleSourceControl(groupIndex, false);
                }
                
                $opacityButton.toggleClass('hidden', true);
                $(event.target).closest('.layer-group').removeClass('active');
            });

            // Initialize layers only if they should be visible
            if (group.initiallyChecked) {
                // Set active class based on initial state
                $groupHeader.closest('.layer-group').addClass('active');
                
                // Use requestAnimationFrame to ensure DOM is ready
                requestAnimationFrame(() => {
                    this._toggleSourceControl(groupIndex, true);
                    if (['tms', 'vector', 'geojson', 'layer-group'].includes(group.type)) {
                        $opacityButton.toggleClass('hidden', false);
                    }
                });
            } else {
                // Ensure layers are hidden if not initially checked
                requestAnimationFrame(() => {
                    this._toggleSourceControl(groupIndex, false);
                });
            }

            // Add empty slots to remove the icons
            $groupHeader.append(
                $('<span>', { slot: 'expand-icon' }),
                $('<span>', { slot: 'collapse-icon' })
            );

            const $summary = $('<div>', {
                slot: 'summary',
                class: 'flex items-center relative w-full h-12'
            });

            // Add a click handler to the summary to control how clicks are processed
            $summary.on('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Always handle the click through our custom logic
                const $toggle = $summary.find('.toggle-switch input');
                const newState = !$toggle.prop('checked');
                
                // Update the toggle state
                $toggle.prop('checked', newState);
                
                // For style layers, handle visibility directly
                if (group.type === 'style') {
                    // Update sl-details state
                    $groupHeader[0].open = newState;
                    
                    // Update sublayer toggles
                    const $sublayerToggles = $groupHeader.find('.layer-controls .toggle-switch input[type="checkbox"]');
                    $sublayerToggles.prop('checked', newState);
                    
                    // Update layer visibility
                    if (group.layers) {
                        const styleLayers = this._map.getStyle().layers;
                        group.layers.forEach(layer => {
                            const layerIds = styleLayers
                                .filter(styleLayer => styleLayer['source-layer'] === layer.sourceLayer)
                                .map(styleLayer => styleLayer.id);
                            
                            layerIds.forEach(layerId => {
                                if (this._map.getLayer(layerId)) {
                                    this._map.setLayoutProperty(layerId, 'visibility', newState ? 'visible' : 'none');
                                }
                            });
                        });
                    }
                    
                    // Update active class
                    $groupHeader.closest('.layer-group').toggleClass('active', newState);
                } else {
                    // For non-style layers, trigger the change event
                    $toggle.trigger('change');
                }
            });

            const $contentWrapper = $('<div>', {
                class: 'flex items-center gap-2 relative z-10 w-full p-2'
            });

            // Replace checkbox with toggle switch
            const $toggleLabel = $('<label>', {
                class: 'toggle-switch'
            });

            const $toggleInput = $('<input>', {
                type: 'checkbox',
                checked: group.initiallyChecked || false
            }).on('change', (e) => {
                const isChecked = e.target.checked;
                const group = this._options.groups[groupIndex];
                
                // Special handling for style type layers
                if (group.type === 'style') {
                    // Update sl-details state
                    $groupHeader[0].open = isChecked;
                    
                    // Update sublayer toggles to match parent visibility
                    const $sublayerToggles = $groupHeader.find('.layer-controls .toggle-switch input[type="checkbox"]');
                    $sublayerToggles.prop('checked', isChecked);
                    
                    // Update layer visibility
                    if (group.layers) {
                        const styleLayers = this._map.getStyle().layers;
                        group.layers.forEach(layer => {
                            const layerIds = styleLayers
                                .filter(styleLayer => styleLayer['source-layer'] === layer.sourceLayer)
                                .map(styleLayer => styleLayer.id);
                            
                            layerIds.forEach(layerId => {
                                if (this._map.getLayer(layerId)) {
                                    this._map.setLayoutProperty(layerId, 'visibility', isChecked ? 'visible' : 'none');
                                }
                            });
                        });
                    }
                } else {
                    // Existing handling for non-style layers
                    if (isChecked !== $groupHeader[0].open) {
                        const self = this;
                        const handler = function(event) {
                            const checked = event.target.checked;
                            if (checked !== $groupHeader[0].open) {
                                $toggleInput.off('change', handler);
                                $groupHeader[0].open = checked;
                                setTimeout(() => {
                                    $toggleInput.on('change', handler);
                                }, 0);
                            }
                            $groupHeader.closest('.layer-group').toggleClass('active', checked);
                        };
                        handler.call(this, e);
                    }
                }
                
                // Update active class
                $groupHeader.closest('.layer-group').toggleClass('active', isChecked);
            });

            const $toggleSlider = $('<span>', {
                class: 'toggle-slider'
            });

            $toggleLabel.append($toggleInput, $toggleSlider);

            const $titleSpan = $('<span>', {
                text: group.title,
                class: 'control-title text-sm font-medium font-bold text-white'
            });

            // Simplify the toggle title container to just hold the elements
            const $toggleTitleContainer = $('<div>', {
                class: 'flex items-center gap-2 cursor-pointer'
            });
            $toggleTitleContainer.append($toggleLabel, $titleSpan);

            // Add settings button before the opacity button
            const $settingsButton = $('<sl-icon-button>', {
                name: 'gear-fill',
                class: 'settings-button ml-auto',
                label: 'Layer Settings'
            }).on('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this._showLayerSettings(group);
            });

            const $opacityButton = ['tms', 'vector', 'geojson', 'layer-group'].includes(group.type) 
                ? $('<sl-icon-button>', {
                    class: 'opacity-toggle hidden',
                    'data-opacity': '0.95',
                    title: 'Toggle opacity',
                    name: 'layers-fill',
                    'font-size': '2.5rem'
                }).css({
                    '--sl-color-neutral-600': '#ffffff',
                    '--sl-color-primary-600': 'currentColor',
                    '--sl-color-primary-500': 'currentColor',
                    'color': '#ffffff'
                })
                : $('<span>');

            // Update the order of buttons in the content wrapper
            $toggleTitleContainer.append($toggleLabel, $titleSpan);
            $contentWrapper.append($toggleTitleContainer, $settingsButton, $opacityButton);

            $opacityButton[0]?.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const currentOpacity = parseFloat($opacityButton.attr('data-opacity'));

                const newOpacity = currentOpacity === 0.95 ? 0.5 : 0.95;
                $opacityButton.attr('data-opacity', newOpacity);
                $opacityButton.title = `Toggle opacity`;
                
                // Update icon based on opacity
                $opacityButton.attr('name', newOpacity === 0.95 ? 'layers-fill' : 'layers');
                
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
                    const layerConfig = group._layerConfig;
                    if (!layerConfig) return;

                    if (layerConfig.hasFillStyles) {
                        this._map.setPaintProperty(`vector-layer-${group.id}`, 'fill-opacity', newOpacity * 0.5);
                    }
                    if (layerConfig.hasLineStyles) {
                        this._map.setPaintProperty(`vector-layer-${group.id}-outline`, 'line-opacity', newOpacity);
                    }
                }
            });

          
            // Add header background if exists
            if (group.headerImage) {
                const $headerBg = $('<div>', {
                    class: 'absolute top-0 left-0 right-0 w-full h-full bg-cover bg-center bg-no-repeat',
                    style: `background-image: url('${group.headerImage}')`
                });
                
                const $headerOverlay = $('<div>', {
                    class: 'absolute top-0 left-0 right-0 w-full h-full bg-black bg-opacity-40'
                });
                
                $summary.append($headerBg, $headerOverlay, $contentWrapper);
            } else {
                $summary.append($contentWrapper);
            }

            $contentWrapper.append($toggleTitleContainer, $settingsButton, $opacityButton);

            // Add source control to sl-details content
            const $sourceControl = $('<div>', {
                class: 'source-control mt-3 terrain-control-container' // Add terrain-control-container class
            });

            $container.append($groupHeader);

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

            $opacitySlider.on('input', (e) => {
                const value = parseFloat(e.target.value);
                $opacityValue.text(`${Math.round(value * 100)}%`);

                if (group.type === 'vector') {
                    const layerConfig = group._layerConfig;
                    if (!layerConfig) return;

                    if (layerConfig.hasFillStyles) {
                        this._map.setPaintProperty(`vector-layer-${group.id}`, 'fill-opacity', value * 0.5);
                    }
                    if (layerConfig.hasLineStyles) {
                        this._map.setPaintProperty(`vector-layer-${group.id}-outline`, 'line-opacity', value);
                    }
                } else if (group.type === 'geojson') {
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
                }
            });

            if (group.type !== 'terrain') {
                $sourceControl.append($opacityContainer);
            }

            if (group.description) {
                const $description = $('<div>', {
                    class: 'text-sm text-gray-600',
                    html: group.description  // Using html instead of text to allow HTML in descriptions
                });
                // Add description directly after the group header content
                const $contentArea = $('<div>', { class: 'description-area' });
                $contentArea.append($description);
                $groupHeader.append($contentArea);
            }

            // Add attribution with proper styling
            if (group.attribution) {
                const $attribution = $('<div>', {
                    class: 'layer-attribution',
                    html: `Source: ${group.attribution.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ')}`
                });
                
                // Add attribution to description area
                const $descriptionArea = $groupHeader.find('.description-area');
                if ($descriptionArea.length) {
                    $descriptionArea.append($attribution);
                } else {
                    const $newDescriptionArea = $('<div>', { class: 'description-area' });
                    $newDescriptionArea.append($attribution);
                    $groupHeader.append($newDescriptionArea);
                }
            }

            if (group.type === 'layer-group') {
                const $radioGroup = $('<div>', { class: 'radio-group mt-2' });
                const $contentArea = $('<div>');

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

                // Add radio group to content area
                $contentArea.append($radioGroup);
                
                // Add content area to sl-details
                $groupHeader.append($contentArea);
            } else if (group.type === 'geojson') {
                const sourceId = `geojson-${group.id}`;
                
                // Add source if it doesn't exist
                if (!this._map.getSource(sourceId)) {
                    this._map.addSource(sourceId, {
                        type: 'geojson',
                        data: group.url,
                        promoteId: group.inspect?.id // Add this line to promote property to feature ID
                    });

                    // Add fill layer
                    this._map.addLayer({
                        id: `${sourceId}-fill`,
                        type: 'fill',
                        source: sourceId,
                        paint: {
                            'fill-color': group.style?.['fill-color'] || this._defaultStyles.geojson.fill['fill-color'],
                            'fill-opacity': [
                                'case',
                                ['boolean', ['feature-state', 'hover'], false],
                                0.8,
                                group.style?.['fill-opacity'] || this._defaultStyles.geojson.fill['fill-opacity']
                            ]
                        },
                        layout: {
                            visibility: 'none'
                        }
                    }, this._getInsertPosition('geojson', 'fill'));

                    // Add line layer
                    this._map.addLayer({
                        id: `${sourceId}-line`,
                        type: 'line',
                        source: sourceId,
                        paint: {
                            'line-color': group.style?.['line-color'] || this._defaultStyles.geojson.line['line-color'],
                            'line-width': [
                                'interpolate',
                                ['linear'],
                                ['zoom'],
                                10, 1,  // At zoom level 10, line width will be 1
                                16, 3,  // At zoom level 16, line width will be 3
                                22, 5   // At zoom level 22, line width will be 5
                            ]
                        },
                        layout: {
                            'visibility': 'none'
                        }
                    }, this._getInsertPosition('geojson', 'line'));

                    // Add text layer if text properties are defined
                    if (group.style?.['text-field'] || group.style?.['text-size']) {
                        this._map.addLayer({
                            id: `${sourceId}-label`,
                            type: 'symbol',
                            source: sourceId,
                            layout: {
                                'text-font': group.style?.['text-font'] || ['Open Sans Bold'],
                                'text-field': group.style?.['text-field'] || this._defaultStyles.geojson.text['text-field'],
                                'text-size': group.style?.['text-size'] || this._defaultStyles.geojson.text['text-size'],
                                'text-anchor': group.style?.['text-anchor'] || this._defaultStyles.geojson.text['text-anchor'],
                                'text-justify': group.style?.['text-justify'] || this._defaultStyles.geojson.text['text-justify'],
                                'text-allow-overlap': group.style?.['text-allow-overlap'] || this._defaultStyles.geojson.text['text-allow-overlap'],
                                'text-offset': group.style?.['text-offset'] || this._defaultStyles.geojson.text['text-offset'],
                                visibility: 'none'
                            },
                            paint: {
                                'text-color': group.style?.['text-color'] || '#000000',
                                'text-halo-color': group.style?.['text-halo-color'] || '#ffffff',
                                'text-halo-width': group.style?.['text-halo-width'] !== undefined ? group.style['text-halo-width'] : 1,
                                'text-halo-blur': group.style?.['text-halo-blur'] !== undefined ? group.style['text-halo-blur'] : 1
                            }
                        }, this._getInsertPosition('geojson', 'symbol'));
                    }

                    // Fix interactivity by adding event listeners to all layer types
                    const layerIds = [`${sourceId}-fill`, `${sourceId}-line`];
                    if (group.style?.['text-field'] || group.style?.['text-size']) {
                        layerIds.push(`${sourceId}-label`);
                    }

                    this._setupLayerInteractivity(group, layerIds, sourceId);
                }
            } else if (group.type === 'terrain') {
                const $sliderContainer = $('<div>', { 
                    class: 'terrain-settings-section' // Add terrain-settings-section class
                });

                const $contoursContainer = $('<div>', { class: 'mb-4' });
                const $contoursLabel = $('<label>', { class: 'flex items-center' });
                
                // Replace checkbox with toggle switch
                const $contoursToggleLabel = $('<label>', {
                    class: 'toggle-switch mr-2'
                });
                
                const $contoursToggleInput = $('<input>', {
                    type: 'checkbox',
                    checked: false
                });
                
                const $contoursToggleSlider = $('<span>', {
                    class: 'toggle-slider'
                });
                
                $contoursToggleLabel.append($contoursToggleInput, $contoursToggleSlider);

                $contoursToggleInput.on('change', (e) => {
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

                $contoursLabel.append(
                    $contoursToggleLabel,
                    $('<span>', {
                        class: 'text-sm text-gray-700',
                        text: 'Contours'
                    })
                );

                $contoursContainer.append($contoursLabel);
                $sourceControl.append($contoursContainer);
                $groupHeader.append($sourceControl);

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
                    id: `fog-start-${this._instanceId}`,
                    min: '-20',
                    max: '20',
                    step: '0.5',
                    value: '0',
                    class: 'w-full'
                });

                const $fogEndSlider = $('<input>', {
                    type: 'range',
                    id: `fog-end-${this._instanceId}`,
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
                    id: `horizon-blend-${this._instanceId}`,
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
                    id: `fog-color-${this._instanceId}`,
                    value: '#ffffff',
                    class: 'w-8 h-8 rounded cursor-pointer'
                });

                const $colorValue = $('<span>', {
                    class: 'text-sm text-gray-600 ml-2',
                    text: '#ffffff'
                });

                const $highColorPicker = $('<input>', {
                    type: 'color',
                    id: `fog-high-color-${this._instanceId}`,
                    value: '#add8e6',
                    class: 'w-8 h-8 rounded cursor-pointer'
                });

                const $highColorValue = $('<span>', {
                    class: 'text-sm text-gray-600 ml-2',
                    text: '#add8e6'
                });

                const $spaceColorPicker = $('<input>', {
                    type: 'color',
                    id: `fog-space-color-${this._instanceId}`,
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
                        class: 'block text-sm text-gray-700 mb-2', // Increase bottom margin
                        text: 'Fog Color'
                    }),
                    $('<div>', { class: 'flex items-center mb-3' }).append($colorPicker, $colorValue), // Add bottom margin

                    $('<label>', {
                        class: 'block text-sm text-gray-700 mb-2', // Increase bottom margin
                        text: 'High Color'
                    }),
                    $('<div>', { class: 'flex items-center mb-3' }).append($highColorPicker, $highColorValue), // Add bottom margin

                    $('<label>', {
                        class: 'block text-sm text-gray-700 mb-2', // Increase bottom margin
                        text: 'Space Color'
                    }),
                    $('<div>', { class: 'flex items-center' }).append($spaceColorPicker, $spaceColorValue)
                );

                // Update the fog settings container and controls
                const $fogSettingsContainer = $('<div>', { 
                    class: 'mt-4 mb-4' // Add bottom margin
                });

                const $fogSettingsLabel = $('<label>', { 
                    class: 'flex items-center mb-2' // Add margin bottom
                });

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

                // Update the fog settings content container
                const $fogSettingsContent = $('<div>', {
                    class: 'fog-settings-content mt-2 hidden pb-4 terrain-settings-section' // Add terrain-settings-section class
                });

                $fogSettingsContent.append(
                    $fogContainer,
                    $horizonContainer,
                    $colorContainer
                );

                // Add the toggle behavior back
                $fogSettingsCheckbox.on('change', (e) => {
                    $fogSettingsContent.toggleClass('hidden', !e.target.checked);
                });

                // Append everything to the container
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
            } else if (group.type === 'vector') {
                const sourceId = `vector-${group.id}`;
                const hasFillStyles = group.style && (group.style['fill-color'] || group.style['fill-opacity']);
                const hasLineStyles = group.style && (group.style['line-color'] || group.style['line-width']);
                
                // Determine the main layer ID based on the primary style type
                const mainLayerId = hasFillStyles ? `vector-layer-${group.id}` : `vector-layer-${group.id}-outline`;

                if (!this._map.getSource(sourceId)) {
                    // Check if it's a Mapbox hosted tileset
                    if (group.url.startsWith('mapbox://')) {
                        this._map.addSource(sourceId, {
                            type: 'vector',
                            url: group.url,  // Keep the mapbox:// URL as is
                            maxzoom: group.maxzoom || 22,
                            promoteId: {
                                [group.sourceLayer]: group.inspect?.id // Add this line for vector tiles
                            }
                        });
                    } else {
                        // Handle other vector tile sources
                        this._map.addSource(sourceId, {
                            type: 'vector',
                            tiles: [group.url],
                            maxzoom: group.maxzoom || 22,
                            promoteId: {
                                [group.sourceLayer]: group.inspect?.id // Add this line for vector tiles
                            }
                        });
                    }

                    // Only add fill layer if fill styles are defined
                    if (hasFillStyles) {
                        const fillLayerConfig = {
                            id: `vector-layer-${group.id}`,
                            type: 'fill',
                            source: sourceId,
                            'source-layer': group.sourceLayer || 'default',
                            layout: {
                                visibility: 'none'
                            },
                            paint: {
                                'fill-color': group.style?.['fill-color'] || this._defaultStyles.vector.fill['fill-color'],
                                'fill-opacity': group.style?.['fill-opacity'] || this._defaultStyles.vector.fill['fill-opacity']
                            }
                        };
                        
                        // Only add filter if it's defined
                        if (group.filter) {
                            fillLayerConfig.filter = group.filter;
                        }
                        
                        this._map.addLayer(fillLayerConfig, this._getInsertPosition('vector', 'fill'));
                    }

                    // Add line layer if line styles are defined
                    if (hasLineStyles) {
                        const lineLayerConfig = {
                            id: `vector-layer-${group.id}-outline`,
                            type: 'line',
                            source: sourceId,
                            'source-layer': group.sourceLayer || 'default',
                            layout: {
                                visibility: 'none'
                            },
                            paint: {
                                'line-color': group.style?.['line-color'] || this._defaultStyles.vector.line['line-color'],
                                'line-width': group.style?.['line-width'] || this._defaultStyles.vector.line['line-width'],
                                'line-opacity': group.style?.['line-opacity'] || this._defaultStyles.vector.line['line-opacity']
                            }
                        };
                        
                        // Only add filter if it's defined
                        if (group.filter) {
                            lineLayerConfig.filter = group.filter;
                        }
                        
                        this._map.addLayer(lineLayerConfig, this._getInsertPosition('vector', 'line'));
                    }

                    // Add text layer if text styles are defined
                    if (group.style?.['text-field']) {
                        const textLayerConfig = {
                            id: `vector-layer-${group.id}-text`,
                            type: 'symbol',
                            source: sourceId,
                            'source-layer': group.sourceLayer || 'default',
                            layout: {
                                visibility: 'none',
                                'text-font': group.style?.['text-font'] || ['Open Sans Bold'],
                                'text-field': group.style['text-field'],
                                'text-size': group.style?.['text-size'] || 12,
                                'text-anchor': group.style?.['text-anchor'] || 'center',
                                'text-justify': group.style?.['text-justify'] || 'center',
                                'text-allow-overlap': group.style?.['text-allow-overlap'] || false,
                                'text-offset': group.style?.['text-offset'] || [0, 0]
                            },
                            paint: {
                                'text-color': group.style?.['text-color'] || '#000000',
                                'text-halo-color': group.style?.['text-halo-color'] || '#ffffff',
                                'text-halo-width': group.style?.['text-halo-width'] !== undefined ? group.style['text-halo-width'] : 1,
                                'text-halo-blur': group.style?.['text-halo-blur'] !== undefined ? group.style['text-halo-blur'] : 1
                            }
                        };

                        // Only add filter if it's defined
                        if (group.filter) {
                            textLayerConfig.filter = group.filter;
                        }

                        this._map.addLayer(textLayerConfig, this._getInsertPosition('vector', 'symbol'));
                    }

                    // Add inspect functionality if configured
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

                        // Add event listeners to both fill and line layers if they exist
                        const layerIds = [];
                        if (hasFillStyles) layerIds.push(`vector-layer-${group.id}`);
                        if (hasLineStyles) layerIds.push(`vector-layer-${group.id}-outline`);
                        if (group.style?.['text-field']) layerIds.push(`vector-layer-${group.id}-text`);

                        this._setupLayerInteractivity(group, layerIds, sourceId);
                    }
                }

                // Store the layer configuration for later use
                group._layerConfig = {
                    hasFillStyles,
                    hasLineStyles,
                    mainLayerId
                };
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
                                },
                                promoteId: group.inspect?.id // Add this line for marker layers
                            });

                            this._map.addLayer({
                                id: `${sourceId}-circles`,
                                type: 'circle',
                                source: sourceId,
                                paint: {
                                    ...this._defaultStyles.markers.circle,
                                    'circle-radius': group.style?.radius || this._defaultStyles.markers.circle['circle-radius'],
                                    'circle-color': group.style?.['fill-color'] || this._defaultStyles.markers.circle['circle-color']
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

            // When rendering legend images, we need to check if it's a PDF and handle it differently
            if (group.legendImage) {
                $groupHeader.append(`
                    <div class="legend-container">
                        ${this._renderLegendImage(group.legendImage)}
                    </div>
                `);
            }

            // Add sublayer controls for style type
            if (group.type === 'style' && group.layers) {
                const $layerControls = $('<div>', {
                    class: 'layer-controls mt-3'
                });

                $layerControls.append(group.layers.map((layer, index) => {
                    const layerId = `sublayer-${groupIndex}-${index}`;
                    const $layerControl = $('<div>', {
                        class: 'flex items-center gap-2 mb-2 text-black'
                    });

                    // Replace checkbox with toggle switch for sublayers
                    const $sublayerToggleLabel = $('<label>', {
                        class: 'toggle-switch'
                    });

                    const $sublayerToggleInput = $('<input>', {
                        type: 'checkbox',
                        id: layerId,
                        checked: group.initiallyChecked || false
                    });

                    const $sublayerToggleSlider = $('<span>', {
                        class: 'toggle-slider'
                    });

                    $sublayerToggleLabel.append($sublayerToggleInput, $sublayerToggleSlider);

                    // Add change event listener for the toggle
                    $sublayerToggleInput.on('change', (e) => {
                        const styleLayers = this._map.getStyle().layers;
                        const layersToToggle = styleLayers
                            .filter(styleLayer => styleLayer['source-layer'] === layer.sourceLayer)
                            .map(styleLayer => styleLayer.id);

                        layersToToggle.forEach(toggleLayerId => {
                            if (this._map.getLayer(toggleLayerId)) {
                                this._map.setLayoutProperty(
                                    toggleLayerId,
                                    'visibility',
                                    e.target.checked ? 'visible' : 'none'
                                );
                            }
                        });
                    });

                    // Create a clickable label that will toggle the switch
                    const $label = $('<label>', {
                        for: layerId,
                        class: 'text-sm cursor-pointer flex-grow'
                    }).text(layer.title).on('click', (e) => {
                        // Prevent default behavior to avoid double-toggling
                        e.preventDefault();
                        
                        // Toggle the input and trigger change event
                        $sublayerToggleInput.prop('checked', !$sublayerToggleInput.prop('checked'));
                        $sublayerToggleInput.trigger('change');
                    });

                    $layerControl.append($sublayerToggleLabel, $label);
                    return $layerControl;
                }));

                $groupHeader.append($layerControls);
            }

            // Add this after creating the radio group for layer-group types
            if (group.type === 'layer-group' && group.initiallyChecked) {
                // Find which subgroup should be selected based on URL parameters
                const activeSubgroupId = group.groups.find(subgroup => 
                    activeLayers.includes(subgroup.id)
                )?.id || group.groups[0].id;

                // Set the correct radio button as checked
                requestAnimationFrame(() => {
                    const radioGroup = $groupHeader.find('.radio-group');
                    const radio = radioGroup.find(`input[value="${activeSubgroupId}"]`);
                    if (radio.length) {
                        radio.prop('checked', true);
                        this._handleLayerGroupChange(activeSubgroupId, group.groups);
                    }
                });
            }

            // Add contentWrapper to summary and summary to groupHeader
            $contentWrapper.append($toggleTitleContainer, $settingsButton, $opacityButton);
            $summary.append($contentWrapper);
            $groupHeader.append($summary);
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
                    // Set initial visibility
                    this._map.setLayoutProperty(
                        layer.id,
                        'visibility',
                        'none'
                    );
                    
                    // Apply filter if defined in group config
                    if (group.filter) {
                        console.log(group.filter)
                        this._map.setFilter(layer.id, group.filter);
                    }
                }
            });
        });

        // Check if this is a vector layer type
        if (group.type === 'vector') {
            // Determine the geometry type of the layer based on style properties
            const hasLineStyle = group.style && ('line-color' in group.style || 'line-width' in group.style);
            const hasFillStyle = group.style && ('fill-color' in group.style || 'fill-opacity' in group.style);
            
            // For line-only layers (like lineaments), we only need to add a line layer
            if (hasLineStyle && !hasFillStyle) {
                // Add line layer only
                this.map.addLayer({
                    'id': layerId,
                    'type': 'line',
                    'source': sourceId,
                    'source-layer': group.sourceLayer,
                    'layout': {
                        'visibility': visible ? 'visible' : 'none',
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    'paint': {
                        'line-color': group.style['line-color'] || 'black',
                        'line-width': group.style['line-width'] || 1,
                        'line-opacity': group.style['line-opacity'] !== undefined ? group.style['line-opacity'] : 1
                    },
                    'filter': group.filter || null
                }, this._getInsertPosition(group.type));
                
                this._setupLayerInteractivity(group, [layerId], sourceId);
            } else {
                // Add both fill and line layers as before for features with both types
                // ... existing fill and line layer code ...
            }
        }
    }

    _toggleSourceControl(groupIndex, visible) {
        const group = this._options.groups[groupIndex];
        this._currentGroup = group;
        
        if (group.type === 'style') {
            // Get all style layers
            const styleLayers = this._map.getStyle().layers;
            
            // If group has specific layers defined, use those
            if (group.layers) {
                // Update sublayer toggles to match parent visibility
                const $groupHeader = $(this._sourceControls[groupIndex]);
                const $sublayerToggles = $groupHeader.find('.layer-controls .toggle-switch input[type="checkbox"]');
                $sublayerToggles.prop('checked', visible);

                group.layers.forEach(layer => {
                    const layerIds = styleLayers
                        .filter(styleLayer => styleLayer['source-layer'] === layer.sourceLayer)
                        .map(styleLayer => styleLayer.id);
                    
                    layerIds.forEach(layerId => {
                        if (this._map.getLayer(layerId)) {
                            this._map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
                        }
                    });
                });
            } 
            // If sourceLayers are defined, use those
            else if (group.sourceLayers) {
                styleLayers.forEach(layer => {
                    if (layer['source-layer'] && group.sourceLayers.includes(layer['source-layer'])) {
                        this._map.setLayoutProperty(layer.id, 'visibility', visible ? 'visible' : 'none');
                    }
                });
            }
            return; // Exit after handling style layers
        }
        
        if (group.type === 'style') {
            // Get all style layers
            const styleLayers = this._map.getStyle().layers;
            
            // If group has specific layers defined, use those
            if (group.layers) {
                group.layers.forEach(layer => {
                    const layerIds = styleLayers
                        .filter(styleLayer => styleLayer['source-layer'] === layer.sourceLayer)
                        .map(styleLayer => styleLayer.id);
                    
                    layerIds.forEach(layerId => {
                        if (this._map.getLayer(layerId)) {
                            this._map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
                        }
                    });
                });
            } 
            // If sourceLayers are defined, use those
            else if (group.sourceLayers) {
                styleLayers.forEach(layer => {
                    if (layer['source-layer'] && group.sourceLayers.includes(layer['source-layer'])) {
                        this._map.setLayoutProperty(layer.id, 'visibility', visible ? 'visible' : 'none');
                    }
                });
            }
            return; // Exit after handling style layers
        }
        
        if (group.type === 'layer-group') {
            group.groups.forEach(subGroup => {
                const allLayers = this._map.getStyle().layers
                    .map(layer => layer.id)
                    .filter(id => 
                        id === subGroup.id || 
                        id.startsWith(`${subGroup.id}-`) ||
                        id.startsWith(`${subGroup.id} `)
                    );
                this._updateLayerVisibility(allLayers, visible);
            });
        } else if (group.type === 'geojson') {
            const sourceId = `geojson-${group.id}`;
            ['fill', 'line', 'label'].forEach(type => {
                const layerId = `${sourceId}-${type}`;
                if (this._map.getLayer(layerId)) {
                    this._map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
                }
            });
        } else if (group.type === 'tms') {
            const layerId = `tms-layer-${group.id}`;
            if (this._map.getLayer(layerId)) {
                this._map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
            }
        } else if (group.type === 'vector') {
            const layerConfig = group._layerConfig;
            if (!layerConfig) return;

            if (layerConfig.hasFillStyles) {
                const fillLayerId = `vector-layer-${group.id}`;
                this._map.setLayoutProperty(fillLayerId, 'visibility', visible ? 'visible' : 'none');
            }
            
            if (layerConfig.hasLineStyles) {
                const lineLayerId = `vector-layer-${group.id}-outline`;
                this._map.setLayoutProperty(lineLayerId, 'visibility', visible ? 'visible' : 'none');
            }

            // Handle text layer visibility
            if (group.style?.['text-field']) {
                const textLayerId = `vector-layer-${group.id}-text`;
                this._map.setLayoutProperty(textLayerId, 'visibility', visible ? 'visible' : 'none');
            }
        }
    }

    _handleLayerChange(selectedLayerId, layers) {
        const allLayers = this._map.getStyle().layers.map(layer => layer.id);
        
        layers.forEach(layer => {
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
        const groupHeaders = this._container.querySelectorAll('.layer-group > .group-header .toggle-switch input[type="checkbox"]');

        groupHeaders.forEach((toggleInput, index) => {
            const group = this._options.groups[index];
            toggleInput.checked = group?.initiallyChecked ?? false;
            toggleInput.dispatchEvent(new Event('change'));
        });

        if (!this._initialized) {
            // Add no-transition class initially
            this._container.classList.add('no-transition');
            // Force a reflow
            void this._container.offsetWidth;
            // Remove no-transition class
            this._container.classList.remove('no-transition');
            
            this._initialized = true;
        }
        
        // Add collapsed class after a brief delay to ensure initial render is complete
        requestAnimationFrame(() => {
            this._container.classList.add('collapsed');
        });
    }

    toggleControl() {
        // Ensure smooth animation by using requestAnimationFrame
        requestAnimationFrame(() => {
            this._container.classList.toggle('collapsed');
        });
        this._toggleButton.classList.toggle('is-open');
    }

    _createPopupContent(feature, group, isHover = false, lngLat = null) {
        // Disable hover popups on mobile devices
        if (isHover && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
            return null;
        }
        
        if (isHover) {
            return this._createHoverPopupContent(feature, group);
        }
        
        return this._createDetailedPopupContent(feature, group, lngLat);
    }

    _createHoverPopupContent(feature, group) {
        if (!this._hoverTemplate) {
            this._hoverTemplate = document.createElement('div');
            this._hoverTemplate.className = 'map-popup p-0 font-sans';
        }
        const content = this._hoverTemplate.cloneNode(true);

        if (group.inspect?.label) {
            const labelValue = feature.properties[group.inspect.label];
            if (labelValue) {
                const labelDiv = document.createElement('div');
                labelDiv.className = 'text-base font-medium';
                labelDiv.textContent = labelValue;
                content.appendChild(labelDiv);

                if (group.inspect?.fields) {
                    group.inspect.fields.forEach(field => {
                        const value = feature.properties[field];
                        if (value) {
                            const fieldDiv = document.createElement('div');
                            fieldDiv.className = 'text-sm';
                            fieldDiv.textContent = value;
                            content.appendChild(fieldDiv);
                        }
                    });
                }
            }
        }
        return content;
    }

    _createDetailedPopupContent(feature, group, lngLat = null) {
        // ... existing detailed popup content code ...
        // Copy all the code that was previously in _createPopupContent after the isHover check
        const content = document.createElement('div');
        content.className = 'map-popup p-4 font-sans';

        // If there's a header image, add it as a background
        if (group.headerImage) {
            content.style.backgroundImage = `linear-gradient(to bottom, rgba(255, 255, 255, 0.3) 0px, rgba(255, 255, 255, 1) 60px), url('${group.headerImage}')`;
            content.style.backgroundSize = 'auto';
            content.style.backgroundPosition = 'left top';
            content.style.backgroundRepeat = 'no-repeat';
        }

        // Add layer name at the top
        const layerName = document.createElement('div');
        layerName.className = 'text-xs uppercase tracking-wider mb-2 text-gray-400 font-medium';
        layerName.textContent = group.title;
        content.appendChild(layerName);

        if (group.inspect?.title) {
            const title = document.createElement('h3');
            title.className = 'text-xs uppercase tracking-wider mb-3 text-gray-500 font-medium';
            title.textContent = group.inspect.title;
            content.appendChild(title);
        }

        const grid = document.createElement('div');
        grid.className = 'grid';

        if (group.inspect?.label) {
            const labelValue = feature.properties[group.inspect.label];
            if (labelValue) {
                const labelDiv = document.createElement('div');
                labelDiv.className = 'text-2xl font-light mb-2';
                labelDiv.textContent = labelValue;
                grid.appendChild(labelDiv);
            }
        }

        if (group.inspect?.fields) {
            const fieldsGrid = document.createElement('div');
            fieldsGrid.className = 'grid grid-cols-2 text-sm';

            group.inspect.fields.forEach((field, index) => {
                if (feature.properties.hasOwnProperty(field) && field !== group.inspect.label) {
                    const value = feature.properties[field];

                    const fieldContainer = document.createElement('div');
                    fieldContainer.className = 'col-span-2 grid grid-cols-2 gap-2 border-b border-gray-100 py-2';

                    const fieldLabel = document.createElement('div');
                    fieldLabel.className = 'text-gray-500 uppercase text-xs tracking-wider';
                    fieldLabel.textContent = group.inspect?.fieldTitles?.[index] || field;
                    fieldContainer.appendChild(fieldLabel);

                    const fieldValue = document.createElement('div');
                    fieldValue.className = 'font-medium text-xs text-right';
                    fieldValue.textContent = value;
                    fieldContainer.appendChild(fieldValue);

                    fieldsGrid.appendChild(fieldContainer);
                }
            });

            if (fieldsGrid.children.length > 0) {
                grid.appendChild(fieldsGrid);
            }
        }

        content.appendChild(grid);

        // Add custom HTML if it exists
        if (group.inspect?.customHtml) {
            const customContent = document.createElement('div');
            customContent.className = 'text-xs text-gray-600 pt-3 pb-3 border-t border-gray-200';
            customContent.innerHTML = group.inspect.customHtml;
            content.appendChild(customContent);
        }

        // Add attribution section if it exists
        if (group.attribution) {
            const attributionContainer = document.createElement('div');
            attributionContainer.className = 'text-xs text-gray-600 pt-3 border-t border-gray-200 attribution-container';
            
            const attributionContent = document.createElement('div');
            attributionContent.className = 'attribution-content line-clamp-2'; // Initially show 2 lines
            attributionContent.innerHTML = `Source: ${group.attribution.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ')}`;
            
            const expandButton = document.createElement('button');
            expandButton.className = 'text-blue-600 hover:text-blue-800 text-xs mt-1 hidden expand-attribution';
            expandButton.textContent = 'Show more';
            
            attributionContainer.appendChild(attributionContent);
            attributionContainer.appendChild(expandButton);
            
            // Check if content needs expand button
            setTimeout(() => {
                if (attributionContent.scrollHeight > attributionContent.clientHeight) {
                    expandButton.classList.remove('hidden');
                    
                    expandButton.addEventListener('click', () => {
                        if (attributionContent.classList.contains('line-clamp-2')) {
                            attributionContent.classList.remove('line-clamp-2');
                            expandButton.textContent = 'Show less';
                        } else {
                            attributionContent.classList.add('line-clamp-2');
                            expandButton.textContent = 'Show more';
                        }
                    });
                }
            }, 0);
            
            content.appendChild(attributionContainer);
        }

        const lat = lngLat ? lngLat.lat : feature.geometry.coordinates[1];
        const lng = lngLat ? lngLat.lng : feature.geometry.coordinates[0];
        const zoom = this._map.getZoom();

        const mercatorCoords = convertToWebMercator(lng, lat);
        const oneMapGoaLayerList = '&l=gp_police_station_a9c73118_2035_466c_9f5d_8888580816a0%21%2Cdma_garbage_treatment_plant_fc46bf4b_245c_4856_be7b_568b46a117c4%21%2Cdma_mrf_faciltiy_polygon_93c1ae1a_ea42_46c5_bbec_ed589e08d8c0%21%2Cdma_bio_methanation_plant_polygon_bdeb7c4d_17ec_4d9f_9e4a_3bf702905e1a%21%2Cdma_weighing_bridge_54e8be7c_e105_4098_a5fa_fb939eeba75e%21%2Cdma_mrf_faciltiy_95b4b5a3_a2ce_481b_9711_7f049ca1e244%21%2Cdma_incinerator_2d57ae07_9b3e_4168_ac8b_7f2187d5681a%21%2Cdma_ccp_biodigester_84960e2a_0ddf_465a_9bca_9bb35c4abcb4%21%2Cdma_bio_methanation_plant__f0edd163_cf6b_4084_9122_893ebc83d4fe%21%2Cdma_waste_management_sities_fa8b2c94_d4cd_4533_9c7e_8cf0d3b30b87%21%2Cdma_windrows_composting_shed_30ef18af_c8a7_45a9_befb_0b6c555bd263%21%2Cdgm_leases_f7677297_2e19_4d40_850f_0835388ecf18%21%2Cdgm_lease_names_fdb18573_adc9_4a60_9f1e_6c22c04d7871%21%2Cgdms_landslide_vulnerable_ced97822_2753_4958_9edc_7f221a6b52c9%21%2Cgdm_flooding_areas_1be469a8_af9d_46cf_953e_49256db7fe1d%21%2Cgsidc_sewerage_line_bddff132_f998_4be1_be43_b0fb71520499%21%2Cgsidc_sewerage_manhole_0654846e_5144_4d1f_977e_58d9c2c9a724%21%2Cged_division_boundary_04fe437b_405f_45fa_8357_02f0d564bdd4%21%2Cged_substation_4c686ea3_95a6_43e8_b136_e338a3a47e79%21%2Cged_rmu_2f2632f4_6ced_4eae_8ff8_6c2254697f13%21%2Cged_lv_wire_ca1f9541_7be0_4230_a760_a3b66507fc06%21%2Cged_lv_cable_9b8d0330_64e5_4bbf_bdb5_4927b39b2ef2%21%2Cged_hv_wire_a60bb861_6972_4f27_86a4_21492b59ede2%21%2Cged_hv_cable_54dae74c_08af_44f0_af49_ec3b5fcab581%21%2Cged_ehv_wire_68331f46_1c8f_4f85_99b0_151656c3b0c8%21%2Cged_ehv_cable_04580bfe_0d1c_44f2_bec6_4093984ffa6d%21%2Cged_transformer_a967dbae_dbc2_487f_9fff_14865a65d8d6%21%2Cged_solar_generation_bbeed839_8737_421d_b5bc_277357dcd727%21%2Cged_towers_3c2b9c53_8aa0_4538_b969_731b66b98189%21%2Cged_protective_equipment_fa242976_c97c_4006_aeb1_8c32669f3477%21%2Cged_pole_240bac2f_8d3b_4989_bc0b_b34d9d78e018%21%2Cged_govt_connection__b89e0eff_2812_425e_aa29_4039e1489126%21%2Cged_cabinet_e3e83e28_cff8_4acc_855e_5572b21a8302%21%2Cgbbn_24F_150a4ba3_5e6e_4490_87cd_9a67a51f9a95%21%2Cgbbn_6F_7d67c332_14a0_433b_9036_d3edb7acfe1f%21%2Cgbbn_48F_87fa8495_0a7b_4a37_9154_5d749eb826e6%21%2Cgbbn_vgp_ce657914_2bc0_437a_b558_d614529d0d70%21%2Cgbbn_vgp1_da280706_4a39_4581_98f6_76a4a8258ee2%21%2Cgbbn_olt_afb08f2e_83de_4493_a04a_4eeee53cdabb%21%2Cgwrd_reservoirs_806646ae_e1d3_4b00_9afb_0659fea342cf%21%2Cgwrd_jackwell_casarwali_ad327886_70e4_4b98_bf5e_41da1e9240d0%21%2Cgwrd_pump_house_49ad2817_feb7_4bd4_beaa_2b8908823881%21%2Cgwrd_pumping_sub_station_219578a4_9fba_4c21_bfdf_6793c0e2ec9e%21%2Cgwrd_floodplains_0178162a_bedc_4875_bc74_c2eeba2a040b%21%2Cgwrd_floodembankments_6de30dc4_675b_4ef9_b204_cf2352c1fe9b%21%2Cgpwd_waterline_ffe24b0d_7e83_43e7_8d7f_e5bd2a0d49da%21%2Cgwrd_pipeline_82478411_6595_487b_b524_abb8931946a6%21%2Cgwrd_canal_c36fddaf_564b_43c5_ba74_86e46ca22995%21%2Cgwrd_end_of_pipeline_5518b446_8ff1_4d17_a28f_344dfa3e7901%21%2Cgwrd_tapping_point_401aac7c_77a1_47e2_8470_71a4880294a7%21%2Cgwrd_rain_guages___flood_monitors_ae6547a5_6eca_4932_a1c8_f80c8e04551b%21%2Cgsa_goa_sports_complex_3e450e4c_9a69_4cf7_94ac_2c9082e5388a%21%2Cgie_verna_industrial_estate_81926f17_e182_42a7_9614_0160bf19fa34%21%2Cgie_quittol_industrial_estate_5d5aadba_071c_432d_b424_6c3644c29338%21%2Cgie_latambarcem_industrail_estate_919dd4d4_d8ae_44cc_aff0_bd27fbe1e0a3%21%2Cgcsca_fps_godowns_a3b498e8_fda8_4249_b17b_8c0acbb444d7%21%2Cgcsca_fps_shops_debfb1ee_0fb9_4cfe_95a7_8d9880d22deb%21%2Cgargi_seed_farm_519a1d9c_7a62_4906_a44c_7f7a6d8744b4%21%2Cdfg_ramps_8fb28e3c_4344_409b_9e47_b19c1b8c5fe0%21%2Cdfg_jetty_6a70f09c_fc73_4c48_be61_c35b9f2a7094%21%2Cdfg_fish_landing_centers_b5f571c3_5a64_4ae9_8413_289a912e2f37%21%2Cdfg_aqua_culture_005788c0_d630_42c1_a61f_178234cc61f4%21%2Cdah_cattle_feed_factory_d4f517d5_db91_493c_8b8c_d3cb1062d369%21%2Cdah_egg_production_ff7dac52_5c84_4f17_96eb_2621f7ed01c4%21%2Cdah_veterinary_centres_b9b0b3ac_35e7_4973_a175_f515fbc0efd5%21%2Cdah_sumul_dairy_a0d775d5_8048_4858_869b_3083b34c0bcf%21%2Cdah_production_cattle_244945b5_f092_4644_a585_1601ce097c6c%21%2Cdah_milk_production_70534439_ebaa_4c88_bbb9_f44cae179078%21%2Cdah_milk_processing_unit_8d3ff9f8_387c_4d52_b5a5_ad0ab020fc10%21%2Cdah_farms_e208fb45_f1d4_4489_ae7b_753fc32d4b07%21%2Cgagri_landform_1b36389a_a5c2_4307_8515_beb0e49ceef6%21%2Cdslr_goa_villages_c9939cd5_f3c8_4e94_8125_38adb10e6f45%2Cdaa_asi_sites_9b100a72_f84f_4114_b81f_42f5e46334b1%21%2Ctdc_gurudwara_e1ff2fde_1fbd_41aa_b1af_0f844ebdbee8%21%2Ctdc_mosque_05493477_4f6f_4973_8edc_ae8d6e1dc2ef%21%2Ctdc_church_ca9f3144_cca2_402a_bb7c_85126a42a69b%21%2Ctdc_temple_33d6e141_2ae9_4a43_909a_f252ef6f27d6%21%2Cgfd_range_ac0c898d_b912_43e5_8641_cc8d558b96c2%21%2Cgfd_wls_29b8d326_2d60_4bde_b743_6a239516c86c%21%2Cgfd_eco_sensitive_zone_451208a2_46f8_45aa_ba54_a5e5278aa824%21%2Cdhs_institute_63eb16bc_7d5c_4804_b7c3_99b9481eae1d%21%2Cdhs_hospital_c90b25e4_f64d_49f5_8696_410dfe8b18bd%21%2Cdhs_uhc_882ec1f1_633e_4411_b223_c0fe874575b2%21%2Cdhs_phc_771cb209_c40a_4786_ab15_122f5b8caf7f%21%2Cdhs_chc_43f53098_e034_404f_a7c4_bbc949038e5a%21%2Cdhs_ayurvedic___homeopathic_dispensaries_339b4c62_c1a7_4b6b_b8c6_272ec8a7e46a%21%2Cdhs_hsc_0e3ffe3f_21f5_4201_8596_d6b37a1d8f10%21%2Cdot_bus_stop_9a5e21ba_b562_45bc_a372_dfe71301af16%21%2Cgkr_railway_line_943f6fe0_5c1d_461e_bf1f_e914b2991191%21%2Cdot_rto_checkpost__af7f50e9_7412_4658_a40a_5d88d303d3ab%21%2Cdot_traffic_signal_b29280ac_53eb_4207_b713_5d965dd36f5c%21%2Cdot_depot_c46b1f5c_d838_4bab_bac3_6f9eb54bd7e5%21%2Cgkr_railway_station_eeffd0d6_ac46_4f69_a6b3_952cf2687ea2%21%2Cktc_bus_stops_1272f729_fbe6_49fb_9873_5d2d6fb2f99d%21%2Cgdte_schools_a53455c4_c969_4bc6_af70_e0403df19623%21%2Cdtw_ashram_school_8e3e826e_8cc5_4ebb_b7b6_e159a591143d%21%2Cgdte_iti_college_5c51844a_d03d_4745_9a27_dfc44351d160%21%2Cgdte_government_institute_976db146_84af_4c70_80cf_625726d858bf%21%2Cgdte_college_26d0511b_5a9d_4c94_983a_4d99d24ee293%21%2Cgoa_villages_f7a04d50_013c_4d33_b3f0_45e1cd5ed8fc%2Cgoa_taluka_boundary_9e52e7ed_a0ef_4390_b5dc_64ab281214f5%2Cgoa_district_boundary_81d4650d_4cdd_42c3_bd42_03a4a958b5dd%2Cgoa_boundary_ae71ccc6_6c5c_423a_b4fb_42f925d7ddc0';
        

        const navigationLinks = [
            {
                name: 'OSM',
                url: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}&layers=D`,
                icon: 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Openstreetmap_logo.svg'
            },
            {
                name: 'Google Maps',
                url: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
                icon: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Google_Maps_icon_%282020%29.svg'
            },
            {
                name: 'Bhuvan',
                url: `https://bhuvanmaps.nrsc.gov.in/?mode=Hybrid#${zoom}/${lat}/${lng}`,
                icon: './assets/icon-bhuvan.png'
            },
            {
                name: 'Bharatmaps',
                url: `https://bharatmaps.gov.in/BharatMaps/Home/Map?long=${lat}&lat=${lng}`,
                text: 'BM'
            },
            {
                name: 'One Map Goa',
                url: `https://onemapgoagis.goa.gov.in/map/?ct=LayerTree${oneMapGoaLayerList}&bl=mmi_hybrid&t=goa_default&c=${mercatorCoords.x}%2C${mercatorCoords.y}&s=500`,
                icon: './assets/icon-onemapgoa.png'
            },
            {
                name: 'Landcover',
                url: `https://livingatlas.arcgis.com/landcoverexplorer/#mapCenter=${lng}%2C${lat}%2C${zoom}.79&mode=step&timeExtent=2017%2C2023&year=2023`,
                text: 'LC'
            },
            {
                name: 'Timelapse',
                url: `https://earthengine.google.com/timelapse#v=${lat},${lng},15,latLng&t=0.41&ps=50&bt=19840101&et=20221231`,
                text: 'TL'
            },
            {
                name: 'Copernicus Browser',
                url: `https://browser.dataspace.copernicus.eu/?zoom=${zoom}&lat=${lat}&lng=${lng}&themeId=DEFAULT-THEME&visualizationUrl=U2FsdGVkX18d3QCo8ly51mKnde%2FbnPTNY3M%2Bvkw2HJS5PZYTtLYG6ZjWVDYuz%2Bszj9bzKcR5Th1mcWjsfJneWz3DM1gd75vRaH%2BioFw2j3mQa79Yj8F7TkWwvb2ow0kh&datasetId=3c662330-108b-4378-8899-525fd5a225cb&fromTime=2024-12-01T00%3A00%3A00.000Z&toTime=2024-12-01T23%3A59%3A59.999Z&layerId=0-RGB-RATIO&demSource3D=%22MAPZEN%22&cloudCoverage=30&dateMode=SINGLE`,
                text: 'CB'
            },
            {
                name: 'Global Forest Watch',
                url: `https://www.globalforestwatch.org/map/?map=${encodeURIComponent(JSON.stringify({
                    center: {
                        lat: lat,
                        lng: lng
                    },
                    zoom: zoom,
                    basemap: {
                        value: "satellite",
                        color: "",
                        name: "planet_medres_visual_2025-02_mosaic",
                        imageType: "analytic"
                    },
                    datasets: [
                        {
                            dataset: "political-boundaries",
                            layers: ["disputed-political-boundaries", "political-boundaries"],
                            boundary: true,
                            opacity: 1,
                            visibility: true
                        },
                        {
                            dataset: "DIST_alerts",
                            opacity: 1,
                            visibility: true,
                            layers: ["DIST_alerts_all"]
                        },
                        {
                            dataset: "tree-cover-loss",
                            layers: ["tree-cover-loss"],
                            opacity: 1,
                            visibility: true,
                            timelineParams: {
                                startDate: "2002-01-01",
                                endDate: "2023-12-31",
                                trimEndDate: "2023-12-31"
                            },
                            params: {
                                threshold: 30,
                                visibility: true,
                                adm_level: "adm0"
                            }
                        },
                        {
                            opacity: 0.7,
                            visibility: true,
                            dataset: "primary-forests",
                            layers: ["primary-forests-2001"]
                        },
                        {
                            dataset: "umd-tree-height",
                            opacity: 0.58,
                            visibility: true,
                            layers: ["umd-tree-height-2020"]
                        }
                    ]
                }))}&mapMenu=${encodeURIComponent(JSON.stringify({
                    datasetCategory: "landCover"
                }))}`,
                text: 'FW'
            }
        ];

        let linksHTML = navigationLinks.map(link =>
            `<a href="${link.url}" target="_blank" class="flex items-center gap-1 hover:text-gray-900" title="${link.name}">
                ${link.icon ? `<img src="${link.icon}" class="w-5 h-5 !max-w-none" alt="${link.name}">` : ''}
                ${link.text ? `<span class="text-xs text-gray-600">${link.text}</span>` : ''}
            </a>`
        ).join('');
        linksHTML = `<div class="text-xs text-gray-600 pt-3 mt-3 border-t border-gray-200 flex flex-wrap gap-3">${linksHTML}</div>`;
        content.innerHTML += linksHTML;

        if (this._map.getZoom() >= 14) {
            const $exportContainer = $('<div>', {
                class: 'text-xs text-gray-600 pt-3 mt-3 border-t border-gray-200 flex gap-3'
            });
            
            const $exportButton = $('<button>', {
                class: 'flex items-center gap-1 hover:text-gray-900 cursor-pointer',
                html: `
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>Export KML</span>
                `
            });
            
            $exportButton.on('click', () => {
                try {
                    const fieldValues = group.inspect?.fields
                        ? group.inspect.fields
                            .map(field => feature.properties[field])
                            .filter(value => value)
                            .join('_')
                        : '';
                    const groupTitle = feature.properties[group.inspect?.label] || 'Exported';
                    const title = fieldValues 
                        ? `${fieldValues}_${groupTitle}` 
                        : feature.properties[group.inspect?.label] || 'Exported_Feature';
                    const description = group.inspect?.title || 'Exported from Amche Goa';
                    
                    const kmlContent = convertToKML(feature, {title, description});
                    
                    const blob = new Blob([kmlContent], {type: 'application/vnd.google-earth.kml+xml'});
                    const url = URL.createObjectURL(blob);
                    
                    const $downloadLink = $('<a>', {
                        href: url,
                        download: `${title}.kml`
                    });
                    
                    $('body').append($downloadLink);
                    $downloadLink[0].click();
                    $downloadLink.remove();
                    URL.revokeObjectURL(url);
                    
                } catch (error) {
                    console.error('Error exporting KML:', error);
                    alert('Error exporting KML. Please check the console for details.');
                }
            });
            
            $exportContainer.append($exportButton);
            $(content).append($exportContainer);
        }

        return content;
    }

    _getInsertPosition(type, layerType = null) {
        const layers = this._map.getStyle().layers;
        
        // Get the layer groups in their defined order
        const orderedGroups = this._options.groups;
        
        // Find current layer's index in the configuration
        const currentGroupIndex = orderedGroups.findIndex(group => 
            group.id === this._currentGroup?.id
        );

        // Get the order value for the current layer type
        const currentTypeOrder = this._layerTypeOrder[layerType || type] || Infinity;

        // Find the next layer that should be above this one
        let insertBeforeId;
        for (let i = currentGroupIndex - 1; i >= 0; i--) {
            const group = orderedGroups[i];
            if (group.type === type || 
                (type === 'vector' && ['vector', 'geojson'].includes(group.type)) ||
                (type === 'geojson' && ['vector', 'geojson'].includes(group.type))) {
                
                // Find all matching layers for this group
                const matchingLayers = layers.filter(layer => {
                    const groupId = group.id;
                    return layer.id === groupId || 
                           layer.id === `vector-layer-${groupId}` ||
                           layer.id === `vector-layer-${groupId}-outline` ||
                           layer.id === `geojson-${groupId}-fill` ||
                           layer.id === `geojson-${groupId}-line` ||
                           layer.id === `tms-layer-${groupId}`;
                });
                
                // Sort matching layers by type order
                matchingLayers.sort((a, b) => {
                    const aOrder = this._layerTypeOrder[a.type] || Infinity;
                    const bOrder = this._layerTypeOrder[b.type] || Infinity;
                    return bOrder - aOrder; // Reverse sort to get highest order first
                });

                // Find the first layer with a higher or equal type order
                const insertLayer = matchingLayers.find(layer => {
                    const layerTypeOrder = this._layerTypeOrder[layer.type] || Infinity;
                    return layerTypeOrder >= currentTypeOrder;
                });
                
                if (insertLayer) {
                    insertBeforeId = insertLayer.id;
                    break;
                }
            }
        }

        // Special handling for raster/tms layers to ensure they're above satellite
        if (type === 'tms' || type === 'raster') {
            const baseLayerIndex = layers.findIndex(layer =>
                layer.type === 'raster' && layer.id.includes('satellite')
            );
            
            if (baseLayerIndex !== -1) {
                const nextLayerId = layers[baseLayerIndex + 1]?.id;
                if (nextLayerId && (!insertBeforeId || layers.findIndex(l => l.id === insertBeforeId) < baseLayerIndex)) {
                    insertBeforeId = nextLayerId;
                }
            }
        }

        return insertBeforeId;
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
    }

    _setupLayerInteractivity(group, layerIds, sourceId) {
        if (!group.inspect) return;

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

        // Helper function to create feature state params based on layer type
        const getFeatureStateParams = (id) => {
            const params = { source: sourceId, id };
            if (group.type === 'vector') {
                params.sourceLayer = group.sourceLayer;
            }
            return params;
        };

        layerIds.forEach(layerId => {
            // Mousemove handler
            this._map.on('mousemove', layerId, (e) => {
                if (e.features.length > 0) {
                    const feature = e.features[0];
                    
                    if (hoveredFeatureId !== null) {
                        this._map.setFeatureState(
                            getFeatureStateParams(hoveredFeatureId),
                            { hover: false }
                        );
                    }

                    if (feature.id !== undefined) {
                        hoveredFeatureId = feature.id;
                        this._map.setFeatureState(
                            getFeatureStateParams(hoveredFeatureId),
                            { hover: true }
                        );
                    }

                    // Show hover popup if configured
                    if (group.inspect?.label) {
                        const content = this._createPopupContent(feature, group, true);
                        if (content) {
                            hoverPopup
                                .setLngLat(e.lngLat)
                                .setDOMContent(content)
                                .addTo(this._map);
                        }
                    }
                }
            });

            // Mouseleave handler
            this._map.on('mouseleave', layerId, () => {
                if (hoveredFeatureId !== null) {
                    this._map.setFeatureState(
                        getFeatureStateParams(hoveredFeatureId),
                        { hover: false }
                    );
                    hoveredFeatureId = null;
                }
                hoverPopup.remove();
            });

            // Click handler
            this._map.on('click', layerId, (e) => {
                if (e.features.length > 0) {
                    const feature = e.features[0];
                    
                    // Remove hover popup
                    hoverPopup.remove();

                    // Clear previous selection
                    if (selectedFeatureId !== null) {
                        this._map.setFeatureState(
                            getFeatureStateParams(selectedFeatureId),
                            { selected: false }
                        );
                    }

                    // Set new selection
                    if (feature.id !== undefined) {
                        selectedFeatureId = feature.id;
                        this._map.setFeatureState(
                            getFeatureStateParams(selectedFeatureId),
                            { selected: true }
                        );
                    }

                    const content = this._createPopupContent(feature, group, false, e.lngLat);
                    if (content) {
                        popup
                            .setLngLat(e.lngLat)
                            .setDOMContent(content)
                            .addTo(this._map);
                    }
                }
            });

            // Add pointer cursor
            this._map.on('mouseenter', layerId, () => {
                this._map.getCanvas().style.cursor = 'pointer';
            });

            this._map.on('mouseleave', layerId, () => {
                this._map.getCanvas().style.cursor = '';
            });
        });
    }

    // When rendering legend images, we need to check if it's a PDF and handle it differently
    _renderLegendImage(legendImageUrl) {
        if (!legendImageUrl) return '';
        
        // Check if the file is a PDF
        if (legendImageUrl.toLowerCase().endsWith('.pdf')) {
            return `
                <div class="legend-pdf-container">
                    <a href="${legendImageUrl}" target="_blank" class="pdf-legend-link">
                        <sl-icon name="file-earmark-pdf" style="color: red; font-size: 1.5rem;"></sl-icon>
                        <span>View Legend PDF</span>
                    </a>
                </div>
            `;
        } else {
            // Handle regular image files as before
            return `<img src="${legendImageUrl}" alt="Legend" class="legend-image">`;
        }
    }

    _initializeSettingsModal() {
        if (!document.getElementById('layer-settings-modal')) {
            const modalHTML = `
                <sl-dialog id="layer-settings-modal" label="Layer Settings" class="layer-settings-dialog">
                    <div class="layer-settings-content">
                        <div class="settings-header"></div>
                        <div class="settings-body grid grid-cols-3 gap-4">
                            <div class="col-1">
                                <div class="description mb-4"></div>
                                <div class="attribution mb-4"></div>
                                <div class="legend mb-4"></div>
                            </div>
                            <div class="col-2">
                                <div class="data-source mb-4">
                                    <h3 class="text-sm font-bold mb-2">Data Source</h3>
                                    <div class="source-details"></div>
                                </div>
                                <div class="style-section mb-4">
                                    <h3 class="text-sm font-bold mb-2">Style</h3>
                                    <div class="style-editor"></div>
                                </div>
                            </div>
                            <div class="col-3">
                                <div class="inspect-section mb-4">
                                    <h3 class="text-sm font-bold mb-2">Inspect</h3>
                                    <div class="inspect-editor"></div>
                                </div>
                                <div class="advanced-section">
                                    <h3 class="text-sm font-bold mb-2">Advanced</h3>
                                    <div class="config-editor"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div slot="footer" class="flex justify-end gap-2">
                        <sl-button variant="default" class="cancel-button">Cancel</sl-button>
                        <sl-button variant="primary" class="save-button">Save Changes</sl-button>
                    </div>
                </sl-dialog>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);

            // Add event listeners
            const modal = document.getElementById('layer-settings-modal');
            modal.querySelector('.cancel-button').addEventListener('click', () => modal.hide());
            modal.querySelector('.save-button').addEventListener('click', () => this._saveLayerSettings());
        }
    }

    _showLayerSettings(group) {
        const modal = document.getElementById('layer-settings-modal');
        const content = modal.querySelector('.layer-settings-content');
        
        // Update modal title
        modal.label = `Layer Settings: ${group.title}`;
        
        // Set header background if exists
        if (group.headerImage) {
            content.querySelector('.settings-header').style.backgroundImage = `url('${group.headerImage}')`;
            content.querySelector('.settings-header').style.height = '100px';
            content.querySelector('.settings-header').style.backgroundSize = 'cover';
            content.querySelector('.settings-header').style.backgroundPosition = 'center';
            content.querySelector('.settings-header').style.marginBottom = '1rem';
        }

        // Update description
        if (group.description) {
            content.querySelector('.description').innerHTML = `
                <h3 class="text-sm font-bold mb-2">Description</h3>
                <div class="text-sm">${group.description}</div>
            `;
        }

        // Update attribution
        if (group.attribution) {
            content.querySelector('.attribution').innerHTML = `
                <h3 class="text-sm font-bold mb-2">Attribution</h3>
                <div class="text-sm">${group.attribution}</div>
            `;
        }

        // Update legend
        if (group.legendImage) {
            content.querySelector('.legend').innerHTML = `
                <h3 class="text-sm font-bold mb-2">Legend</h3>
                <img src="${group.legendImage}" alt="Legend" style="max-width: 100%">
            `;
        }

        // Update data source section
        const sourceDetails = content.querySelector('.source-details');
        sourceDetails.innerHTML = '';
        
        if (group.type === 'tms' || group.type === 'vector' || group.type === 'geojson') {
            sourceDetails.innerHTML = `
                <div class="mb-2">
                    <div class="text-xs text-gray-600">Format</div>
                    <div class="font-mono text-sm">${group.type.toUpperCase()}</div>
                </div>
                <div class="mb-2">
                    <div class="text-xs text-gray-600">URL</div>
                    <div class="font-mono text-sm break-all">${group.url}</div>
                </div>
            `;

            if (group.type === 'vector') {
                sourceDetails.innerHTML += `
                    <div class="mb-2">
                        <div class="text-xs text-gray-600">Source Layer</div>
                        <div class="font-mono text-sm">${group.sourceLayer || ''}</div>
                    </div>
                    <div>
                        <div class="text-xs text-gray-600">Max Zoom</div>
                        <div class="font-mono text-sm">${group.maxzoom || 'Not set'}</div>
                    </div>
                `;
            }
        }

        // Update style section
        const styleEditor = content.querySelector('.style-editor');
        if (group.style) {
            styleEditor.innerHTML = `
                <sl-textarea
                    rows="10"
                    class="style-json"
                    label="Style JSON"
                    value='${JSON.stringify(group.style, null, 2)}'
                ></sl-textarea>
            `;
        }

        // Update inspect section
        const inspectEditor = content.querySelector('.inspect-editor');
        if (group.inspect) {
            inspectEditor.innerHTML = `
                <sl-textarea
                    rows="10"
                    class="inspect-json"
                    label="Inspect Configuration"
                    value='${JSON.stringify(group.inspect, null, 2)}'
                ></sl-textarea>
            `;
        }

        // Update advanced section
        const configEditor = content.querySelector('.config-editor');
        configEditor.innerHTML = `
            <sl-textarea
                rows="15"
                class="config-json"
                label="Layer Configuration"
                value='${JSON.stringify(group, null, 2)}'
            ></sl-textarea>
        `;

        modal.show();
    }

    _saveLayerSettings() {
        // Implement save functionality here
        const modal = document.getElementById('layer-settings-modal');
        modal.hide();
    }

    _createLayerControls($groupHeader, group, groupIndex) {
        // ... existing code for creating layer controls ...

        // Add settings button next to opacity button
        const $settingsButton = $('<sl-icon-button>', {
            name: 'gear-fill',
            class: 'settings-button ml-2',
            label: 'Layer Settings'
        });

        $settingsButton.on('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._showLayerSettings(group);
        });

        // Add settings button to content wrapper after opacity button
        $contentWrapper.append($settingsButton);

        // ... rest of the existing code ...
    }
}

window.MapLayerControl = MapLayerControl; 