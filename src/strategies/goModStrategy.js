const { fetchJson } = require('../utils/network');

const goModStrategy = {
    fileName: 'go.mod',

    parseDependencies(fileContent) {
        const deps = {};
        const requireRegex = /require\s*\(([^)]+)\)/;
        const requireMatch = fileContent.match(requireRegex);
        const contentToParse = requireMatch ? requireMatch[1] : fileContent;
        
        const lineRegex = /^\s*([^\s]+)\s+([^\s]+)/gm;
        let match;
        while ((match = lineRegex.exec(contentToParse)) !== null) {
            if (match[1] !== 'require' && !match[1].startsWith('//') && match[1] !== 'go') {
                deps[match[1]] = match[2];
            }
        }
        return deps;
    },

    async fetchLicenseInfo(packageName, packageVersion) {
        // Use the deps.dev API for reliable JSON-based license data
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
            // Re-throw to be handled by the scanner
            throw error;
        }
    }
};

module.exports = goModStrategy;