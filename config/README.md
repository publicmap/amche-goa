# Amche Goa Map Configuration Guide

This document explains how to create and test your own custom map configuration for Amche Goa.

## Overview

The Amche Goa map uses a JSON configuration file to define what map layers are available, how they appear, and what information is displayed. You can create your own custom configuration to highlight specific layers or create a specialized map view.

## Creating a Custom Configuration

You can create a custom configuration by copying an existing one and modifying it to suit your needs. The simplest way is to start with a basic configuration like `config/1906-atlas-of-india.json`.

### Configuration Structure

The main structure of the configuration file is:

```json
{
  "layersConfig": [
    {
      "id": "layer-id",
      "title": "Layer Title",
      "description": "Layer description",
      "type": "tms|vector|geojson|style|...",
      "headerImage": "path/to/image.png",
      "initiallyChecked": true|false,
      "url": "https://tile-server/{z}/{x}/{y}.png",
      "attribution": "Attribution information",
      "style": {
        // Style properties
      },
      "inspect": {
        // Popup configuration (see Inspect Popups section)
      }
    },
    // More layers...
  ]
}
```

Common layer types include:
- `tms`: Standard tile map service (raster tiles)
- `vector`: Vector tile layers
- `geojson`: GeoJSON data layers
- `style`: Mapbox style layers
- `terrain`: 3D terrain controls

### Style Properties

Style properties control how layers are displayed. Common style properties include:

```json
"style": {
  "line-color": "red",
  "line-width": 2,
  "fill-color": "blue",
  "fill-opacity": 0.5,
  "circle-radius": 5,
  "text-color": "black",
  "text-halo-color": "white",
  "text-halo-width": 1
}
```

You can also use expressions for dynamic styling:

```json
"line-color": [
  "match",
  ["get", "property_name"],
  "value1", "red",
  "value2", "blue",
  "default_color"
]
```

For styling and expression schema reference see https://docs.mapbox.com/style-spec/reference/layers/ and https://docs.mapbox.com/style-spec/reference/expressions/

### Inspect Popups

The `inspect` property configures what information appears in the popup when a user clicks on a feature. This is a powerful way to display attribute data to users.

```json
"inspect": {
  "id": "property_name",           // Property to use as unique identifier
  "title": "Popup Title",          // Title displayed at the top of the popup
  "label": "property_for_label",   // Property to use as the main label
  "fields": [                      // Array of properties to display
    "property1",
    "property2",
    "property3"
  ],
  "fieldTitles": [                 // Human-readable titles for the fields
    "Property 1 Label",
    "Property 2 Label",
    "Property 3 Label"
  ],
  "customHtml": "<a href=\"https://example.com/\">Custom link</a>" // Optional custom HTML
}
```

Example of an `inspect` configuration for a roads layer:

```json
"inspect": {
  "id": "kind",
  "title": "Road Information",
  "label": "name",
  "fields": [
    "kind",
    "surface",
    "lanes"
  ],
  "fieldTitles": [
    "Road Type",
    "Surface Type",
    "Number of Lanes"
  ]
}
```

This would create a popup that shows the road name prominently, followed by its type, surface material, and number of lanes.

## Step-by-Step Guide

1. **Create a copy of a simple configuration**
   - Start with `config/1906-atlas-of-india.json` as it's simple and easy to customize
   - Save it with a new name (e.g., `my-custom-config.json`)

2. **Make your modifications**
   - Change the layer titles, descriptions
   - Modify the style properties (colors, widths, opacities)
   - Add or remove layers as needed

3. **Host your configuration file**
   - Create a [GitHub Gist](https://gist.github.com/) and upload your modified JSON file
   - Get the "Raw" URL of your Gist (click the "Raw" button when viewing your Gist)

4. **Test your configuration**
   - Load Amche Goa with your configuration by adding the `?config=` URL parameter:
   - Example: `https://amche.goa.in/?config=https://gist.githubusercontent.com/yourusername/gistid/raw/filename.json`

## Example: Making a Simple Modification

Here's a simple example of modifying the road layer in the 1906-atlas-of-india.json configuration:

1. Copy the 1906-atlas-of-india.json file
2. Find the "osm-roads" layer
3. Change the `"line-color"` property in the style section to make the roads stand out more:

```json
"style": {
  "line-color": [
    "case",
    ["boolean", ["feature-state", "hover"], false], "yellow",
    ["boolean", ["feature-state", "selected"], false], "red",
    "blue"  // Changed from "black" to "blue"
  ],
  // Other style properties...
}
```

## Testing Your Configuration

1. Create a GitHub Gist with your modified configuration
2. Get the "Raw" URL of your Gist
3. Visit: `https://amche.goa.in/?config=YOUR_RAW_GIST_URL`

## Tips

- Start with small changes to understand how each property affects the map
- If your configuration has errors, the map will fall back to the default configuration
- You can inspect the official configurations in the `config/` directory for reference
- JSON is strict about syntax - ensure all quotes, commas, and brackets are correctly placed

## Need More Help?

For more advanced configuration options, refer to the complete `config/default.json` file which shows all available options and complex configurations. 