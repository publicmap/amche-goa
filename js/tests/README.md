# Test Suite for Amche Goa

This directory contains the test suite for validating the configuration files and ensuring data integrity in the Amche Goa project.

## Testing Framework

This project uses **Vitest** for testing, which provides:
- ⚡ Fast execution with Vite's speed
- 🔧 Seamless integration with Vite configuration
- 📦 Smaller bundle size than Jest
- 🆕 Modern ESM support out of the box
- 🔄 Compatible with Jest API for easy migration

## Test Structure

### `config-validation.test.js`
Main test suite that validates:
- **JSON Syntax**: Ensures all config/*.atlas.json files have valid JSON syntax
- **JSON Structure**: Validates that config files have required fields and proper structure
- **Layer References**: Checks that all layer IDs referenced in config files exist in `_map-layer-presets.json`
- **Map Layer Presets**: Validates the structure and content of the layer presets file
- **Config Consistency**: Ensures consistent naming patterns and valid coordinates

### `lint-json.js`
Standalone JSON linting utility that can be run independently to validate JSON files.

## Running Tests

### Install Dependencies
```bash
npm install
```

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run JSON Linting Only
```bash
npm run lint:json
```

### Run Specific Test File
```bash
npx vitest run config-validation.test.js
```

### Run Tests with Coverage
```bash
npx vitest run --coverage
```

## Test Coverage

The tests cover:

1. **JSON Validation**
   - Syntax validation for all config/*.atlas.json files
   - Structure validation ensuring required fields exist

2. **Layer Reference Validation**
   - Ensures all layer IDs in config files exist in `_map-layer-presets.json`
   - Validates unique layer IDs in presets
   - Checks for orphaned layer references

3. **Data Integrity**
   - Validates map coordinates are within valid ranges
   - Checks file naming conventions
   - Validates layer types and required fields

4. **Asset Validation**
   - Checks headerImage paths for layers
   - Validates attribution strings for data layers

## Adding New Tests

To add new validation rules:

1. Add test cases to `config-validation.test.js`
2. Follow Vitest/Jest testing patterns (same API)
3. Use descriptive test names
4. Group related tests in `describe` blocks

## Continuous Integration

These tests are designed to run in CI/CD pipelines to catch configuration errors before deployment.

## Error Messages

The tests provide detailed error messages including:
- File paths where errors occur
- Specific validation failures
- Lists of available layer IDs when references are invalid
- Line numbers for JSON syntax errors

## Best Practices

1. Run tests before committing changes
2. Add tests for new configuration features
3. Keep test files focused and well-documented
4. Use meaningful test descriptions 