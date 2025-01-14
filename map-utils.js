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