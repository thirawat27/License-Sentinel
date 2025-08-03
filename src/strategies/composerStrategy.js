const axios = require('axios');

const composerStrategy = {
    fileName: 'composer.json',

    parseDependencies(fileContent) {
        const composerJson = JSON.parse(fileContent);
        return { ...(composerJson.require || {}), ...(composerJson['require-dev'] || {}) };
    },

    async fetchLicenseInfo(packageName) {
        const response = await axios.get(`https://repo.packagist.org/p2/${packageName}.json`);
        const packageData = response.data.packages[packageName][0];
        return {
            license: (packageData.license && packageData.license[0]) || 'N/A',
            homepage: packageData.homepage || `https://packagist.org/packages/${packageName}`
        };
    }
};
module.exports = composerStrategy;