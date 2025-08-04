// --- START OF FILE strategies/composerStrategy.js (FINAL) ---

// This file defines the strategy for parsing Composer's composer.json files and fetching license information.
// ไฟล์นี้กำหนด strategy สำหรับการ parsing ไฟล์ composer.json ของ Composer และดึงข้อมูล license

const { fetchJson } = require('../utils/network'); // Import the fetchJson function from the network utils.
const jsonc = require('jsonc-parser'); // Import jsonc-parser to get line numbers.

const composerStrategy = {
    fileName: 'composer.json',

    /**
     * Parses the composer.json file content and extracts dependencies with their locations.
     * @param {string} fileContent The content of the composer.json file.
     * @param {import('vscode').TextDocument} document The VS Code document object for position mapping.
     * @returns {Array<{name: string, version: string, line: number}>} An array of dependency objects.
     */
    parseDependencies(fileContent, document) {
        const dependencies = [];
        const tree = jsonc.parseTree(fileContent);
        if (!tree) return [];

        const depSections = ["require", "require-dev"];

        for (const section of depSections) {
            const depsNode = jsonc.findNodeAtLocation(tree, [section]);
            if (depsNode && depsNode.type === 'object' && depsNode.children) {
                depsNode.children.forEach(propNode => {
                    if (propNode.children && propNode.children.length === 2) {
                        const keyNode = propNode.children[0];
                        const valueNode = propNode.children[1];
                        
                        const name = keyNode.value;
                        const version = valueNode.value;
                        const position = document.positionAt(keyNode.offset);

                        dependencies.push({
                            name,
                            version,
                            line: position.line,
                        });
                    }
                });
            }
        }
        return dependencies;
    },

    /**
     * Fetches the license information for a given package name from Packagist.
     * @param {string} packageName The name of the package.
     * @returns {Promise<object>} An object containing the license and homepage information.
     */
    async fetchLicenseInfo(packageName) {
        const response = await fetchJson(`https://repo.packagist.org/p2/${packageName}.json`);
        // The first version is often the latest stable, which is a reasonable default.
        const packageData = response.packages[packageName][0];
        return {
            license: (packageData.license && packageData.license[0]) || 'N/A',
            homepage: packageData.homepage || `https://packagist.org/packages/${packageName}`
        };
    }
};

module.exports = composerStrategy;
// --- END OF FILE strategies/composerStrategy.js (FINAL) ---