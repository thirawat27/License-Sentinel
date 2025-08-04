// This file defines the strategy for parsing Python's requirements.txt files and fetching license information.
// ไฟล์นี้กำหนด strategy สำหรับการ parsing ไฟล์ requirements.txt ของ Python และดึงข้อมูล license

const { fetchJson } = require('../utils/network'); // Import the fetchJson function from the network utils. นำเข้าฟังก์ชัน fetchJson จาก network utils

const pythonRequirementsStrategy = {
    // The file name that this strategy handles. ชื่อไฟล์ที่ strategy นี้จัดการ
    fileName: 'requirements.txt',

    /**
     * Parses the requirements.txt file content and extracts the dependencies.
     * @param {string} fileContent The content of the requirements.txt file.
     * @returns {object} An object containing the dependencies.
     */
    // Parses the requirements.txt file content and extracts the dependencies.
    // Parse เนื้อหาไฟล์ requirements.txt และดึง dependencies
    parseDependencies(fileContent) {
        const deps = {};
        const lines = fileContent.split('\n');

        for (const line of lines) {
            // Trim whitespace and ignore comments or empty lines.
            // ตัดช่องว่างและไม่สนใจ comment หรือบรรทัดว่าง
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) {
                continue;
            }

            // Simple regex to extract the package name from the start of the line.
            // It handles lines like 'requests==2.25.1', 'numpy>=1.20', or just 'pandas'.
            // Regex ง่ายๆ เพื่อดึงชื่อ package จากจุดเริ่มต้นของบรรทัด
            // จัดการกับบรรทัดเช่น 'requests==2.25.1', 'numpy>=1.20', หรือ 'pandas'
            const match = trimmedLine.match(/^[a-zA-Z0-9_.-]+/);
            
            if (match) {
                const name = match[0];
                // The version part is the rest of the string, or '*' if not specified.
                // ส่วนของ version คือส่วนที่เหลือของ string, หรือ '*' หากไม่ได้ระบุ
                const version = trimmedLine.substring(name.length).trim() || '*';
                deps[name] = version;
            }
        }
        return deps;
    },

    /**
     * Fetches the license information for a given package name from the PyPI API.
     * @param {string} packageName The name of the package.
     * @returns {Promise<object>} An object containing the license and homepage information.
     */
    // Fetches the license information for a given package name from the PyPI API.
    // ดึงข้อมูล license สำหรับ package name ที่กำหนดจาก PyPI API
    async fetchLicenseInfo(packageName) {
        // Fetch the package data from the PyPI API. ดึงข้อมูล package จาก PyPI API
        const responseData = await fetchJson(`https://pypi.org/pypi/${packageName}/json`);
        // Extract the info from the response data. ดึงข้อมูล info จาก response data
        const info = responseData.info;
        // Get the license from the info, or 'N/A' if it is not available. ดึง license จาก info หรือ 'N/A' หากไม่มี
        const license = info.license || 'N/A';
        
        // PyPI does not have a reliable license field, so we need to look at the classifiers.
        // PyPI ไม่มี license field ที่น่าเชื่อถือ ดังนั้นเราต้องดูจาก classifiers
        const classifiers = info.classifiers || [];
        // Find the license classifier. ค้นหา license classifier
        const licenseClassifier = classifiers.find(c => c.startsWith('License ::'));
        
        // Initialize the clean license with the original license value. กำหนดค่าเริ่มต้นของ clean license ด้วยค่า license เดิม
        let cleanLicense = license;
        // If a license classifier is found, extract the license name from it. หากพบ license classifier, ดึงชื่อ license จาก classifier
        if (licenseClassifier) {
            cleanLicense = licenseClassifier.split('::').pop().trim();
        }

        // Avoid generic, unhelpful license strings. หลีกเลี่ยง license strings ที่เป็น generic และไม่เป็นประโยชน์
        if (cleanLicense === 'OSI Approved' || !cleanLicense || cleanLicense.toLowerCase() === 'n/a') {
            cleanLicense = license || 'N/A';
        }

        // Return an object containing the license and homepage information. คืนค่า object ที่มีข้อมูล license และ homepage
        return {
            // Set the license. ตั้งค่า license
            license: cleanLicense,
            // Set the homepage. ตั้งค่า homepage
            homepage: info.project_url || info.home_page || `https://pypi.org/project/${packageName}`
        };
    }
};

// Export the pythonRequirementsStrategy object. ส่งออก object pythonRequirementsStrategy
module.exports = pythonRequirementsStrategy;