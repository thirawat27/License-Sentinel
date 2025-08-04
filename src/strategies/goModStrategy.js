// --- START OF FILE strategies/goModStrategy.js (FINAL) ---

// This file defines the strategy for parsing Go Modules' go.mod files and fetching license information.
// ไฟล์นี้กำหนด strategy สำหรับการ parsing ไฟล์ go.mod ของ Go Modules และดึงข้อมูล license

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
        const dependencies = [];
        const lines = fileContent.split(/\r?\n/);

        const requireRegex = /require\s*\(([^)]+)\)/;
        const requireMatch = fileContent.match(requireRegex);
        
        // Determine which lines to parse
        const contentToParse = requireMatch ? requireMatch[1] : fileContent;
        const linesToParse = contentToParse.split(/\r?\n/);
        
        // A simple regex to find dependency lines
        const lineRegex = /^\s*([^\s]+)\s+([^\s]+)/;

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            
            // We only care about lines that look like a dependency
            if (trimmedLine.startsWith('//') || !trimmedLine) {
                return;
            }

            const match = trimmedLine.match(lineRegex);
            if (match) {
                const name = match[1];
                const version = match[2];

                // Filter out module, go, and require keywords
                if (name !== 'module' && name !== 'go' && name !== 'require') {
                    dependencies.push({
                        name,
                        version,
                        line: index,
                    });
                }
            }
        });

        return dependencies;
    },

    /**
     * Fetches the license information for a given package name and version from deps.dev.
     * @param {string} packageName The name of the package.
     * @param {string} packageVersion The version of the package.
     * @returns {Promise<object>} An object containing the license and homepage information.
     */
    async fetchLicenseInfo(packageName, packageVersion) {
        const version = packageVersion.startsWith('v') ? packageVersion : `v${packageVersion}`;
        const apiUrl = `https://deps.dev/_/s/go/p/${encodeURIComponent(packageName)}/v/${encodeURIComponent(version)}/insights`;

        try {
            const insightsData = await fetchJson(apiUrl);
            const licenses = insightsData.licenses || [];
            
            return {
                license: licenses.length > 0 ? licenses.join(' OR ') : 'N/A',
                homepage: `https://pkg.go.dev/${packageName}`
            };

        } catch (error) {
            console.error(`Failed to fetch Go insights for ${packageName} from deps.dev. Error: ${error.message}`);
            throw error;
        }
    }
};

module.exports = goModStrategy;
// --- END OF FILE strategies/goModStrategy.js (FINAL) ---