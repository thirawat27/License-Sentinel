const toml = require('toml');

/**
 * Strategy สำหรับการสแกน Dependencies ของ Rust (Cargo)
 */
const rustCargoStrategy = {
    // Cargo จะใช้ Cargo.toml ในการนิยาม dependencies
    fileName: 'Cargo.toml',

    /**
     * อ่านไฟล์ Cargo.toml และดึงรายชื่อ dependencies ออกมา
     * @param {string} fileContent เนื้อหาของไฟล์ Cargo.toml
     * @returns {Object} อ็อบเจกต์ของ dependencies
     */
    parseDependencies(fileContent) {
        const parsedToml = toml.parse(fileContent);
        // รวม dependencies จากทุกส่วน
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
            }
        }
        
        return cleanedDeps;
    },

    /**
     * ดึงข้อมูล License จาก crates.io API
     * @param {string} packageName ชื่อของ crate
     * @param {string} version เวอร์ชันของ crate
     * @returns {Promise<{license: string, homepage: string}>}
     */
    async fetchLicenseInfo(packageName, version) {
        // crates.io API
        const response = await fetch(`https://crates.io/api/v1/crates/${packageName}/${version}`);
        const data = await response.json();
        const crateData = data.version;
        
        return {
            license: crateData.license || 'N/A',
            homepage: crateData.crate ? `https://crates.io/crates/${crateData.crate}` : ''
        };
    }
};

module.exports = rustCargoStrategy;