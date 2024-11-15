class MapLayerControl {
    constructor(options) {
        this._options = {
            autoCollapse: true,  // Default behavior
            collapseDelay: 2000, // Default delay in milliseconds
            groups: Array.isArray(options) ? options : [options] // Convert single group to array
        };
        MapLayerControl.instances = (MapLayerControl.instances || 0) + 1;
        this._instanceId = MapLayerControl.instances;
        
        // Add timer property to track collapse timeouts
        this._collapseTimers = {};
        
        // Add new properties for animation
        this._initialized = false;
        this._animationTimeouts = [];
    }

    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl opacity-control';
        this._sourceControls = [];

        // Wait for map style to be loaded before initializing
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
        // Initialize all layers to hidden when control is added
        this._initializeLayers();

        // Create controls for each group
        this._options.groups.forEach((group, groupIndex) => {
            const groupContainer = document.createElement('div');
            groupContainer.className = 'layer-group';

            // Create group header with checkbox
            const groupHeader = document.createElement('div');
            groupHeader.className = 'group-header';
            
            // Add background image if specified
            if (group.headerImage) {
                groupHeader.style.backgroundImage = `url(${group.headerImage})`;
                groupHeader.style.backgroundSize = 'cover';
                groupHeader.style.backgroundPosition = 'center';
                // Add a dark overlay for better text visibility
                groupHeader.style.position = 'relative';
                const overlay = document.createElement('div');
                overlay.className = 'header-overlay';
                groupHeader.appendChild(overlay);
            }

            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = false;
            
            const titleSpan = document.createElement('span');
            titleSpan.textContent = group.title;
            // Make text white if there's a background image
            if (group.headerImage) {
                titleSpan.style.color = 'white';
                titleSpan.style.position = 'relative';
                titleSpan.style.zIndex = '1';
            }

            label.appendChild(checkbox);
            label.appendChild(titleSpan);
            groupHeader.appendChild(label);
            groupContainer.appendChild(groupHeader);

            // Create the source control section
            const sourceControl = document.createElement('div');
            sourceControl.className = 'source-control collapsed';
            this._sourceControls[groupIndex] = sourceControl;

            // Add group title if provided
            if (group.groupTitle) {
                const title = document.createElement('div');
                title.className = 'title';
                title.textContent = group.groupTitle;
                sourceControl.appendChild(title);
            }

            // Create radio group
            const radioGroup = document.createElement('div');
            radioGroup.className = 'radio-group';

            // Create radio buttons for each layer
            group.layers.forEach((layer, index) => {
                const label = document.createElement('label');
                label.className = 'radio-label';

                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = `layer-group-${this._instanceId}-${groupIndex}`;
                radio.value = layer.id;
                radio.checked = index === 0;

                radio.onchange = () => this._handleLayerChange(layer.id, group.layers);

                const span = document.createElement('span');
                span.textContent = layer.label;

                label.appendChild(radio);
                label.appendChild(span);
                radioGroup.appendChild(label);
            });

            sourceControl.appendChild(radioGroup);
            groupContainer.appendChild(sourceControl);
            this._container.appendChild(groupContainer);

            // Update checkbox click handler
            checkbox.onchange = () => {
                this._toggleSourceControl(groupIndex, checkbox.checked);
                
                // Set up auto-collapse if enabled
                if (checkbox.checked && group.autoCollapse) {
                    // Clear any existing timer for this group
                    if (this._collapseTimers[groupIndex]) {
                        clearTimeout(this._collapseTimers[groupIndex]);
                    }
                    
                    // Set new timer
                    this._collapseTimers[groupIndex] = setTimeout(() => {
                        checkbox.checked = false;
                        this._toggleSourceControl(groupIndex, false);
                    }, group.collapseDelay || 2000);
                } else if (!checkbox.checked) {
                    // Clear timer if unchecked
                    if (this._collapseTimers[groupIndex]) {
                        clearTimeout(this._collapseTimers[groupIndex]);
                    }
                }
            };
        });

        // Add initialization animation if not already done
        if (!this._initialized) {
            this._initializeWithAnimation();
        }
    }

    _initializeLayers() {
        // Hide all layers initially
        this._options.groups.forEach(group => {
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
            // Remove collapsed class immediately when opening
            sourceControl.classList.remove('collapsed');
            
            // Show the first layer when checked
            if (group.layers.length > 0) {
                const firstLayer = group.layers[0];
                if (this._map.getLayer(firstLayer.id)) {
                    this._map.setLayoutProperty(
                        firstLayer.id,
                        'visibility',
                        'visible'
                    );
                    
                    // Check the first radio button
                    const firstRadio = sourceControl.querySelector(`input[value="${firstLayer.id}"]`);
                    if (firstRadio) {
                        firstRadio.checked = true;
                        this._handleLayerChange(firstLayer.id, group.layers);
                    }
                }
            }
        } else {
            // Add collapsed class and wait for transition
            sourceControl.classList.add('collapsed');
            
            // Hide all layers when unchecked
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

    _handleLayerChange(selectedLayerId, layers) {
        layers.forEach(layer => {
            if (this._map.getLayer(layer.id)) {
                const isVisible = layer.id === selectedLayerId;
                this._map.setLayoutProperty(
                    layer.id,
                    'visibility',
                    isVisible ? 'visible' : 'none'
                );

                // Find and update the layer info div
                const radioInput = this._container.querySelector(`input[value="${layer.id}"]`);
                if (radioInput) {
                    const label = radioInput.closest('.radio-label');
                    
                    // Remove any existing info div
                    const existingInfo = label.nextElementSibling;
                    if (existingInfo && existingInfo.classList.contains('layer-info')) {
                        existingInfo.remove();
                    }

                    // Add new info div if layer is selected
                    if (isVisible) {
                        const infoDiv = document.createElement('div');
                        infoDiv.className = 'layer-info text-xs pl-5 text-gray-600';
                        
                        let links = [];
                        
                        // Add Source link if sourceUrl exists
                        if (layer.sourceUrl) {
                            links.push(`<a href="${layer.sourceUrl}" target="_blank" class="hover:underline">Source</a>`);
                        }
                        
                        // Add View link if location is specified
                        if (layer.location) {
                            links.push(`<a href="#" class="hover:underline view-link" data-location="${layer.location}">View</a>`);
                        }

                        infoDiv.innerHTML = links.join(' | ');
                        
                        // Add click handler for View link
                        infoDiv.querySelector('.view-link')?.addEventListener('click', (e) => {
                            e.preventDefault();
                            this._flyToLocation(layer.location);
                        });

                        label.parentNode.insertBefore(infoDiv, label.nextSibling);
                    }
                }
            }
        });
    }

    async _flyToLocation(location) {
        try {
            // Use Mapbox Geocoding API to get coordinates
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
        
        // Show layers first
        checkboxes.forEach((checkbox) => {
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));
        });

        // Hide layers after a delay
        this._animationTimeouts.push(setTimeout(() => {
            checkboxes.forEach((checkbox) => {
                checkbox.checked = false;
                checkbox.dispatchEvent(new Event('change'));
            });
        }, 1500));

        this._initialized = true;
    }

    onRemove() {
        // Clear all animation timeouts when control is removed
        this._animationTimeouts.forEach(timeout => clearTimeout(timeout));
        this._animationTimeouts = [];
        
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}

// Export the class
window.MapLayerControl = MapLayerControl; 