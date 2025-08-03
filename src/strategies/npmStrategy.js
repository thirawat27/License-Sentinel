// This file defines the strategy for parsing npm's package.json files and fetching license information.
// ไฟล์นี้กำหนด strategy สำหรับการ parsing ไฟล์ package.json ของ npm และดึงข้อมูล license

const { fetchJson } = require('../utils/network'); // Import the fetchJson function from the network utils. นำเข้าฟังก์ชัน fetchJson จาก network utils

const npmStrategy = {
    // The file name that this strategy handles. ชื่อไฟล์ที่ strategy นี้จัดการ
    fileName: 'package.json',
    
    /**
     * Parses the package.json file content and extracts the dependencies.
     * @param {string} fileContent The content of the package.json file.
     * @returns {object} An object containing the dependencies.
     */
    // Parses the package.json file content and extracts the dependencies.
    // Parse เนื้อหาไฟล์ package.json และดึง dependencies
    parseDependencies(fileContent) {
        // Parse the JSON content of the file. Parse เนื้อหา JSON ของไฟล์
        const packageJson = JSON.parse(fileContent);
        // Return an object containing the require and require-dev dependencies. คืนค่า object ที่มี dependencies จาก dependencies และ devDependencies
        return { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    },

    /**
     * Fetches the license information for a given package name from the npm registry.
     * @param {string} packageName The name of the package.
     * @returns {Promise<object>} An object containing the license and homepage information.
     */
    // Fetches the license information for a given package name from the npm registry.
    // ดึงข้อมูล license สำหรับ package name ที่กำหนดจาก npm registry
    async fetchLicenseInfo(packageName) {
        // URL-encode the package name to handle scoped packages (e.g., @scope/package).
        // URL-encode package name เพื่อจัดการ scoped packages (เช่น @scope/package)
        // The '/' character must be encoded as '%2f' for the npm registry API.
        // ตัวอักษร '/' ต้องถูก encode เป็น '%2f' สำหรับ npm registry API
        const encodedPackageName = packageName.replace('/', '%2f');
        
        // Fetch the package data from the npm registry. ดึงข้อมูล package จาก npm registry
        const responseData = await fetchJson(`https://registry.npmjs.org/${encodedPackageName}/latest`);

        // Return an object containing the license and homepage information. คืนค่า object ที่มีข้อมูล license และ homepage
        return {
            // Get the license from the response data, or 'N/A' if it is not available. ดึง license จากข้อมูล response หรือ 'N/A' หากไม่มี
            license: responseData.license || 'N/A',
            // Get the homepage from the response data, or a default npm URL if it is not available. ดึง homepage จากข้อมูล response หรือ URL ของ npm หากไม่มี
            homepage: responseData.homepage || `https://www.npmjs.com/package/${packageName}`
        };
    }
};

// Export the npmStrategy object. ส่งออก object npmStrategy
module.exports = npmStrategy;