const npmStrategy = {
    fileName: 'package.json',
    
    parseDependencies(fileContent) {
        const packageJson = JSON.parse(fileContent);
        return { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    },

    async fetchLicenseInfo(packageName) {
        const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`);
        const data = await response.json();
        return {
            license: data.license || 'N/A',
            homepage: data.homepage || `https://www.npmjs.com/package/${packageName}`
        };
    }
};
module.exports = npmStrategy;