const { fetchJson } = require('../utils/network');

const npmStrategy = {
    fileName: 'package.json',
    
    parseDependencies(fileContent) {
        const packageJson = JSON.parse(fileContent);
        return { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    },

    async fetchLicenseInfo(packageName) {
        const responseData = await fetchJson(`https://registry.npmjs.org/${packageName}/latest`);
        return {
            license: responseData.license || 'N/A',
            homepage: responseData.homepage || `https://www.npmjs.com/package/${packageName}`
        };
    }
};
module.exports = npmStrategy;