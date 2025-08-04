// This file defines the strategy for parsing Python requirements.txt files and fetching license information.

const { fetchLicenseInfo } = require('./pythonPoetryStrategy');

const pythonRequirementsStrategy = {
    fileName: 'requirements.txt',

    /**
     * Parses the requirements.txt file content and extracts dependencies with their locations.
     * @param {string} fileContent The content of the requirements.txt file.
     * @param {import('vscode').TextDocument} document The VS Code document object for position mapping.
     * @returns {Array<{name: string, version: string, line: number}>} An array of dependency objects.
     */
    parseDependencies(fileContent, document) {
        const dependencies = [];
        // Split the file content into lines for easier processing.
        const lines = fileContent.split(/\r?\n/);

        // Regex to extract package names, allowing for names with dots and optional extras (e.g., package[extra]).
        const depRegex = /^\s*([a-zA-Z0-9_.-]+(?:\[[a-zA-Z0-9_.-]+\])?)/;

        // Iterate over each line in the file.
        lines.forEach((line, index) => {
            // Trim whitespace from the beginning and end of the line.
            const trimmedLine = line.trim();
            // Skip comments, empty lines, and lines starting with '-' (used for options, not direct dependencies).
            if (trimmedLine.startsWith('#') || trimmedLine === '' || trimmedLine.startsWith('-')) {
                return;
            }

            // Attempt to match the dependency regex.
            const match = trimmedLine.match(depRegex);
            // If a match is found, extract the dependency name and version.
            if (match && match[1]) {
                // Extract the package name, removing any "extras" (e.g., [full]).
                const name = match[1].split('[')[0];
                
                // Default version to 'latest' if no specific version is found.
                let version = 'latest';
                // Regex to extract the version string, accounting for comparison operators (==, >=, <=, ~=, >, <).
                const versionMatch = trimmedLine.match(/(==|>=|<=|~=|>|<)\s*([\w_.-]+)/);
                // If a version match is found, update the version string.
                if (versionMatch && versionMatch[2]) {
                    version = versionMatch[2];
                }

                // Add the dependency to the dependencies array.
                dependencies.push({
                    name,
                    version,
                    line: index,
                });
            }
        });

        // Return the array of extracted dependencies.
        return dependencies;
    },

    /**
     * Fetches the license information for a given package name.
     * This function reuses the fetchLicenseInfo function from the pythonPoetryStrategy.
     * @param {string} packageName The name of the package.
     * @returns {Promise<object>} An object containing the license and homepage information.
     */
    fetchLicenseInfo: fetchLicenseInfo
};

module.exports = pythonRequirementsStrategy;