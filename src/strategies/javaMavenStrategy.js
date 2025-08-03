const { fetchWithHttps } = require('../utils/network');
const xml2js = require('xml2js');

const javaMavenStrategy = {
    fileName: 'pom.xml',

    async parseDependencies(fileContent) {
        const parser = new xml2js.Parser();
        const pom = await parser.parseStringPromise(fileContent);
        const dependencies = pom.project?.dependencies?.[0]?.dependency || [];
        
        const deps = {};
        dependencies.forEach(dep => {
            if (dep.groupId && dep.artifactId && dep.version) {
                 const groupId = dep.groupId[0];
                 const artifactId = dep.artifactId[0];
                 const version = dep.version[0];
                 deps[`${groupId}:${artifactId}`] = version;
            }
        });
        return deps;
    },

    async fetchLicenseInfo(packageName, packageVersion) {
        const [groupId, artifactId] = packageName.split(':');
        // Clean up version string from potential Maven property placeholders
        const version = packageVersion.replace(/\$|\{|\}/g, ''); 

        // Construct the URL to the .pom file directly from Maven Central
        const groupPath = groupId.replace(/\./g, '/');
        const pomUrl = `https://repo1.maven.org/maven2/${groupPath}/${artifactId}/${version}/${artifactId}-${version}.pom`;
        
        try {
            // Fetch the .pom file content
            const pomContent = await fetchWithHttps(pomUrl);

            // Parse the fetched .pom XML content
            const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
            const pomData = await parser.parseStringPromise(pomContent);

            // Extract license information
            let license = 'N/A';
            if (pomData.project && pomData.project.licenses && pomData.project.licenses.license) {
                // Handle both single and multiple licenses
                const licenses = Array.isArray(pomData.project.licenses.license) 
                    ? pomData.project.licenses.license 
                    : [pomData.project.licenses.license];
                
                license = licenses.map(l => l.name || 'N/A').join(' OR ');
            }

            return {
                license: license || 'N/A',
                homepage: (pomData.project && pomData.project.url) || `https://mvnrepository.com/artifact/${groupId}/${artifactId}/${version}`
            };

        } catch (error) {
            console.error(`Failed to fetch/parse .pom for ${packageName}@${version}. URL: ${pomUrl}. Error: ${error.message}`);
            // Re-throw the error so the scanner can handle it and display a specific message
            throw error;
        }
    }
};

module.exports = javaMavenStrategy;