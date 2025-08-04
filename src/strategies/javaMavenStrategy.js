// This file defines the strategy for parsing Java Maven's pom.xml files and fetching license information.

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
        // Create a new XML parser.
        const parser = new xml2js.Parser();
        // Parse the XML file content into a JavaScript object.
        const pom = await parser.parseStringPromise(fileContent);
        // Extract the dependency nodes from the parsed pom.xml.
        const depNodes = pom.project?.dependencies?.[0]?.dependency || [];
        
        // Initialize an empty array to store the extracted dependencies.
        const dependencies = [];
        // Split the file content into lines for line number searching.
        const lines = fileContent.split(/\r?\n/);

        // Iterate over each dependency node.
        depNodes.forEach(dep => {
            // Check if the dependency node has groupId, artifactId, and version.
            if (dep.groupId && dep.artifactId && dep.version) {
                 // Extract the groupId, artifactId, and version from the dependency node.
                 const groupId = dep.groupId[0];
                 const artifactId = dep.artifactId[0];
                 const version = dep.version[0];
                 // Create a unique name for the dependency using groupId and artifactId.
                 const name = `${groupId}:${artifactId}`;

                 // Find the line number by searching for the artifactId tag
                 let line = 0;
                 // Define the search string to find the line number of the dependency.
                 const searchString = `<artifactId>${artifactId}</artifactId>`;
                 // Find the index of the line containing the artifactId.
                 const lineIndex = lines.findIndex(l => l.includes(searchString));
                 // If the line is found, store the line number.
                 if (lineIndex !== -1) {
                     line = lineIndex;
                 }
                 
                 // Add the dependency to the dependencies array.
                 dependencies.push({ name, version, line });
            }
        });
        
        // Return the array of extracted dependencies.
        return dependencies;
    },

    /**
     * Fetches the license information for a given package name and version from Maven Central.
     * @param {string} packageName The name of the package (groupId:artifactId).
     * @param {string} packageVersion The version of the package.
     * @returns {Promise<object>} An object containing the license and homepage information.
     */
    async fetchLicenseInfo(packageName, packageVersion) {
        // Split the package name into groupId and artifactId.
        const [groupId, artifactId] = packageName.split(':');
        // Remove any special characters from the version string.
        const version = packageVersion.replace(/\$|\{|\}/g, ''); 

        // Construct the path to the pom.xml file in Maven Central.
        const groupPath = groupId.replace(/\./g, '/');
        const pomUrl = `https://repo1.maven.org/maven2/${groupPath}/${artifactId}/${version}/${artifactId}-${version}.pom`;
        
        try {
            // Fetch the content of the pom.xml file from Maven Central.
            const pomContent = await fetchText(pomUrl);
            // Create a new XML parser.
            const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
            // Parse the XML content into a JavaScript object.
            const pomData = await parser.parseStringPromise(pomContent);

            // Initialize the license variable.
            let license = 'N/A';
            // Extract the license information from the parsed pom.xml.
            if (pomData.project?.licenses?.license) {
                // Handle both single and multiple license definitions.
                const licenses = Array.isArray(pomData.project.licenses.license) 
                    ? pomData.project.licenses.license 
                    : [pomData.project.licenses.license];
                
                // Extract the license names and join them with ' OR '.
                license = licenses.map(l => l.name || 'N/A').join(' OR ');
            }

            // Return an object containing the license and homepage information.
            return {
                license: license || 'N/A',
                homepage: pomData.project?.url || `https://mvnrepository.com/artifact/${groupId}/${artifactId}/${version}`
            };

        } catch (error) {
            // Log an error message if fetching or parsing the pom.xml fails.
            console.error(`Failed to fetch/parse .pom for ${packageName}@${version}. URL: ${pomUrl}. Error: ${error.message}`);
            // Re-throw the error to be handled by the caller.
            throw error;
        }
    }
};

module.exports = javaMavenStrategy;