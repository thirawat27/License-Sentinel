const { fetchJson } = require('../utils/network');
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
                 // key จะเป็น groupId:artifactId
                 deps[`${groupId}:${artifactId}`] = version;
            }
        });
        return deps;
    },

    async fetchLicenseInfo(packageName) {
        // Maven Central API
        const [groupId, artifactId] = packageName.split(':');
        const response = await fetchJson(`https://search.maven.org/solrsearch/select?q=g:"${groupId}"+AND+a:"${artifactId}"&core=gav&rows=1&wt=json`);
        const doc = response.data.response.docs[0];
        
        if (!doc) return { license: 'N/A', homepage: `https://mvnrepository.com/artifact/${groupId}/${artifactId}` };

        // Attempting to fetch the POM file to get the license information is complex.
        // For simplicity, we will continue to mark it for manual check, which is a safer default.
        return {
            license: 'Check Manually', // Maven ecosystem often requires pom inspection for definitive license
            homepage: `https://mvnrepository.com/artifact/${groupId}/${artifactId}/${doc.v}`
        };
    }
};

module.exports = javaMavenStrategy;