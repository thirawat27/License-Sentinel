const axios = require('axios');

const npmStrategy = {
    fileName: 'package.json',
    
    parseDependencies(fileContent) {
        const packageJson = JSON.parse(fileContent);
        return { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    },

    async fetchLicenseInfo(packageName) {
        const response = await axios.get(`https://registry.npmjs.org/${packageName}/latest`);
        return {
            license: response.data.license || 'N/A',
            homepage: response.data.homepage || `https://www.npmjs.com/package/${packageName}`
        };
    }
};
module.exports = npmStrategy;