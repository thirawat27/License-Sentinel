// This file defines the strategy for parsing Rust Cargo.toml files and fetching license information.
// ไฟล์นี้กำหนด strategy สำหรับการ parsing ไฟล์ Rust Cargo.toml และดึงข้อมูล license

const { fetchJson } = require('../utils/network'); // Import the fetchJson function from the network utils. นำเข้าฟังก์ชัน fetchJson จาก network utils
const toml = require('toml'); // Import the toml library for parsing TOML files. นำเข้าไลบรารี toml สำหรับ parsing ไฟล์ TOML

/**
 * Strategy for scanning Rust Dependencies (Cargo).
 * Strategy สำหรับการสแกน Dependencies ของ Rust (Cargo)
 */
const rustCargoStrategy = {
    // The file name that this strategy handles. ชื่อไฟล์ที่ strategy นี้จัดการ
    fileName: 'Cargo.toml',

    /**
     * Reads the Cargo.toml file and extracts the list of dependencies.
     * @param {string} fileContent The content of the Cargo.toml file.
     * @returns {Object} An object of dependencies.
     */
    // อ่านไฟล์ Cargo.toml และดึงรายชื่อ dependencies ออกมา
    // @param {string} fileContent เนื้อหาของไฟล์ Cargo.toml
    // @returns {Object} อ็อบเจกต์ของ dependencies
    parseDependencies(fileContent) {
        // Parse the TOML content of the file. Parse เนื้อหา TOML ของไฟล์
        const parsedToml = toml.parse(fileContent);
        // Extract dependencies, dev-dependencies, and build-dependencies from the parsed TOML. ดึง dependencies, dev-dependencies, และ build-dependencies จาก TOML ที่ถูก parse แล้ว
        const dependencies = parsedToml.dependencies || {};
        const devDependencies = parsedToml['dev-dependencies'] || {};
        const buildDependencies = parsedToml['build-dependencies'] || {};
        
        // Combine all dependencies into one object. รวม dependencies ทั้งหมดเป็น object เดียว
        const allDeps = { ...dependencies, ...devDependencies, ...buildDependencies };
        // Initialize an empty object to store cleaned dependencies. สร้าง object ว่างเพื่อเก็บ dependencies ที่ clean แล้ว
        const cleanedDeps = {};

        // Cargo.toml can have dependencies in complex object formats.
        // Cargo.toml สามารถมี dependency ในรูปแบบ object ที่ซับซ้อนได้
        // We simplify it by only taking the name and version.
        // เราจะทำให้มันง่ายขึ้นโดยเอาแค่ชื่อกับเวอร์ชัน
        for (const [name, value] of Object.entries(allDeps)) {
            // If the value is a string, it's a simple version declaration. ถ้า value เป็น string, แสดงว่าเป็น version declaration แบบง่าย
            if (typeof value === 'string') {
                // Add the dependency with its version to the cleaned dependencies. เพิ่ม dependency พร้อม version ไปยัง cleaned dependencies
                cleanedDeps[name] = value;
            // If the value is an object and has a version property, use that version. ถ้า value เป็น object และมี property version, ให้ใช้ version นั้น
            } else if (typeof value === 'object' && value.version) {
                // Add the dependency with its version to the cleaned dependencies. เพิ่ม dependency พร้อม version ไปยัง cleaned dependencies
                cleanedDeps[name] = value.version;
            // If the value is an object and does not have a version property, treat as latest. ถ้า value เป็น object และไม่มี property version, ให้ถือว่าเป็น latest
            } else if (typeof value === 'object' && !value.version) {
                 // Add the dependency with "*" as version to the cleaned dependencies. เพิ่ม dependency พร้อม "*" เป็น version ไปยัง cleaned dependencies
                 cleanedDeps[name] = "*"; // No version specified, treat as latest
            }
        }
        
        // Return the cleaned dependencies object. คืนค่า object cleaned dependencies
        return cleanedDeps;
    },

    /**
     * Fetches License information from crates.io API.
     * @param {string} packageName The name of the crate.
     * @returns {Promise<{license: string, homepage: string}>}
     */
    // ดึงข้อมูล License จาก crates.io API
    // @param {string} packageName ชื่อของ crate
    // @returns {Promise<{license: string, homepage: string}>}
    async fetchLicenseInfo(packageName) {
        // crates.io API
        // Fetch the main crate data, which includes information on all versions.
        // ดึงข้อมูล crate หลัก, ซึ่งมีข้อมูลเกี่ยวกับทุก versions
        const responseData = await fetchJson(`https://crates.io/api/v1/crates/${packageName}`);
        
        // --- START: Modified Section ---
        // --- START: ส่วนที่แก้ไข ---
        // The most recent version's data is in the first element of the 'versions' array.
        // ข้อมูล version ล่าสุดอยู่ใน element แรกของ array 'versions'
        // This is more reliable than the top-level 'crate.license' which can be null.
        // นี่น่าเชื่อถือกว่า 'crate.license' ระดับบนสุดซึ่งอาจเป็น null
        const latestVersionData = responseData.versions && responseData.versions[0];
        // Get the crate data. ดึงข้อมูล crate
        const crateData = responseData.crate;

        // Get license from the latest version, which is the most accurate source.
        // รับ license จาก version ล่าสุด, ซึ่งเป็นแหล่งที่แม่นยำที่สุด
        const license = (latestVersionData && latestVersionData.license) || 'N/A';

        // Homepage and repository are usually on the main crate object.
        // Homepage และ repository มักจะอยู่ใน object crate หลัก
        const homepage = crateData.homepage || crateData.repository || `https://crates.io/crates/${packageName}`;
        
        // Return an object containing the license and homepage information. คืนค่า object ที่มีข้อมูล license และ homepage
        return {
            // Set the license. ตั้งค่า license
            license: license,
            // Set the homepage. ตั้งค่า homepage
            homepage: homepage
        };
        // --- END: Modified Section ---
        // --- END: ส่วนที่แก้ไข ---
    }
};

// Export the rustCargoStrategy object. ส่งออก object rustCargoStrategy
module.exports = rustCargoStrategy;