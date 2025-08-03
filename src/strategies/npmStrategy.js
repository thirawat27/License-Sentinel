const { fetchJson } = require('../utils/network');

const npmStrategy = {
    fileName: 'package.json',
    
    parseDependencies(fileContent) {
        const packageJson = JSON.parse(fileContent);
        return { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    },

    async fetchLicenseInfo(packageName) {
        // --- START: ส่วนที่แก้ไข ---
        // URL-encode the package name to handle scoped packages (e.g., @scope/package).
        // The '/' character must be encoded as '%2f' for the npm registry API.
        const encodedPackageName = packageName.replace('/', '%2f');
        
        const responseData = await fetchJson(`https://registry.npmjs.org/${encodedPackageName}/latest`);
        // --- END: ส่วนที่แก้ไข ---

        return {
            license: responseData.license || 'N/A',
            homepage: responseData.homepage || `https://www.npmjs.com/package/${packageName}`
        };
    }
};
module.exports = npmStrategy;