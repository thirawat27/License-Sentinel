const { fetchJson } = require('../utils/network');
const toml = require('toml');

const pythonPoetryStrategy = {
    fileName: 'pyproject.toml',

    parseDependencies(fileContent) {
        const parsedToml = toml.parse(fileContent);
        const dependencies = parsedToml.tool?.poetry?.dependencies || {};
        const devDependencies = parsedToml.tool?.poetry?.['dev-dependencies'] || {};
        // ลบเวอร์ชันของ python ออกไป
        delete dependencies.python;
        delete devDependencies.python;
        return { ...dependencies, ...devDependencies };
    },

    async fetchLicenseInfo(packageName) {
        // PyPI API
        const responseData = await fetchJson(`https://pypi.org/pypi/${packageName}/json`);
        const info = responseData.info;
        const license = info.license || 'N/A';
        
        // PyPI ไม่มี license field ที่ดี ต้องดูจาก classifiers
        const classifiers = info.classifiers || [];
        const licenseClassifier = classifiers.find(c => c.startsWith('License ::'));
        
        let cleanLicense = license;
        if (licenseClassifier) {
            cleanLicense = licenseClassifier.split('::').pop().trim();
        }

        // Avoid generic, unhelpful license strings
        if (cleanLicense === 'OSI Approved' || !cleanLicense || cleanLicense.toLowerCase() === 'n/a') {
            cleanLicense = license || 'N/A';
        }

        return {
            license: cleanLicense,
            homepage: info.project_url || info.home_page || `https://pypi.org/project/${packageName}`
        };
    }
};

module.exports = pythonPoetryStrategy;