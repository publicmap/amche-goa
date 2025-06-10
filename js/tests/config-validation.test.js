const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const { validateJsonSyntax, validateConfigStructure } = require('./lint-json');

describe('Config File Validation', () => {
  let configFiles = [];
  let mapLayerPresets = null;

  beforeAll(async () => {
    // Load all config atlas JSON files
    configFiles = await glob('config/*.atlas.json', { cwd: process.cwd() });
    
    // Load map layer presets
    const presetsPath = path.resolve('config/_map-layer-presets.json');
    if (fs.existsSync(presetsPath)) {
      const presetsContent = fs.readFileSync(presetsPath, 'utf8');
      mapLayerPresets = JSON.parse(presetsContent);
    }
  });

  describe('JSON Syntax Validation', () => {
    test('should find config files', () => {
      expect(configFiles.length).toBeGreaterThan(0);
    });

    test('should validate all config files have valid JSON syntax', () => {
      configFiles.forEach((filePath) => {
        const fullPath = path.resolve(filePath);
        expect(validateJsonSyntax(fullPath)).toBe(true);
      });
    });
  });

  describe('JSON Structure Validation', () => {
    test('should validate all config files have valid structure', () => {
      expect(configFiles.length).toBeGreaterThan(0);
      
      configFiles.forEach((filePath) => {
        const fullPath = path.resolve(filePath);
        const content = fs.readFileSync(fullPath, 'utf8');
        const data = JSON.parse(content);
        
        expect(validateConfigStructure(fullPath, data)).toBe(true);
      });
    });
  });

  describe('Layer Reference Validation', () => {
    test('should load map layer presets', () => {
      expect(mapLayerPresets).not.toBeNull();
      expect(mapLayerPresets.layers).toBeDefined();
      expect(Array.isArray(mapLayerPresets.layers)).toBe(true);
    });

    test('should have unique layer IDs in presets', () => {
      const layerIds = mapLayerPresets.layers.map(layer => layer.id).filter(id => id);
      const uniqueIds = new Set(layerIds);
      
      expect(layerIds.length).toBe(uniqueIds.size);
    });

    test('should reference valid layer IDs in all config files', () => {
      const testFiles = configFiles.filter(file => 
        !file.includes('_map-layer-presets.json') && !file.includes('_defaults.json')
      );
      
      testFiles.forEach((filePath) => {
      const fullPath = path.resolve(filePath);
      const content = fs.readFileSync(fullPath, 'utf8');
      const data = JSON.parse(content);
      
      // Handle different layer array structures
      let layersArray = data.layers;
      if (!layersArray && data.layersConfig) {
        layersArray = data.layersConfig;
      }
      
      // Skip files without layers array
      if (!layersArray || !Array.isArray(layersArray)) {
        return;
      }

      // Get all available layer IDs from presets
      const availableLayerIds = new Set(
        mapLayerPresets.layers.map(layer => layer.id).filter(id => id)
      );

      // Helper function to find closest matches
      const findClosestMatches = (invalidId, maxSuggestions = 3) => {
        const levenshteinDistance = (str1, str2) => {
          const matrix = [];
          
          for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
          }
          
          for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
          }
          
          for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
              if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
              } else {
                matrix[i][j] = Math.min(
                  matrix[i - 1][j - 1] + 1,
                  matrix[i][j - 1] + 1,
                  matrix[i - 1][j] + 1
                );
              }
            }
          }
          
          return matrix[str2.length][str1.length];
        };

        return Array.from(availableLayerIds)
          .map(id => ({
            id,
            distance: levenshteinDistance(invalidId, id)
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, maxSuggestions)
          .filter(item => item.distance <= Math.max(3, invalidId.length * 0.5))
          .map(item => item.id);
      };

      // Check each layer reference
      const invalidReferences = [];
      layersArray.forEach((layer, index) => {
        // Skip layers that are fully defined inline
        const isInlineDefinition = layer.title && (layer.type || layer.url || layer.style);
        
        if (layer.id && !availableLayerIds.has(layer.id) && !isInlineDefinition) {
          const suggestions = findClosestMatches(layer.id);
          invalidReferences.push({
            index,
            id: layer.id,
            title: layer.title || 'No title',
            suggestions
          });
        }
      });

      if (invalidReferences.length > 0) {
        const errorMessage = invalidReferences
          .map(ref => {
            let msg = `  - Index ${ref.index}: "${ref.id}" (${ref.title})`;
            if (ref.suggestions.length > 0) {
              msg += `\n    Did you mean: ${ref.suggestions.join(', ')}?`;
            }
            return msg;
          })
          .join('\n');
        
        throw new Error(`Invalid layer references found in ${filePath}:\n${errorMessage}\n\nAll available layer IDs: ${Array.from(availableLayerIds).sort().join(', ')}`);
      }
      });
    });
  });

  describe('Map Layer Presets Validation', () => {
    test('should have required fields for each layer', () => {
      mapLayerPresets.layers.forEach((layer, index) => {
        expect(layer.id).toBeDefined();
        expect(typeof layer.id).toBe('string');
        expect(layer.id.length).toBeGreaterThan(0);
        
        expect(layer.title).toBeDefined();
        expect(typeof layer.title).toBe('string');
        expect(layer.title.length).toBeGreaterThan(0);
        
        // Type should be one of the expected values
        if (layer.type) {
          const validTypes = ['vector', 'geojson', 'tms', 'markers', 'csv', 'style', 'terrain', 'layer-group', 'img','raster-style-layer'];
          expect(validTypes).toContain(layer.type);
        }
      });
    });

    test('should have valid headerImage paths for layers with images', () => {
      mapLayerPresets.layers.forEach((layer) => {
        if (layer.headerImage) {
          expect(typeof layer.headerImage).toBe('string');
          expect(layer.headerImage.length).toBeGreaterThan(0);
          // Should start with assets/ for local images
          if (!layer.headerImage.startsWith('http')) {
            expect(layer.headerImage).toMatch(/^assets\//);
          }
        }
      });
    });

    test('should have valid attribution for data layers', () => {
      mapLayerPresets.layers.forEach((layer) => {
        // Skip style layers and terrain as they may not need attribution
        if (layer.type && !['style', 'terrain'].includes(layer.type)) {
          if (layer.attribution) {
            expect(typeof layer.attribution).toBe('string');
            expect(layer.attribution.length).toBeGreaterThan(0);
          }
        }
      });
    });
  });

  describe('Config File Consistency', () => {
    test('should have consistent naming patterns', () => {
      configFiles.forEach(filePath => {
        const fileName = path.basename(filePath);
        
        // File names should be lowercase with hyphens or underscores
        expect(fileName).toMatch(/^[a-z0-9._-]+\.json$/);
      });
    });

    test('should have valid map center coordinates', () => {
      configFiles.forEach(filePath => {
        const fullPath = path.resolve(filePath);
        const content = fs.readFileSync(fullPath, 'utf8');
        const data = JSON.parse(content);
        
        if (data.map && data.map.center) {
          expect(Array.isArray(data.map.center)).toBe(true);
          expect(data.map.center).toHaveLength(2);
          
          const [lng, lat] = data.map.center;
          expect(typeof lng).toBe('number');
          expect(typeof lat).toBe('number');
          
          // Basic coordinate validation (longitude: -180 to 180, latitude: -90 to 90)
          expect(lng).toBeGreaterThanOrEqual(-180);
          expect(lng).toBeLessThanOrEqual(180);
          expect(lat).toBeGreaterThanOrEqual(-90);
          expect(lat).toBeLessThanOrEqual(90);
        }
      });
    });
  });
}); 