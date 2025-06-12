import { fetchTileJSON } from './map-utils.js';

// Create and inject the dialog HTML only once
function createLayerCreatorDialog() {
    if (document.getElementById('layer-creator-dialog')) return;
    const dialogHtml = `
    <sl-dialog id="layer-creator-dialog" label="Add new data source or atlas">
        <form id="layer-creator-form" class="flex flex-col gap-4">
            <sl-input id="layer-url" placeholder="URL to map data or atlas configuration JSON" required>
                <sl-icon slot="prefix" name="link"></sl-icon>
            </sl-input>
            <div id="layer-url-help" class="text-xs text-gray-500">
                Supported: Raster/Vector tile URLs, GeoJSON, Atlas JSON.<br>
                Examples:<br>
                <span class="block">Raster: <code>https://warper.wmflabs.org/maps/tile/4749/{z}/{x}/{y}.png</code></span>
                <span class="block">Vector: <code>https://vector.openstreetmap.org/shortbread_v1/{z}/{x}/{y}.mvt</code></span>
                <span class="block">GeoJSON: <code>https://gist.githubusercontent.com/planemad/e5ccc47bf2a1aa458a86d6839476f539/raw/6922fcc2d5ffd4d58b0fb069b9f57334f13cd953/goa-water-bodies.geojson</code></span>
                <span class="block">Atlas: <code>https://jsonkeeper.com/b/RQ0Y</code></span>
            </div>
            <sl-textarea id="layer-config-json" rows="10" resize="vertical" class="font-mono text-xs" label="Layer Config JSON"></sl-textarea>
            <div class="flex justify-end gap-2">
                <sl-button type="button" variant="default" id="cancel-layer-creator">Cancel</sl-button>
                <sl-button type="submit" variant="primary" id="submit-layer-creator">Add to map</sl-button>
            </div>
        </form>
    </sl-dialog>
    `;
    $(document.body).append(dialogHtml);
}

function guessLayerType(url) {
    if (/\.geojson($|\?)/i.test(url)) return 'geojson';
    if (url.includes('{z}') && url.includes('.pbf')) return 'vector';
    if (url.includes('{z}') && (url.includes('.mvt') || url.includes('vector.openstreetmap.org'))) return 'vector';
    if (url.includes('{z}') && (url.includes('.png') || url.includes('.jpg'))) return 'raster';
    if (/\.json($|\?)/i.test(url)) return 'atlas';
    return 'unknown';
}

function makeLayerConfig(url, tilejson) {
    const type = guessLayerType(url);
    let config = {};
    if (type === 'vector' && tilejson) {
        config = {
            title: tilejson.name || tilejson.description || 'Untitled Vector Layer',
            description: tilejson.description || '',
            type: 'vector',
            id: (tilejson.name || 'vector-layer').toLowerCase().replace(/\s+/g, '-'),
            url: (tilejson.tiles && tilejson.tiles[0]) || url,
            minzoom: tilejson.minzoom,
            maxzoom: tilejson.maxzoom,
            attribution: tilejson.attribution || '',
            initiallyChecked: false
        };
    } else if (type === 'raster') {
        config = {
            title: 'Raster Layer',
            type: 'tms',
            id: 'raster-' + Math.random().toString(36).slice(2, 8),
            url,
            style: {
                'raster-opacity': [
                    'interpolate', ['linear'], ['zoom'], 6, 0.95, 18, 0.8, 19, 0.3
                ]
            },
            initiallyChecked: false
        };
    } else if (type === 'geojson') {
        config = {
            title: 'GeoJSON Layer',
            type: 'geojson',
            id: 'geojson-' + Math.random().toString(36).slice(2, 8),
            url,
            initiallyChecked: false
        };
    } else if (type === 'atlas') {
        config = {
            type: 'atlas',
            url
        };
    } else {
        config = { url };
    }
    return config;
}

async function handleUrlInput(url) {
    const type = guessLayerType(url);
    let config = {};
    if (type === 'vector') {
        // Try to fetch TileJSON
        const tilejson = await fetchTileJSON(url);
        config = makeLayerConfig(url, tilejson);
    } else {
        config = makeLayerConfig(url);
    }
    return config;
}

function getShareableUrl() {
    // Try to get the ShareLink instance from the share button container
    const shareBtn = document.getElementById('share-link');
    if (window.shareLinkInstance && typeof window.shareLinkInstance.getCurrentURL === 'function') {
        return window.shareLinkInstance.getCurrentURL();
    }
    // fallback: try to get from the share button's data-url attribute if set
    if (shareBtn && shareBtn.dataset && shareBtn.dataset.url) {
        return shareBtn.dataset.url;
    }
    // fallback: use window.location.href
    return window.location.href;
}

function openLayerCreatorDialog() {
    createLayerCreatorDialog();
    const dialog = document.getElementById('layer-creator-dialog');
    const urlInput = document.getElementById('layer-url');
    const configTextarea = document.getElementById('layer-config-json');
    const form = document.getElementById('layer-creator-form');
    const cancelBtn = document.getElementById('cancel-layer-creator');
    configTextarea.value = '';
    urlInput.value = '';
    dialog.show();
    let lastUrl = '';
    let lastConfig = '';
    // Remove previous listeners to avoid duplicates
    urlInput.oninput = null;
    form.onsubmit = null;
    urlInput.addEventListener('input', async (e) => {
        const url = e.target.value.trim();
        if (!url || url === lastUrl) return;
        lastUrl = url;
        configTextarea.value = 'Loading...';
        const config = await handleUrlInput(url);
        lastConfig = JSON.stringify(config, null, 2);
        configTextarea.value = lastConfig;
    });
    cancelBtn.onclick = () => dialog.hide();
    form.onsubmit = (e) => {
        e.preventDefault();
        let configJson = configTextarea.value.trim();
        if (!configJson) return;
        try {
            const configObj = JSON.parse(configJson);
            // Use the current shareable URL as base
            let baseUrl = getShareableUrl();
            let url = new URL(baseUrl);
            // Preserve hash
            const hash = url.hash;
            // Add or prepend to layers param
            let layers = url.searchParams.get('layers') || '';
            // Insert minified JSON at the beginning
            if (layers) {
                layers = JSON.stringify(configObj) + ',' + layers;
            } else {
                layers = JSON.stringify(configObj);
            }
            url.searchParams.set('layers', layers);
            // Re-apply hash
            url.hash = hash;
            // Open the new URL as if it was clicked
            window.location.href = url.toString();
        } catch (err) {
            alert('Invalid JSON in config');
        }
    };
}

// Attach to button
$(document).on('click', '#add-layer-btn', openLayerCreatorDialog); 