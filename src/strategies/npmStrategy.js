// --- START OF FILE strategies/npmStrategy.js (FIXED) ---

// This file defines the strategy for parsing npm's package.json files and fetching license information.
// ไฟล์นี้กำหนด strategy สำหรับการ parsing ไฟล์ package.json ของ npm และดึงข้อมูล license

const { fetchJson } = require('../utils/network'); // Import the fetchJson function from the network utils.
const jsonc = require('jsonc-parser'); // Import jsonc-parser to get line numbers.

const npmStrategy = {
    fileName: 'package.json',
    
    /**
     * Parses the package.json file content and extracts dependencies with their locations.
     * @param {string} fileContent The content of the package.json file.
     * @param {import('vscode').TextDocument} document The VS Code document object for position mapping.
     * @returns {Array<{name: string, version: string, line: number}>} An array of dependency objects.
     */
    parseDependencies(fileContent, document) {
        const dependencies = [];
        const tree = jsonc.parseTree(fileContent);
        if (!tree) {
            console.error("LicenseSentinel: Could not parse package.json as a valid JSONC tree.");
            return [];
        }

        const depSections = ["dependencies", "devDependencies"];

        for (const section of depSections) {
            const depsNode = jsonc.findNodeAtLocation(tree, [section]);
            if (depsNode && depsNode.type === 'object' && depsNode.children) {
                depsNode.children.forEach(propNode => {
                    // A property node has two children: key and value
                    if (propNode.children && propNode.children.length === 2) {
                        const keyNode = propNode.children[0];
                        const valueNode = propNode.children[1];
                        
                        const name = keyNode.value;
                        const version = valueNode.value;
                        // Get the line number from the start of the key node
                        const position = document.positionAt(keyNode.offset);

                        dependencies.push({
                            name,
                            version,
                            line: position.line, // 0-based line number
                        });
                    }
                });
            }
        }
        
        return dependencies;
    },

    /**
     * Fetches the license information for a given package name from the npm registry.
     * @param {string} packageName The name of the package.
     * @returns {Promise<object>} An object containing the license and homepage information.
     */
    async fetchLicenseInfo(packageName) {
        // URL-encode the package name to handle scoped packages (e.g., @scope/package)
        const encodedPackageName = packageName.replace('/', '%2f');
        
        // Fetch the package data from the npm registry. Use 'latest' to get general info.
        const responseData = await fetchJson(`https://registry.npmjs.org/${encodedPackageName}/latest`);

        return {
            license: responseData.license || 'N/A',
            homepage: responseData.homepage || `https://www.npmjs.com/package/${packageName}`
        };
    }
};

module.exports = npmStrategy;
// --- END OF FILE strategies/npmStrategy.js (FIXED) ---