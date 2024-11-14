class LayerControl {
    constructor(options) {
        this.config = {
            title: options.title || 'Toggle Layers',
            groupTitle: options.groupTitle || 'Layers',
            layers: options.layers.map(layer => ({
                id: layer.id,
                label: layer.label || layer.id,
                sourceUrl: layer.sourceUrl
            }))
        };
        LayerControl.instances = (LayerControl.instances || 0) + 1;
        this.instanceNumber = LayerControl.instances;
    }

    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl opacity-control';
        
        // Create main toggle button
        const toggleButton = document.createElement('button');
        toggleButton.textContent = this.config.title;
        
        // Create source selection div
        const sourceDiv = document.createElement('div');
        sourceDiv.className = 'source-control';
        sourceDiv.classList.add('collapsed');
        
        // Generate radio buttons and source links HTML
        const radioHTML = this.config.layers.map((layer, index) => `
            <div class="layer-control-item">
                <label class="radio-label">
                    <input type="radio" name="layerSource" value="${layer.id}" ${index === 0 ? 'checked' : ''}>
                    ${layer.label}
                </label>
                ${layer.sourceUrl ? `
                <div class="source-link ${index === 0 ? '' : 'hidden'}" data-for="${layer.id}">
                    <a href="${layer.sourceUrl}" target="_blank" class="text-xs text-blue-600 hover:underline">
                        View Source
                    </a>
                </div>
                ` : ''}
            </div>
        `).join('');

        sourceDiv.innerHTML = `
            <div class="title">${this.config.groupTitle}</div>
            <div class="radio-group">
                ${radioHTML}
            </div>
        `;
        
        // Set initial state - ensure first layer and its source link are visible
        let isVisible = true;
        this.config.layers.forEach((layer, index) => {
            map.setLayoutProperty(layer.id, 'visibility', index === 0 ? 'visible' : 'none');
        });
        
        // Handle button click
        toggleButton.addEventListener('click', () => {
            isVisible = !isVisible;
            
            if (!isVisible) {
                this.config.layers.forEach(layer => {
                    map.setLayoutProperty(layer.id, 'visibility', 'none');
                });
                sourceDiv.classList.add('collapsed');
            } else {
                sourceDiv.classList.remove('collapsed');
                
                if (this.config.layers.length > 1) {
                    // Ensure first radio button is selected
                    const firstRadio = sourceDiv.querySelector('input[name="layerSource"]');
                    if (firstRadio) {
                        firstRadio.checked = true;
                    }
                    
                    // Show first layer
                    this.config.layers.forEach((layer, index) => {
                        map.setLayoutProperty(layer.id, 'visibility', index === 0 ? 'visible' : 'none');
                    });
                    
                    // Show first source link
                    sourceDiv.querySelectorAll('.source-link').forEach((link, index) => {
                        if (index === 0) {
                            link.classList.remove('hidden');
                        } else {
                            link.classList.add('hidden');
                        }
                    });
                } else {
                    map.setLayoutProperty(this.config.layers[0].id, 'visibility', 'visible');
                }
            }
        });
        
        // Handle radio button changes
        if (this.config.layers.length > 1) {
            sourceDiv.querySelectorAll('input[name="layerSource"]').forEach(radio => {
                radio.addEventListener('change', (e) => {
                    if (isVisible) {
                        // Update layer visibility
                        this.config.layers.forEach(layer => {
                            map.setLayoutProperty(layer.id, 'visibility', layer.id === e.target.value ? 'visible' : 'none');
                        });
                        
                        // Update source link visibility
                        sourceDiv.querySelectorAll('.source-link').forEach(link => {
                            link.classList.add('hidden');
                            if (link.dataset.for === e.target.value) {
                                link.classList.remove('hidden');
                            }
                        });
                    }
                });
            });
        }
        
        this._container.appendChild(toggleButton);
        this._container.appendChild(sourceDiv);
        this._container.classList.add(`control-${this.instanceNumber}`);
        
        if (this.instanceNumber === 2) {
            const firstControl = document.querySelector('.control-1');
            if (firstControl) {
                firstControl.style.marginBottom = '0';
            }
        }
        
        return this._container;
    }
    
    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}

// Export the class
window.LayerControl = LayerControl; 