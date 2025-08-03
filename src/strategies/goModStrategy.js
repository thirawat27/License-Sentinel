// This file defines the strategy for parsing Go Modules' go.mod files and fetching license information.
// ไฟล์นี้กำหนด strategy สำหรับการ parsing ไฟล์ go.mod ของ Go Modules และดึงข้อมูล license

const { fetchJson } = require('../utils/network'); // Import the fetchJson function from the network utils. นำเข้าฟังก์ชัน fetchJson จาก network utils

const goModStrategy = {
    // The file name that this strategy handles. ชื่อไฟล์ที่ strategy นี้จัดการ
    fileName: 'go.mod',

    /**
     * Parses the go.mod file content and extracts the dependencies.
     * @param {string} fileContent The content of the go.mod file.
     * @returns {object} An object containing the dependencies.
     */
    // Parses the go.mod file content and extracts the dependencies.
    // Parse เนื้อหาไฟล์ go.mod และดึง dependencies
    parseDependencies(fileContent) {
        // Initialize an empty object to store dependencies. สร้าง object ว่างเพื่อเก็บ dependencies
        const deps = {};
        // Define a regex to find the 'require' block in the go.mod file. กำหนด regex เพื่อค้นหา block 'require' ในไฟล์ go.mod
        const requireRegex = /require\s*\(([^)]+)\)/;
        // Match the 'require' block in the file content. จับคู่ 'require' block ในเนื้อหาไฟล์
        const requireMatch = fileContent.match(requireRegex);
        // If a 'require' block is found, use its content for parsing, otherwise use the whole file content. หากพบ 'require' block, ใช้เนื้อหาของมันสำหรับการ parsing, มิฉะนั้นใช้เนื้อหาไฟล์ทั้งหมด
        const contentToParse = requireMatch ? requireMatch[1] : fileContent;
        
        // Define a regex to find each dependency line in the content. กำหนด regex เพื่อค้นหาแต่ละบรรทัด dependency ในเนื้อหา
        const lineRegex = /^\s*([^\s]+)\s+([^\s]+)/gm;
        // Initialize a variable to store each match. สร้างตัวแปรเพื่อเก็บแต่ละ match
        let match;
        // Iterate over each match in the content. วนซ้ำแต่ละ match ในเนื้อหา
        while ((match = lineRegex.exec(contentToParse)) !== null) {
            // If the line is not a 'require' statement, a comment, or the 'go' version, add it to the dependencies object. หากบรรทัดไม่ใช่ 'require' statement, comment, หรือ 'go' version, เพิ่มไปยัง object dependencies
            if (match[1] !== 'require' && !match[1].startsWith('//') && match[1] !== 'go') {
                // Add the dependency name and version to the dependencies object. เพิ่มชื่อ dependency และ version ไปยัง object dependencies
                deps[match[1]] = match[2];
            }
        }
        // Return the dependencies object. คืนค่า object dependencies
        return deps;
    },

    /**
     * Fetches the license information for a given package name and version from deps.dev.
     * @param {string} packageName The name of the package.
     * @param {string} packageVersion The version of the package.
     * @returns {Promise<object>} An object containing the license and homepage information.
     */
    // Fetches the license information for a given package name and version from deps.dev.
    // ดึงข้อมูล license สำหรับ package name และ version ที่กำหนดจาก deps.dev
    async fetchLicenseInfo(packageName, packageVersion) {
        // Ensure the version starts with 'v' to be compatible with the deps.dev API. ตรวจสอบให้แน่ใจว่า version ขึ้นต้นด้วย 'v' เพื่อให้เข้ากันได้กับ deps.dev API
        const version = packageVersion.startsWith('v') ? packageVersion : `v${packageVersion}`;
        // Construct the API URL for fetching insights data from deps.dev. สร้าง API URL สำหรับดึงข้อมูล insights จาก deps.dev
        const apiUrl = `https://deps.dev/_/s/go/p/${encodeURIComponent(packageName)}/v/${encodeURIComponent(version)}/insights`;

        try {
            // Fetch the insights data from the API. ดึงข้อมูล insights จาก API
            const insightsData = await fetchJson(apiUrl);
            // Extract the licenses from the insights data. ดึง licenses จากข้อมูล insights
            const licenses = insightsData.licenses || [];
            
            // Return an object containing the license and homepage information. คืนค่า object ที่มีข้อมูล license และ homepage
            return {
                // Join the licenses with ' OR ' if there are multiple, otherwise return 'N/A'. รวม licenses ด้วย ' OR ' หากมีหลาย licenses, มิฉะนั้นคืนค่า 'N/A'
                license: licenses.length > 0 ? licenses.join(' OR ') : 'N/A',
                // Provide a default homepage URL for Go packages. ให้ URL homepage เริ่มต้นสำหรับ Go packages
                homepage: `https://pkg.go.dev/${packageName}`
            };

        } catch (error) {
            // Log the error message if fetching insights data fails. บันทึกข้อความ error หากการดึงข้อมูล insights ล้มเหลว
            console.error(`Failed to fetch Go insights for ${packageName} from deps.dev. Error: ${error.message}`);
            // Re-throw the error to be handled by the scanner. Re-throw error เพื่อให้ scanner จัดการ
            throw error;
        }
    }
};

// Export the goModStrategy object. ส่งออก object goModStrategy
module.exports = goModStrategy;