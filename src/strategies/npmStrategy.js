// This file defines the strategy for parsing npm's package.json files and fetching license information.

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
        // Initialize an empty array to store the dependencies.
        const dependencies = [];
        // Parse the file content into a JSONC tree structure using jsonc-parser. This allows us to work with JSON files that may contain comments.
        const tree = jsonc.parseTree(fileContent);
        // If the parsing fails (e.g., invalid JSON), log an error and return an empty array.
        if (!tree) {
            console.error("License Sentinel 🛡️: Could not parse package.json as a valid JSONC tree.");
            return [];
        }

        // Define the sections in package.json where dependencies are listed.
        const depSections = ["dependencies", "devDependencies"];

        // Iterate over the dependency sections ("dependencies" and "devDependencies").
        for (const section of depSections) {
            // Find the node in the tree corresponding to the current dependency section.
            const depsNode = jsonc.findNodeAtLocation(tree, [section]);
            // Check if the node exists, is an object, and has children (i.e., dependencies).
            if (depsNode && depsNode.type === 'object' && depsNode.children) {
                // Iterate over each property (dependency) in the section.
                depsNode.children.forEach(propNode => {
                    // A property node has two children: key (name) and value (version).
                    if (propNode.children && propNode.children.length === 2) {
                        // The first child is the key (dependency name).
                        const keyNode = propNode.children[0];
                        // The second child is the value (dependency version).
                        const valueNode = propNode.children[1];
                        
                        // Extract the dependency name from the key node.
                        const name = keyNode.value;
                        // Extract the dependency version from the value node.
                        const version = valueNode.value;
                        // Get the line number from the start of the key node.
                        const position = document.positionAt(keyNode.offset);

                        // Create a dependency object and add it to the dependencies array.
                        dependencies.push({
                            name,
                            version,
                            line: position.line, // 0-based line number
                        });
                    }
                });
            }
        }
        
        // Return the array of extracted dependencies.
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

        // Return an object containing the license and homepage information.
        return {
            license: responseData.license || 'N/A',
            homepage: responseData.homepage || `https://www.npmjs.com/package/${packageName}`
        };
    }
};

module.exports = npmStrategy;