const axios = require('axios');

const goModStrategy = {
    fileName: 'go.mod',

    parseDependencies(fileContent) {
        const deps = {};
        const requireRegex = /require\s*\(([^)]+)\)/;
        const requireMatch = fileContent.match(requireRegex);
        const contentToParse = requireMatch ? requireMatch[1] : fileContent;
        
        const lineRegex = /^\s*([^\s]+)\s+([^\s]+)/gm;
        let match;
        while ((match = lineRegex.exec(contentToParse)) !== null) {
            // กรองบรรทัดที่ไม่ใช่ dependency ออก
            if (match[1] !== 'require' && !match[1].startsWith('//') && match[1] !== 'go') {
                deps[match[1]] = match[2];
            }
        }
        return deps;
    },

    async fetchLicenseInfo(packageName) {
        // Go Package Discovery API
        const response = await axios.get(`https://pkg.go.dev/${packageName}?tab=licenses`);
        // การดึง license จาก HTML ค่อนข้างซับซ้อน จะแสดงผลแบบง่ายไปก่อน
        const licenseMatch = response.data.match(/<h2 id="lic-0".*?>([^<]+)<\/h2>/);

        return {
            license: licenseMatch ? licenseMatch[1] : 'N/A',
            homepage: `https://pkg.go.dev/${packageName}`
        };
    }
};

module.exports = goModStrategy;