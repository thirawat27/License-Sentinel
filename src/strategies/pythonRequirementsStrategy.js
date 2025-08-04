// --- START OF FILE strategies/pythonRequirementsStrategy.js (FIXED) ---

const { fetchLicenseInfo } = require('./pythonPoetryStrategy');

const pythonRequirementsStrategy = {
    fileName: 'requirements.txt',

    parseDependencies(fileContent, document) {
        const dependencies = [];
        const lines = fileContent.split(/\r?\n/);

        // Regex updated to be more robust for package names, including those with dots.
        // อัปเดต Regex ให้แข็งแกร่งขึ้นสำหรับชื่อ package, รวมถึงชื่อที่มีจุด
        const depRegex = /^\s*([a-zA-Z0-9_.-]+(?:\[[a-zA-Z0-9_.-]+\])?)/;

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('#') || trimmedLine === '' || trimmedLine.startsWith('-')) {
                return;
            }

            const match = trimmedLine.match(depRegex);
            if (match && match[1]) {
                // Remove extras like [full] from the package name
                // ลบส่วน extra เช่น [full] ออกจากชื่อ package
                const name = match[1].split('[')[0];
                
                let version = 'latest';
                // A more specific regex for version string
                // Regex ที่เฉพาะเจาะจงมากขึ้นสำหรับ version string
                const versionMatch = trimmedLine.match(/(==|>=|<=|~=|>|<)\s*([\w_.-]+)/);
                if (versionMatch && versionMatch[2]) {
                    version = versionMatch[2];
                }

                dependencies.push({
                    name,
                    version,
                    line: index,
                });
            }
        });

        return dependencies;
    },

    fetchLicenseInfo: fetchLicenseInfo
};

module.exports = pythonRequirementsStrategy;
// --- END OF FILE strategies/pythonRequirementsStrategy.js (FIXED) ---