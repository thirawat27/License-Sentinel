const { fetchJson } = require('../utils/network');
const toml = require('toml');

/**
 * Strategy สำหรับการสแกน Dependencies ของ Rust (Cargo)
 */
const rustCargoStrategy = {
    fileName: 'Cargo.toml',

    /**
     * อ่านไฟล์ Cargo.toml และดึงรายชื่อ dependencies ออกมา
     * @param {string} fileContent เนื้อหาของไฟล์ Cargo.toml
     * @returns {Object} อ็อบเจกต์ของ dependencies
     */
    parseDependencies(fileContent) {
        const parsedToml = toml.parse(fileContent);
        const dependencies = parsedToml.dependencies || {};
        const devDependencies = parsedToml['dev-dependencies'] || {};
        const buildDependencies = parsedToml['build-dependencies'] || {};
        
        const allDeps = { ...dependencies, ...devDependencies, ...buildDependencies };
        const cleanedDeps = {};

        // Cargo.toml สามารถมี dependency ในรูปแบบ object ที่ซับซ้อนได้
        // เราจะทำให้มันง่ายขึ้นโดยเอาแค่ชื่อกับเวอร์ชัน
        for (const [name, value] of Object.entries(allDeps)) {
            if (typeof value === 'string') {
                cleanedDeps[name] = value;
            } else if (typeof value === 'object' && value.version) {
                cleanedDeps[name] = value.version;
            } else if (typeof value === 'object' && !value.version) {
                 cleanedDeps[name] = "*"; // No version specified, treat as latest
            }
        }
        
        return cleanedDeps;
    },

    /**
     * ดึงข้อมูล License จาก crates.io API
     * @param {string} packageName ชื่อของ crate
     * @returns {Promise<{license: string, homepage: string}>}
     */
    async fetchLicenseInfo(packageName) {
        // crates.io API
        // We fetch the main crate data, which includes the latest version info.
        const responseData = await fetchJson(`https://crates.io/api/v1/crates/${packageName}`);
        const crateData = responseData.crate;
        
        return {
            license: crateData.license || 'N/A',
            homepage: crateData.homepage || `https://crates.io/crates/${packageName}`
        };
    }
};

module.exports = rustCargoStrategy;