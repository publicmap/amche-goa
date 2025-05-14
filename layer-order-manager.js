// Handles the ordering of different map layers based on their types and properties

// Define the order of different layer types (higher order = rendered later = appears on top)
const LAYER_TYPE_ORDER = {
    'terrain': 1,
    'style': 10,
    'vector': 20,
    'tms': 30,
    'csv': 40,
    'geojson': 50,
    'img': 60,
    'markers': 70,
    'layer-group': 80
};

// Define specific layer ID ordering overrides
const LAYER_ID_ORDER = {
    // Put landcover before osm-landuse
    'landcover': 19,
    'osm-landuse': 21,
    'osm-sites': 22,
    'mask': 200 // Mask should appear on top of everything
};

/**
 * Calculates the rendering position for a new layer
 * @param {Object} map - Mapbox map instance
 * @param {string} type - Layer type
 * @param {string|null} layerType - Specific layer type
 * @param {Object} currentGroup - Current layer group being processed
 * @param {Array} orderedGroups - All layer groups in their defined order
 * @returns {string|null} - The ID of the layer to insert before, or null for append
 */
function getInsertPosition(map, type, layerType, currentGroup, orderedGroups) {
    const layers = map.getStyle().layers;
    
    // Find current layer's index in the configuration
    const currentGroupIndex = orderedGroups.findIndex(group => 
        group.id === currentGroup?.id
    );

    // Get the order value for the current layer type
    const currentTypeOrder = LAYER_TYPE_ORDER[layerType || type] || Infinity;
    
    // Special case for layer ID-specific ordering
    const currentIdOrder = currentGroup && LAYER_ID_ORDER[currentGroup.id];
    const orderValue = currentIdOrder !== undefined ? currentIdOrder : currentTypeOrder;

    // Special case for TMS layers - insert after satellite layer
    if (type === 'tms') {
        // First look for any satellite layer in the style
        const satelliteLayers = layers.filter(layer => 
            layer.id === 'satellite' || 
            layer.id.includes('-satellite') || 
            layer.id.includes('satellite-')
        );
        
        if (satelliteLayers.length > 0) {
            // Find the last satellite layer in the stack
            const lastSatelliteLayer = satelliteLayers[satelliteLayers.length - 1];
            const satelliteIndex = layers.findIndex(l => l.id === lastSatelliteLayer.id);
            
            // Return the next layer after the satellite layer
            if (satelliteIndex < layers.length - 1) {
                return layers[satelliteIndex + 1].id;
            }
        }
    }

    // For all other cases, go through layers in reverse to find insertion point
    for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i];
        
        // Skip layers that don't have metadata (likely base layers)
        if (!layer.metadata || !layer.metadata.groupId) continue;
        
        const groupId = layer.metadata.groupId;
        const layerGroupIndex = orderedGroups.findIndex(g => g.id === groupId);
        
        // Use explicit layer ID ordering if available
        const layerIdOrder = LAYER_ID_ORDER[groupId];
        
        // Get order value based on type or ID override
        const thisLayerOrderValue = layerIdOrder !== undefined 
            ? layerIdOrder 
            : LAYER_TYPE_ORDER[layer.metadata.layerType] || 0;
        
        // If this layer should be rendered before our new layer
        if (thisLayerOrderValue < orderValue || 
            (thisLayerOrderValue === orderValue && layerGroupIndex <= currentGroupIndex)) {
            // Find the next layer that belongs to a different group
            for (let j = i + 1; j < layers.length; j++) {
                if (layers[j].metadata?.groupId !== groupId) {
                    return layers[j].id;
                }
            }
            break;
        }
    }

    // Fallback: look for specific layer IDs to insert before based on type
    if (type === 'vector' || type === 'geojson') {
        // Insert vector/geojson layers before labels
        const labelsLayers = layers.filter(layer => 
            layer.type === 'symbol' && (
                layer.id.includes('label') || 
                layer.id.includes('place-') || 
                layer.id.includes('-name') ||
                layer.id === 'poi-label'
            )
        );
        
        if (labelsLayers.length > 0) {
            return labelsLayers[0].id;
        }
    }

    // If no position found, append to the end
    return null;
}

export { getInsertPosition, LAYER_TYPE_ORDER, LAYER_ID_ORDER };