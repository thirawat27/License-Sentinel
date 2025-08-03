const xml2js = require('xml2js');

const javaMavenStrategy = {
    fileName: 'pom.xml',

    async parseDependencies(fileContent) {
        const parser = new xml2js.Parser();
        const pom = await parser.parseStringPromise(fileContent);
        const dependencies = pom.project?.dependencies?.[0]?.dependency || [];
        
        const deps = {};
        dependencies.forEach(dep => {
            const groupId = dep.groupId[0];
            const artifactId = dep.artifactId[0];
            const version = dep.version[0];
            // key จะเป็น groupId:artifactId
            deps[`${groupId}:${artifactId}`] = version;
        });
        return deps;
    },

    async fetchLicenseInfo(packageName) {
        // Maven Central API
        const [groupId, artifactId] = packageName.split(':');
        const response = await fetch(`https://search.maven.org/solrsearch/select?q=g:"${groupId}"+AND+a:"${artifactId}"&core=gav&rows=1&wt=json`);
        const data = await response.json();
        const doc = data.response.docs[0];
        if (!doc) return { license: 'N/A', homepage: '' };

        // Maven ไม่มี API สำหรับ License โดยตรง, ต้องดึงจาก pom อีกที
        // เพื่อความง่าย จะแสดงผลว่า 'Check Manually'
        return {
            license: 'Check Manually',
            homepage: `https://mvnrepository.com/artifact/${groupId}/${artifactId}/${doc.v}`
        };
    }
};

module.exports = javaMavenStrategy;