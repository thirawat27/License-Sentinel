// This file defines the strategy for parsing Composer's composer.json files and fetching license information.

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
        // This function takes the content of a composer.json file and a VS Code document object as input.
        const dependencies = []; // Initialize an empty array to store the extracted dependencies.
        const tree = jsonc.parseTree(fileContent); // Parse the file content into a JSONC tree structure using jsonc-parser.
        if (!tree) return []; // If the parsing fails (e.g., invalid JSON), return an empty array.

        const depSections = ["require", "require-dev"]; // Define the sections in composer.json where dependencies are listed.

        // Iterate over the dependency sections ("require" and "require-dev").
        for (const section of depSections) {
            const depsNode = jsonc.findNodeAtLocation(tree, [section]); // Find the node in the tree corresponding to the current dependency section.
            // Check if the node exists, is an object, and has children (i.e., dependencies).
            if (depsNode && depsNode.type === 'object' && depsNode.children) {
                // Iterate over each property (dependency) in the section.
                depsNode.children.forEach(propNode => {
                    // Ensure that the property node has a key (name) and a value (version).
                    if (propNode.children && propNode.children.length === 2) {
                        const keyNode = propNode.children[0]; // The first child is the key (dependency name).
                        const valueNode = propNode.children[1]; // The second child is the value (dependency version).
                        
                        const name = keyNode.value; // Extract the dependency name from the key node.
                        const version = valueNode.value; // Extract the dependency version from the value node.
                        const position = document.positionAt(keyNode.offset); // Get the position (line number) of the dependency name in the document.

                        // Create a dependency object and add it to the dependencies array.
                        dependencies.push({
                            name,
                            version,
                            line: position.line,
                        });
                    }
                });
            }
        }
        return dependencies; // Return the array of extracted dependencies.
    },

    /**
     * Fetches the license information for a given package name from Packagist.
     * @param {string} packageName The name of the package.
     * @returns {Promise<object>} An object containing the license and homepage information.
     */
    async fetchLicenseInfo(packageName) {
        // This function takes a package name as input and fetches its license and homepage information from Packagist.
        const response = await fetchJson(`https://repo.packagist.org/p2/${packageName}.json`); // Fetch the package information from Packagist's API.
        // The first version is often the latest stable, which is a reasonable default.
        const packageData = response.packages[packageName][0]; // Extract the package data from the response.
        // Return an object containing the license and homepage information.
        return {
            license: (packageData.license && packageData.license[0]) || 'N/A', // Extract the license from the package data, or set it to "N/A" if not found.
            homepage: packageData.homepage || `https://packagist.org/packages/${packageName}` // Extract the homepage from the package data, or construct a default Packagist URL if not found.
        };
    }
};

module.exports = composerStrategy;