const { fetchWithHttps } = require('../utils/network');

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
        const htmlContent = await fetchWithHttps(`https://pkg.go.dev/${packageName}?tab=licenses`);
        // การดึง license จาก HTML ค่อนข้างซับซ้อน จะแสดงผลแบบง่ายไปก่อน
        // This regex looks for the first license header, which is usually the primary one.
        const licenseMatch = htmlContent.match(/<h3 id="lic-0".*?>\s*([^<]+)\s*<\/h3>/) || htmlContent.match(/<h2 id="lic-0".*?>\s*([^<]+)\s*<\/h2>/);

        return {
            license: licenseMatch ? licenseMatch[1].trim() : 'N/A',
            homepage: `https://pkg.go.dev/${packageName}`
        };
    }
};

module.exports = goModStrategy;