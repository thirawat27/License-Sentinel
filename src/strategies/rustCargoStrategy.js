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
        // Fetch the main crate data, which includes information on all versions.
        const responseData = await fetchJson(`https://crates.io/api/v1/crates/${packageName}`);
        
        // --- START: ส่วนที่แก้ไข ---
        // The most recent version's data is in the first element of the 'versions' array.
        // This is more reliable than the top-level 'crate.license' which can be null.
        const latestVersionData = responseData.versions && responseData.versions[0];
        const crateData = responseData.crate;

        // Get license from the latest version, which is the most accurate source.
        const license = (latestVersionData && latestVersionData.license) || 'N/A';

        // Homepage and repository are usually on the main crate object.
        const homepage = crateData.homepage || crateData.repository || `https://crates.io/crates/${packageName}`;
        
        return {
            license: license,
            homepage: homepage
        };
        // --- END: ส่วนที่แก้ไข ---
    }
};

module.exports = rustCargoStrategy;