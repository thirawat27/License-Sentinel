// --- START OF FILE strategies/javaMavenStrategy.js (FINAL) ---

// This file defines the strategy for parsing Java Maven's pom.xml files and fetching license information.
// ไฟล์นี้กำหนด strategy สำหรับการ parsing ไฟล์ pom.xml ของ Java Maven และดึงข้อมูล license

const { fetchText } = require('../utils/network');
const xml2js = require('xml2js');

const javaMavenStrategy = {
    fileName: 'pom.xml',

    /**
     * Parses the pom.xml file content and extracts dependencies with their locations.
     * @param {string} fileContent The content of the pom.xml file.
     * @param {import('vscode').TextDocument} document The VS Code document object for position mapping.
     * @returns {Promise<Array<{name: string, version: string, line: number}>>} An array of dependency objects.
     */
    async parseDependencies(fileContent, document) {
        const parser = new xml2js.Parser();
        const pom = await parser.parseStringPromise(fileContent);
        const depNodes = pom.project?.dependencies?.[0]?.dependency || [];
        
        const dependencies = [];
        const lines = fileContent.split(/\r?\n/);

        depNodes.forEach(dep => {
            if (dep.groupId && dep.artifactId && dep.version) {
                 const groupId = dep.groupId[0];
                 const artifactId = dep.artifactId[0];
                 const version = dep.version[0];
                 const name = `${groupId}:${artifactId}`;

                 // Find the line number by searching for the artifactId tag
                 let line = 0;
                 const searchString = `<artifactId>${artifactId}</artifactId>`;
                 const lineIndex = lines.findIndex(l => l.includes(searchString));
                 if (lineIndex !== -1) {
                     line = lineIndex;
                 }
                 
                 dependencies.push({ name, version, line });
            }
        });
        
        return dependencies;
    },

    /**
     * Fetches the license information for a given package name and version from Maven Central.
     * @param {string} packageName The name of the package (groupId:artifactId).
     * @param {string} packageVersion The version of the package.
     * @returns {Promise<object>} An object containing the license and homepage information.
     */
    async fetchLicenseInfo(packageName, packageVersion) {
        const [groupId, artifactId] = packageName.split(':');
        const version = packageVersion.replace(/\$|\{|\}/g, ''); 

        const groupPath = groupId.replace(/\./g, '/');
        const pomUrl = `https://repo1.maven.org/maven2/${groupPath}/${artifactId}/${version}/${artifactId}-${version}.pom`;
        
        try {
            const pomContent = await fetchText(pomUrl);
            const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
            const pomData = await parser.parseStringPromise(pomContent);

            let license = 'N/A';
            if (pomData.project?.licenses?.license) {
                const licenses = Array.isArray(pomData.project.licenses.license) 
                    ? pomData.project.licenses.license 
                    : [pomData.project.licenses.license];
                
                license = licenses.map(l => l.name || 'N/A').join(' OR ');
            }

            return {
                license: license || 'N/A',
                homepage: pomData.project?.url || `https://mvnrepository.com/artifact/${groupId}/${artifactId}/${version}`
            };

        } catch (error) {
            console.error(`Failed to fetch/parse .pom for ${packageName}@${version}. URL: ${pomUrl}. Error: ${error.message}`);
            throw error;
        }
    }
};

module.exports = javaMavenStrategy;
// --- END OF FILE strategies/javaMavenStrategy.js (FINAL) ---