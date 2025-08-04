// This file defines the strategy for parsing Go Modules' go.mod files and fetching license information.

const { fetchJson } = require('../utils/network');

const goModStrategy = {
    fileName: 'go.mod',

    /**
     * Parses the go.mod file content and extracts dependencies with their locations.
     * @param {string} fileContent The content of the go.mod file.
     * @param {import('vscode').TextDocument} document The VS Code document object for position mapping.
     * @returns {Array<{name: string, version: string, line: number}>} An array of dependency objects.
     */
    parseDependencies(fileContent, document) {
        // Initialize an empty array to store the dependencies found in the go.mod file.
        const dependencies = [];
        // Split the file content into lines for easier processing.
        const lines = fileContent.split(/\r?\n/);

        // Regex to find the 'require' block which may contain multiple dependencies.
        const requireRegex = /require\s*\(([^)]+)\)/;
        // Attempt to match the 'require' block in the file content.
        const requireMatch = fileContent.match(requireRegex);
        
        // Determine which lines to parse; if 'require' block exists, parse only its content, otherwise parse the whole file.
        const contentToParse = requireMatch ? requireMatch[1] : fileContent;
        // Split the content to parse into individual lines.
        const linesToParse = contentToParse.split(/\r?\n/);
        
        // A simple regex to find dependency lines, e.g., 'moduleName version'.
        const lineRegex = /^\s*([^\s]+)\s+([^\s]+)/;

        // Iterate over each line in the file.
        lines.forEach((line, index) => {
            // Trim whitespace from the beginning and end of the line.
            const trimmedLine = line.trim();
            
            // Skip comments and empty lines.
            if (trimmedLine.startsWith('//') || !trimmedLine) {
                return;
            }

            // Attempt to match the dependency line regex.
            const match = trimmedLine.match(lineRegex);
            // If a match is found, extract the dependency name and version.
            if (match) {
                // The first group in the regex match is the dependency name.
                const name = match[1];
                // The second group in the regex match is the dependency version.
                const version = match[2];

                // Filter out module, go, and require keywords to avoid adding them as dependencies.
                if (name !== 'module' && name !== 'go' && name !== 'require') {
                    // Add the dependency to the dependencies array with its name, version, and line number.
                    dependencies.push({
                        name,
                        version,
                        line: index,
                    });
                }
            }
        });

        // Return the array of extracted dependencies.
        return dependencies;
    },

    /**
     * Fetches the license information for a given package name and version from deps.dev.
     * @param {string} packageName The name of the package.
     * @param {string} packageVersion The version of the package.
     * @returns {Promise<object>} An object containing the license and homepage information.
     */
    async fetchLicenseInfo(packageName, packageVersion) {
        // Ensure the version starts with 'v' to match the format expected by deps.dev.
        const version = packageVersion.startsWith('v') ? packageVersion : `v${packageVersion}`;
        // Construct the API URL for fetching insights from deps.dev.
        const apiUrl = `https://deps.dev/_/s/go/p/${encodeURIComponent(packageName)}/v/${encodeURIComponent(version)}/insights`;

        try {
            // Fetch the insights data from the deps.dev API.
            const insightsData = await fetchJson(apiUrl);
            // Extract the licenses from the insights data, or default to an empty array if not found.
            const licenses = insightsData.licenses || [];
            
            // Return an object containing the license (joined with ' OR ' if multiple) and a link to the package's homepage on pkg.go.dev.
            return {
                license: licenses.length > 0 ? licenses.join(' OR ') : 'N/A',
                homepage: `https://pkg.go.dev/${packageName}`
            };

        } catch (error) {
            // Log an error message if fetching insights fails.
            console.error(`Failed to fetch Go insights for ${packageName} from deps.dev. Error: ${error.message}`);
            // Re-throw the error to be handled by the caller.
            throw error;
        }
    }
};

module.exports = goModStrategy;