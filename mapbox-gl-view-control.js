class ViewControl {
    constructor(options = {}) {
        this.options = {
            initialView: {
                center: [73.8274, 15.4406],
                zoom: 9,
                pitch: 28,
                bearing: 0
            },
            iconUrl: 'assets/goa-icon.svg',
            ...options
        };
    }

    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
        
        const button = document.createElement('button');
        button.className = 'mapboxgl-ctrl-icon';
        button.type = 'button';
        button.setAttribute('aria-label', 'Reset map view');
        
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.width = '30px';
        button.style.height = '30px';
        
        const img = document.createElement('img');
        img.src = this.options.iconUrl;
        img.width = 20;
        img.height = 20;
        img.style.display = 'block';
        button.appendChild(img);

        button.addEventListener('click', () => {
            this._map.flyTo({
                ...this.options.initialView,
                duration: 4000,
                essential: true,
                curve: 1.42,
                speed: 0.6
            });
        });

        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = '#f0f0f0';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = '#ffffff';
        });

        this._container.appendChild(button);
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
} 