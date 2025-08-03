// This file defines the strategy for parsing Java Maven's pom.xml files and fetching license information.
// ไฟล์นี้กำหนด strategy สำหรับการ parsing ไฟล์ pom.xml ของ Java Maven และดึงข้อมูล license

const { fetchWithHttps } = require('../utils/network'); // Import the fetchWithHttps function from the network utils. นำเข้าฟังก์ชัน fetchWithHttps จาก network utils
const xml2js = require('xml2js'); // Import the xml2js library for parsing XML files. นำเข้าไลบรารี xml2js สำหรับ parsing ไฟล์ XML

const javaMavenStrategy = {
    // The file name that this strategy handles. ชื่อไฟล์ที่ strategy นี้จัดการ
    fileName: 'pom.xml',

    /**
     * Parses the pom.xml file content and extracts the dependencies.
     * @param {string} fileContent The content of the pom.xml file.
     * @returns {object} An object containing the dependencies.
     */
    // Parses the pom.xml file content and extracts the dependencies.
    // Parse เนื้อหาไฟล์ pom.xml และดึง dependencies
    async parseDependencies(fileContent) {
        // Create a new XML parser. สร้าง XML parser ใหม่
        const parser = new xml2js.Parser();
        // Parse the XML file content into a JavaScript object. Parse เนื้อหาไฟล์ XML เป็น JavaScript object
        const pom = await parser.parseStringPromise(fileContent);
        // Extract the dependencies from the parsed pom. ดึง dependencies จาก pom ที่ถูก parse แล้ว
        const dependencies = pom.project?.dependencies?.[0]?.dependency || [];
        
        // Initialize an empty object to store the dependencies. สร้าง object ว่างเพื่อเก็บ dependencies
        const deps = {};
        // Iterate over each dependency. วนซ้ำแต่ละ dependency
        dependencies.forEach(dep => {
            // Check if the dependency has a groupId, artifactId, and version. ตรวจสอบว่า dependency มี groupId, artifactId และ version หรือไม่
            if (dep.groupId && dep.artifactId && dep.version) {
                 // Extract the groupId, artifactId, and version from the dependency. ดึง groupId, artifactId และ version จาก dependency
                 const groupId = dep.groupId[0];
                 const artifactId = dep.artifactId[0];
                 const version = dep.version[0];
                 // Add the dependency to the deps object using the format 'groupId:artifactId' as the key. เพิ่ม dependency ไปยัง object deps โดยใช้รูปแบบ 'groupId:artifactId' เป็น key
                 deps[`${groupId}:${artifactId}`] = version;
            }
        });
        // Return the dependencies object. คืนค่า object dependencies
        return deps;
    },

    /**
     * Fetches the license information for a given package name and version from Maven Central.
     * @param {string} packageName The name of the package (groupId:artifactId).
     * @param {string} packageVersion The version of the package.
     * @returns {Promise<object>} An object containing the license and homepage information.
     */
    // Fetches the license information for a given package name and version from Maven Central.
    // ดึงข้อมูล license สำหรับ package name และ version ที่กำหนดจาก Maven Central
    async fetchLicenseInfo(packageName, packageVersion) {
        // Split the package name into groupId and artifactId. แยก package name เป็น groupId และ artifactId
        const [groupId, artifactId] = packageName.split(':');
        // Clean up version string from potential Maven property placeholders. ทำความสะอาด version string จาก Maven property placeholders ที่อาจมี
        const version = packageVersion.replace(/\$|\{|\}/g, ''); 

        // Construct the URL to the .pom file directly from Maven Central. สร้าง URL ไปยังไฟล์ .pom โดยตรงจาก Maven Central
        const groupPath = groupId.replace(/\./g, '/');
        const pomUrl = `https://repo1.maven.org/maven2/${groupPath}/${artifactId}/${version}/${artifactId}-${version}.pom`;
        
        try {
            // Fetch the .pom file content. ดึงเนื้อหาไฟล์ .pom
            const pomContent = await fetchWithHttps(pomUrl);

            // Parse the fetched .pom XML content. Parse เนื้อหา XML ของ .pom ที่ดึงมา
            const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
            const pomData = await parser.parseStringPromise(pomContent);

            // Extract license information. ดึงข้อมูล license
            let license = 'N/A';
            // Check if the pomData contains license information. ตรวจสอบว่า pomData มีข้อมูล license หรือไม่
            if (pomData.project && pomData.project.licenses && pomData.project.licenses.license) {
                // Handle both single and multiple licenses. จัดการทั้ง single และ multiple licenses
                const licenses = Array.isArray(pomData.project.licenses.license) 
                    ? pomData.project.licenses.license 
                    : [pomData.project.licenses.license];
                
                // Extract the license names and join them with ' OR '. ดึงชื่อ license และรวมเข้าด้วยกันด้วย ' OR '
                license = licenses.map(l => l.name || 'N/A').join(' OR ');
            }

            // Return an object containing the license and homepage information. คืนค่า object ที่มีข้อมูล license และ homepage
            return {
                // Set the license, or 'N/A' if no license is found. ตั้งค่า license หรือ 'N/A' หากไม่พบ license
                license: license || 'N/A',
                // Set the homepage, or a default Maven Repository URL if no homepage is found. ตั้งค่า homepage หรือ URL ของ Maven Repository หากไม่พบ homepage
                homepage: (pomData.project && pomData.project.url) || `https://mvnrepository.com/artifact/${groupId}/${artifactId}/${version}`
            };

        } catch (error) {
            // Log the error message if fetching or parsing the .pom file fails. บันทึกข้อความ error หากการดึงหรือ parsing ไฟล์ .pom ล้มเหลว
            console.error(`Failed to fetch/parse .pom for ${packageName}@${version}. URL: ${pomUrl}. Error: ${error.message}`);
            // Re-throw the error so the scanner can handle it and display a specific message. Re-throw error เพื่อให้ scanner จัดการและแสดงข้อความที่เฉพาะเจาะจง
            throw error;
        }
    }
};

// Export the javaMavenStrategy object. 

// ส่งออก object javaMavenStrategy
module.exports = javaMavenStrategy;