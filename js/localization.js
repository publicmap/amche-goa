/**
 * Simple localization system for the map application
 */
export class Localization {
    constructor() {
        this.defaultStrings = {
            title: "Maps नकासो",
            shareButton: "Share वांटो"
        };
        this.currentStrings = { ...this.defaultStrings };
    }

    /**
     * Load UI strings from configuration
     * @param {Object} config - Configuration object that may contain ui strings
     */
    loadStrings(config) {
        if (config && config.ui) {
            this.currentStrings = { ...this.defaultStrings, ...config.ui };
            this.updateUIElements();
        } else {
            // Reset to default if no UI config provided
            this.currentStrings = { ...this.defaultStrings };
            this.updateUIElements();
        }
    }

    /**
     * Get a localized string by key
     * @param {string} key - The string key
     * @returns {string} The localized string
     */
    getString(key) {
        return this.currentStrings[key] || this.defaultStrings[key] || key;
    }

    /**
     * Update UI elements with current localized strings
     */
    updateUIElements() {
        // Update drawer title
        const drawer = document.getElementById('map-controls-drawer');
        if (drawer) {
            drawer.setAttribute('label', this.currentStrings.title);
            
            // Also update the slot label content
            const labelSlot = drawer.querySelector('[slot="label"]');
            if (labelSlot) {
                // Find the text node and update it
                const textNode = Array.from(labelSlot.childNodes).find(
                    node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()
                );
                if (textNode) {
                    textNode.textContent = this.currentStrings.title;
                }
            }
        }

        // Update share button
        const shareButton = document.getElementById('share-link');
        if (shareButton) {
            // Update the text content while preserving the SVG icon
            const textContent = shareButton.childNodes[shareButton.childNodes.length - 1];
            if (textContent && textContent.nodeType === Node.TEXT_NODE) {
                textContent.textContent = '\n                        ' + this.currentStrings.shareButton + '\n                    ';
            }
        }
    }

    /**
     * Reset to default strings
     */
    reset() {
        this.currentStrings = { ...this.defaultStrings };
        this.updateUIElements();
    }
}

// Create and export a singleton instance
export const localization = new Localization(); 