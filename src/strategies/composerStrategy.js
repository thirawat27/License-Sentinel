// This file defines the strategy for parsing Composer's composer.json files and fetching license information.
// ไฟล์นี้กำหนด strategy สำหรับการ parsing ไฟล์ composer.json ของ Composer และดึงข้อมูล license

const { fetchJson } = require('../utils/network'); // Import the fetchJson function from the network utils. นำเข้าฟังก์ชัน fetchJson จาก network utils

const composerStrategy = {
    // The file name that this strategy handles. ชื่อไฟล์ที่ strategy นี้จัดการ
    fileName: 'composer.json',

    /**
     * Parses the composer.json file content and extracts the dependencies.
     * @param {string} fileContent The content of the composer.json file.
     * @returns {object} An object containing the dependencies.
     */
    // Parses the composer.json file content and extracts the dependencies.
    // Parse เนื้อหาไฟล์ composer.json และดึง dependencies
    parseDependencies(fileContent) {
        // Parse the JSON content of the file. Parse เนื้อหา JSON ของไฟล์
        const composerJson = JSON.parse(fileContent);
        // Return an object containing the require and require-dev dependencies. คืนค่า object ที่มี dependencies จาก require และ require-dev
        return { ...(composerJson.require || {}), ...(composerJson['require-dev'] || {}) };
    },

    /**
     * Fetches the license information for a given package name from Packagist.
     * @param {string} packageName The name of the package.
     * @returns {Promise<object>} An object containing the license and homepage information.
     */
    // Fetches the license information for a given package name from Packagist.
    // ดึงข้อมูล license สำหรับ package name ที่กำหนดจาก Packagist
    async fetchLicenseInfo(packageName) {
        // Fetch the package data from Packagist. ดึงข้อมูล package จาก Packagist
        const response = await fetchJson(`https://repo.packagist.org/p2/${packageName}.json`);
        // Extract the package data from the response. ดึงข้อมูล package จาก response
        const packageData = response.packages[packageName][0];
        // Return an object containing the license and homepage information. คืนค่า object ที่มีข้อมูล license และ homepage
        return {
            // Get the license from the package data, or 'N/A' if it is not available. ดึง license จากข้อมูล package หรือ 'N/A' หากไม่มี
            license: (packageData.license && packageData.license[0]) || 'N/A',
            // Get the homepage from the package data, or a default Packagist URL if it is not available. ดึง homepage จากข้อมูล package หรือ URL ของ Packagist หากไม่มี
            homepage: packageData.homepage || `https://packagist.org/packages/${packageName}`
        };
    }
};

// Export the composerStrategy object. ส่งออก object composerStrategy
module.exports = composerStrategy;