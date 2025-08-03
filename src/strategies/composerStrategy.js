const composerStrategy = {
    fileName: 'composer.json',

    parseDependencies(fileContent) {
        const composerJson = JSON.parse(fileContent);
        return { ...(composerJson.require || {}), ...(composerJson['require-dev'] || {}) };
    },

    async fetchLicenseInfo(packageName) {
        const response = await fetch(`https://repo.packagist.org/p2/${packageName}.json`);
        const data = await response.json();
        const packageData = data.packages[packageName][0];
        return {
            license: (packageData.license && packageData.license[0]) || 'N/A',
            homepage: packageData.homepage || `https://packagist.org/packages/${packageName}`
        };
    }
};
module.exports = composerStrategy;