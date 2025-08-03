const axios = require('axios');
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
        const response = await axios.get(`https://pypi.org/pypi/${packageName}/json`);
        const license = response.data.info.license || 'N/A';
        // PyPI ไม่มี license field ที่ดี ต้องดูจาก classifiers
        const classifiers = response.data.info.classifiers || [];
        const licenseClassifier = classifiers.find(c => c.startsWith('License ::'));
        const cleanLicense = licenseClassifier ? licenseClassifier.split('::').pop().trim() : license;

        return {
            license: cleanLicense === 'OSI Approved' ? 'N/A' : cleanLicense,
            homepage: response.data.info.project_url || `https://pypi.org/project/${packageName}`
        };
    }
};

module.exports = pythonPoetryStrategy;