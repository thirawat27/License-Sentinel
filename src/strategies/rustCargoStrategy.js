// This file defines the strategy for parsing Rust Cargo.toml files and fetching license information.

const { fetchJson } = require('../utils/network');
const toml = require('toml');

const rustCargoStrategy = {
    fileName: 'Cargo.toml',

    /**
     * Parses the Cargo.toml file and extracts dependencies with their locations.
     * @param {string} fileContent The content of the Cargo.toml file.
     * @param {import('vscode').TextDocument} document The VS Code document object for position mapping.
     * @returns {Array<{name: string, version: string, line: number}>} An array of dependency objects.
     */
    parseDependencies(fileContent, document) {
        // Initialize an empty array to store the dependencies found in the Cargo.toml file.
        const dependencies = [];
        // Parse the TOML file content using the 'toml' library.
        const parsedToml = toml.parse(fileContent);

        // Combine dependencies from the 'dependencies', 'dev-dependencies', and 'build-dependencies' sections.
        const allDeps = {
            ...(parsedToml.dependencies || {}),
            ...(parsedToml['dev-dependencies'] || {}),
            ...(parsedToml['build-dependencies'] || {})
        };

        // Clean up the dependency versions. If the version is a string, use it. If it's an object with a version property, use that. Otherwise, default to "*".
        const cleanedDeps = {};
        for (const [name, value] of Object.entries(allDeps)) {
            if (typeof value === 'string') {
                cleanedDeps[name] = value;
            } else if (typeof value === 'object' && value.version) {
                cleanedDeps[name] = value.version;
            } else {
                cleanedDeps[name] = "*";
            }
        }
        
        // Split the file content into lines for accurate line number tracking.
        const lines = fileContent.split(/\r?\n/);
        // Flag to indicate if the current line is within a dependencies section.
        let inDepsSection = false;
        // Array of strings that indicate the start of a dependencies section.
        const depSections = ['[dependencies]', '[dev-dependencies]', '[build-dependencies]'];
        // Regular expression to extract the dependency name from a line.
        const keyRegex = /^\s*([a-zA-Z0-9_-]+)\s*=/;

        // Iterate over each line in the file.
        lines.forEach((line, index) => {
            // Trim whitespace from the beginning and end of the line.
            const trimmedLine = line.trim();
            // Check if the line indicates the start of a dependencies section.
            if (depSections.some(s => trimmedLine.startsWith(s))) {
                inDepsSection = true;
                return;
            }
            // If the line starts a new section, reset the flag unless it's a dependency-related section.
            if (trimmedLine.startsWith('[')) {
                // This logic handles sections like [workspace.dependencies] or [target...]
                const isWorkspaceOrTarget = trimmedLine.includes('.dependencies]') || trimmedLine.startsWith('[target');
                if (isWorkspaceOrTarget) {
                    inDepsSection = true;
                } else {
                    inDepsSection = false;
                }
                return;
            }

            // If currently inside a dependencies section.
            if (inDepsSection) {
                // Attempt to match the line against the dependency key regex.
                const match = trimmedLine.match(keyRegex);
                // If a match is found and a dependency name is extracted.
                if (match && match[1]) {
                    const name = match[1];
                    // Check if the dependency exists in the extracted dependencies.
                    if (cleanedDeps[name]) {
                        // Add the dependency to the dependencies array with its name, version, and line number.
                        dependencies.push({
                            name,
                            version: cleanedDeps[name],
                            line: index
                        });
                    }
                }
            }
        });

        // Return the array of extracted dependencies.
        return dependencies;
    },

    /**
     * Fetches License information from crates.io API.
     * @param {string} packageName The name of the crate.
     * @returns {Promise<{license: string, homepage: string}>}
     */
    async fetchLicenseInfo(packageName) {
        // Fetch the crate data from the crates.io API.
        const responseData = await fetchJson(`https://crates.io/api/v1/crates/${packageName}`);
        
        // Extract the latest version data and crate data from the response.
        const latestVersionData = responseData.versions && responseData.versions[0];
        const crateData = responseData.crate;

        // Extract the license and homepage from the data. If they don't exist, default to 'N/A' for license and crates.io URL for homepage.
        const license = (latestVersionData && latestVersionData.license) || 'N/A';
        const homepage = crateData.homepage || crateData.repository || `https://crates.io/crates/${packageName}`;
        
        // Return an object containing the license and homepage information.
        return {
            license: license,
            homepage: homepage
        };
    }
};

module.exports = rustCargoStrategy;