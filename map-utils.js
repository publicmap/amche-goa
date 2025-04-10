/**
 * Converts a GeoJSON feature to KML format
 * @param {Object} feature - GeoJSON feature object
 * @param {Object} options - Options for KML generation
 * @param {string} options.title - Title for the KML document and placemark
 * @param {string} options.description - Description for the KML document
 * @returns {string} KML document as a string
 */
function escapeXml(unsafe) {
    if (!unsafe) return '';
    return unsafe.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export function convertToKML(feature, options) {
    const {title, description} = options;
    
    // Start KML document with escaped values
    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(title)}</name>
    <description>${escapeXml(description)}</description>
    <Placemark>
      <name>${escapeXml(title)}</name>
      <description><![CDATA[`;

    // Add properties as description
    for (const [key, value] of Object.entries(feature.properties)) {
        if (value) {
            kml += `<strong>${escapeXml(key)}:</strong> ${escapeXml(value)}<br/>`;
        }
    }

    kml += `]]></description>`;

    // Add geometry
    if (feature.geometry.type === 'Polygon') {
        kml += `
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>`;
        
        // Add coordinates (KML uses lon,lat,alt format)
        feature.geometry.coordinates[0].forEach(coord => {
            kml += `${coord[0]},${coord[1]},0 `;
        });

        kml += `</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>`;
    }

    // Close KML document
    kml += `
    </Placemark>
  </Document>
</kml>`;

    return kml;
}

/**
 * Converts Google Sheets table data to an array of objects
 * @param {Object} tableData - Google Sheets table data
 * @returns {Array} Array of objects with column headers as keys
 */
export function gstableToArray(tableData) {
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

/**
 * Extracts and parses query parameters from the URL
 * @returns {Object} Object containing query parameters as key-value pairs
 */
export function getQueryParameters() {
    const params = {};
    window.location.search.substring(1).split('&').forEach(param => {
        const [key, value] = param.split('=');
        if (key) params[key] = decodeURIComponent(value || '');
    });
    return params;
}

/**
 * Converts longitude and latitude coordinates to Web Mercator projection
 * @param {number} lng - Longitude coordinate
 * @param {number} lat - Latitude coordinate
 * @returns {Object} Object with x and y coordinates in Web Mercator
 */
export function convertToWebMercator(lng, lat) {
    const x = (lng * 20037508.34) / 180;
    let y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
    y = (y * 20037508.34) / 180;
    return { x, y };
}

/**
 * Converts a layer style configuration into a human-readable legend format
 * @param {Object} style - The style configuration object
 * @returns {Array} Array of style properties with readable descriptions
 */
export function convertStyleToLegend(style) {
    if (!style) return [];

    const legend = [];
    
    // Helper function to convert camelCase/kebab-case to Title Case
    const formatPropertyName = (prop) => {
        return prop
            .replace(/([A-Z])/g, ' $1') // Convert camelCase
            .replace(/-/g, ' ') // Convert kebab-case
            .replace(/^\w/, c => c.toUpperCase()) // Capitalize first letter
            .trim();
    };

    // Helper function to format color values
    const formatColorValue = (value) => {
        if (typeof value === 'string') {
            return {
                type: 'color',
                value: value
            };
        }
        return {
            type: 'expression',
            value: JSON.stringify(value, null, 2)
        };
    };

    // Helper function to format numeric values
    const formatNumericValue = (value) => {
        if (typeof value === 'number') {
            return {
                type: 'number',
                value: value
            };
        }
        return {
            type: 'expression',
            value: JSON.stringify(value, null, 2)
        };
    };

    // Process common style properties
    const styleProperties = {
        // Fill properties
        'fill-color': { 
            category: 'Fill',
            format: formatColorValue
        },
        'fill-opacity': {
            category: 'Fill',
            format: formatNumericValue
        },
        
        // Line properties
        'line-color': {
            category: 'Line',
            format: formatColorValue
        },
        'line-width': {
            category: 'Line',
            format: formatNumericValue
        },
        'line-opacity': {
            category: 'Line',
            format: formatNumericValue
        },
        'line-dasharray': {
            category: 'Line',
            format: (value) => ({
                type: 'dash-pattern',
                value: Array.isArray(value) ? value : JSON.stringify(value)
            })
        },

        // Text properties
        'text-field': {
            category: 'Text',
            format: (value) => ({
                type: 'text',
                value: typeof value === 'string' ? value : JSON.stringify(value)
            })
        },
        'text-size': {
            category: 'Text',
            format: formatNumericValue
        },
        'text-color': {
            category: 'Text',
            format: formatColorValue
        },
        'text-halo-color': {
            category: 'Text',
            format: formatColorValue
        },
        'text-halo-width': {
            category: 'Text',
            format: formatNumericValue
        },
        'text-font': {
            category: 'Text',
            format: (value) => ({
                type: 'font',
                value: Array.isArray(value) ? value.join(', ') : value
            })
        },

        // Circle properties
        'circle-radius': {
            category: 'Circle',
            format: formatNumericValue
        },
        'circle-color': {
            category: 'Circle',
            format: formatColorValue
        },
        'circle-opacity': {
            category: 'Circle',
            format: formatNumericValue
        },
        'circle-stroke-width': {
            category: 'Circle',
            format: formatNumericValue
        },
        'circle-stroke-color': {
            category: 'Circle',
            format: formatColorValue
        }
    };

    // Process each style property
    for (const [prop, value] of Object.entries(style)) {
        if (styleProperties[prop]) {
            const { category, format } = styleProperties[prop];
            const formattedValue = format(value);
            
            legend.push({
                category,
                property: formatPropertyName(prop),
                ...formattedValue
            });
        }
    }

    // Group by category
    const groupedLegend = legend.reduce((acc, item) => {
        if (!acc[item.category]) {
            acc[item.category] = [];
        }
        acc[item.category].push(item);
        return acc;
    }, {});

    return groupedLegend;
} 