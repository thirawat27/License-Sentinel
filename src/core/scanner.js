// This file contains the core logic for scanning the workspace for dependency files and analyzing their licenses.
// ไฟล์นี้มีตรรกะหลักสำหรับการสแกน workspace เพื่อหาไฟล์ dependency และวิเคราะห์ licenses ของไฟล์เหล่านั้น

const vscode = require('vscode'); // Import the VS Code API. นำเข้า VS Code API
const fs = require('fs/promises'); // Import the file system module for reading files asynchronously. นำเข้าโมดูลระบบไฟล์สำหรับการอ่านไฟล์แบบอะซิงโครนัส
const { getCache, setCache } = require('./caching'); // Import caching functions for storing and retrieving dependency information. นำเข้าฟังก์ชัน caching สำหรับจัดเก็บและเรียกคืนข้อมูล dependency

// Import all strategies for different package managers.
// นำเข้า strategies ทั้งหมดสำหรับ package managers ที่แตกต่างกัน
const npmStrategy = require('../strategies/npmStrategy'); // Strategy for parsing npm package.json files. Strategy สำหรับ parsing ไฟล์ npm package.json
const composerStrategy = require('../strategies/composerStrategy'); // Strategy for parsing Composer composer.json files (PHP). Strategy สำหรับ parsing ไฟล์ Composer composer.json (PHP)
const pythonPoetryStrategy = require('../strategies/pythonPoetryStrategy'); // Strategy for parsing Python Poetry pyproject.toml files. Strategyสำหรับ parsing ไฟล์ Python Poetry pyproject.toml
const pythonRequirementsStrategy = require('../strategies/pythonRequirementsStrategy'); // Strategy for parsing Python pip requirements.txt files. Strategyสำหรับ parsing ไฟล์ Python pip requirements.txt
const javaMavenStrategy = require('../strategies/javaMavenStrategy'); // Strategy for parsing Java Maven pom.xml files. Strategy สำหรับ parsing ไฟล์ Java Maven pom.xml
const goModStrategy = require('../strategies/goModStrategy'); // Strategy for parsing Go Modules go.mod files. Strategy สำหรับ parsing ไฟล์ Go Modules go.mod
const rustCargoStrategy = require('../strategies/rustCargoStrategy'); // Strategy for parsing Rust Cargo.toml files. Strategy สำหรับ parsing ไฟล์ Rust Cargo.toml

const ALL_STRATEGIES = [
    npmStrategy, // npm strategy
    composerStrategy, // Composer strategy
    pythonPoetryStrategy, // Python Poetry strategy
    pythonRequirementsStrategy, // Python requirements.txt strategy
    javaMavenStrategy, // Java Maven strategy
    goModStrategy, // Go Modules strategy
    rustCargoStrategy // Rust Cargo strategy
];

// Create a map of file names to their corresponding strategies.
// สร้าง map ของชื่อไฟล์ไปยัง strategies ที่เกี่ยวข้อง
const strategyMap = new Map(ALL_STRATEGIES.map(s => [s.fileName, s]));
// Define a pattern for supported files to quickly find them in the workspace.
// กำหนด pattern สำหรับไฟล์ที่รองรับเพื่อค้นหาอย่างรวดเร็วใน workspace
const supportedFilesPattern = `{${ALL_STRATEGIES.map(s => s.fileName).join(',')}}`;

/**
 * Scans the workspace for dependency files, analyzes their licenses, and determines compliance based on configured policies.
 * สแกน workspace เพื่อหาไฟล์ dependency, วิเคราะห์ licenses ของไฟล์เหล่านั้น, และตรวจสอบ compliance ตามนโยบายที่กำหนด
 * @param {vscode.ExtensionContext} context The extension context. บริบทของ extension
 * @param {vscode.Progress} progress The progress reporter. ตัวรายงานความคืบหน้า
 * @returns {Promise<Array<object>>} A promise that resolves to an array of dependency objects with license information. Promise ที่ resolve เป็น array ของ objects dependency พร้อมข้อมูล license
 */
async function scanWorkspace(context, progress) {
    // Get the configuration settings for the extension.
    // ดึงการตั้งค่า configuration สำหรับ extension
    const config = vscode.workspace.getConfiguration('license-sentinel');
    // Get the exclude patterns from the configuration.
    // ดึง patterns ที่จะ exclude จาก configuration
    const excludePatterns = config.get('excludePatterns', []);

    // Find all manifest files in the workspace that match the supported files pattern, excluding those in the exclude patterns.
    // ค้นหาไฟล์ manifest ทั้งหมดใน workspace ที่ตรงกับ pattern ของไฟล์ที่รองรับ, ยกเว้นไฟล์ที่อยู่ใน patterns ที่จะ exclude
    const manifestFiles = await vscode.workspace.findFiles(`**/${supportedFilesPattern}`, `{${excludePatterns.join(',')}}`);

    // If no manifest files are found, show an information message and return an empty array.
    // หากไม่พบไฟล์ manifest, แสดงข้อความแจ้งเตือนและคืนค่า array ว่าง
    if (manifestFiles.length === 0) {
        vscode.window.showInformationMessage("LicenseSentinel: No supported dependency files found in the workspace.");
        return [];
    }

    // Define the license policy based on the configuration settings.
    // กำหนดนโยบาย license ตามการตั้งค่า configuration
    const policy = {
        // Allowed licenses (converted to lowercase for case-insensitive matching).
        // Licenses ที่ได้รับอนุญาต (แปลงเป็นตัวพิมพ์เล็กเพื่อการจับคู่ที่ไม่คำนึงถึงตัวพิมพ์)
        allowed: new Set(config.get('allowedLicenses', []).map(l => String(l).toLowerCase())),
        // Denied licenses (converted to lowercase for case-insensitive matching).
        // Licenses ที่ถูกปฏิเสธ (แปลงเป็นตัวพิมพ์เล็กเพื่อการจับคู่ที่ไม่คำนึงถึงตัวพิมพ์)
        denied: new Set(config.get('deniedLicenses', []).map(l => String(l).toLowerCase()))
    };

    // Array to store all processed dependencies.
    // Array เพื่อเก็บ dependencies ที่ประมวลผลทั้งหมด
    let allProcessedDeps = [];
    // Total number of manifest files to analyze.
    // จำนวนไฟล์ manifest ทั้งหมดที่จะวิเคราะห์
    const totalFiles = manifestFiles.length;
    // Report the initial progress message.
    // รายงานข้อความความคืบหน้าเริ่มต้น
    progress.report({ message: `Found ${totalFiles} manifest files to analyze...`, increment: 0 });

    // Iterate over each manifest file.
    // วนซ้ำแต่ละไฟล์ manifest
    for (const [index, fileUri] of manifestFiles.entries()) {
        // Extract the file name from the file URI.
        // ดึงชื่อไฟล์จาก file URI
        const fileName = fileUri.path.split('/').pop();
        // Get the strategy for the file name.
        // ดึง strategy สำหรับชื่อไฟล์
        const strategy = strategyMap.get(fileName);
        // Get the relative path of the file.
        // ดึง path สัมพัทธ์ของไฟล์
        const relativePath = vscode.workspace.asRelativePath(fileUri, false);

        // If no strategy is found for the file name, continue to the next file.
        // หากไม่พบ strategy สำหรับชื่อไฟล์, ดำเนินการต่อไฟล์ถัดไป
        if (!strategy) continue;

        // Report the progress message for the current file.
        // รายงานข้อความความคืบหน้าสำหรับไฟล์ปัจจุบัน
        progress.report({ message: `Processing (${index + 1}/${totalFiles}): ${relativePath}` });

        try {
            // Read the content of the manifest file.
            // อ่านเนื้อหาของไฟล์ manifest
            const content = await fs.readFile(fileUri.fsPath, 'utf8');
            // Parse the dependencies from the content using the strategy.
            // Parse dependencies จากเนื้อหาโดยใช้ strategy
            const dependencies = await Promise.resolve(strategy.parseDependencies(content));
            // Get the entries of the dependencies object.
            // ดึง entries ของ object dependencies
            const dependencyEntries = Object.entries(dependencies);
            // If there are no dependencies, continue to the next file.
            // หากไม่มี dependencies, ดำเนินการต่อไฟล์ถัดไป
            if (dependencyEntries.length === 0) continue;

            // Map each dependency entry to a promise that fetches the license information.
            // Map แต่ละ dependency entry ไปยัง promise ที่ดึงข้อมูล license
            const promises = dependencyEntries.map(async ([name, version]) => {
                // Create a cache key for the dependency.
                // สร้าง cache key สำหรับ dependency
                const cacheKey = `license-sentinel:${relativePath}:${name}@${version}`;
                // Get the cached data for the dependency.
                // ดึงข้อมูลที่ cached ไว้สำหรับ dependency
                const cachedData = getCache(context, cacheKey);
                // If there is cached data, return it.
                // หากมีข้อมูลที่ cached ไว้, คืนค่าข้อมูลนั้น
                if (cachedData) {
                    return cachedData;
                }

                try {
                    // Report the progress message for fetching the license information.
                    // รายงานข้อความความคืบหน้าสำหรับการดึงข้อมูล license
                    progress.report({ message: `Fetching: ${name}...` });
                    // Fetch the license information for the dependency using the strategy.
                    // ดึงข้อมูล license สำหรับ dependency โดยใช้ strategy
                    const info = await strategy.fetchLicenseInfo(name, version);
                    
                    // Split the license string into individual licenses and convert them to lowercase.
                    // แยก license string เป็น licenses แต่ละรายการและแปลงเป็นตัวพิมพ์เล็ก
                    const licenses = (info.license || 'N/A').split(/ OR |\/|\sOR\s/i).map(l => l.trim().toLowerCase());
                    // Initialize the status to 'unknown'.
                    // กำหนดค่าเริ่มต้นของ status เป็น 'unknown'
                    let status = 'unknown';
                    // Check if any of the licenses are on the denied list.
                    // ตรวจสอบว่ามี licenses ใด ๆ อยู่ในรายการ denied หรือไม่
                    const isDenied = licenses.some(l => policy.denied.has(l));
                    // Check if any of the licenses are on the allowed list.
                    // ตรวจสอบว่ามี licenses ใด ๆ อยู่ในรายการ allowed หรือไม่
                    const isAllowed = licenses.some(l => policy.allowed.has(l));

                    // If the dependency has a denied license, set the status to 'non-compliant'.
                    // หาก dependency มี license ที่ถูกปฏิเสธ, ตั้งค่า status เป็น 'non-compliant'
                    if (isDenied) {
                        status = 'non-compliant';
                    } else if (isAllowed) {
                        status = 'compliant';
                    }

                    // Create a result object with the dependency information.
                    // สร้าง object ผลลัพธ์พร้อมข้อมูล dependency
                    const result = {
                        name, // Dependency name. ชื่อ dependency
                        version, // Dependency version. เวอร์ชั่น dependency
                        status, // Compliance status. สถานะ compliance
                        manifestFile: relativePath, // Path to the manifest file. path ไปยังไฟล์ manifest
                        license: info.license || 'N/A', // License string. license string
                        homepage: info.homepage || '' // Dependency homepage. homepage ของ dependency
                    };
                    // Store the result in the cache.
                    // เก็บผลลัพธ์ใน cache
                    setCache(context, cacheKey, result);
                    // Return the result.
                    // คืนค่าผลลัพธ์
                    return result;
                } catch (error) {
                    // Handle errors that occur while fetching the license information.
                    // จัดการ errors ที่เกิดขึ้นขณะดึงข้อมูล license
                    let licenseMessage = 'Error'; // Default error message. ข้อความ error เริ่มต้น
                    if (error.statusCode === 404) { // If the dependency is not found. หากไม่พบ dependency
                        licenseMessage = 'Error: Not Found'; // Set the error message to 'Not Found'. ตั้งค่าข้อความ error เป็น 'Not Found'
                    } else if (error.statusCode === 'NETWORK_ERROR') { // If there is a network error. หากมี network error
                        licenseMessage = 'Error: Network'; // Set the error message to 'Network'. ตั้งค่าข้อความ error เป็น 'Network'
                     } else if (error.message.includes('Invalid JSON')) { // If the response is invalid JSON. หาก response เป็น JSON ที่ไม่ถูกต้อง
                         licenseMessage = 'Error: Invalid Response'; // Set the error message to 'Invalid Response'. ตั้งค่าข้อความ error เป็น 'Invalid Response'
                    }
                    // Return an object with the error message.
                    // คืนค่า object พร้อมข้อความ error
                    return { name, version, license: licenseMessage, status: 'unknown', manifestFile: relativePath, homepage: '' };
                }
            });

            // Wait for all the promises to resolve.
            // รอให้ promises ทั้งหมด resolve
            const processedFileDeps = await Promise.all(promises);
            // Add the processed dependencies to the array of all processed dependencies.
            // เพิ่ม dependencies ที่ประมวลผลไปยัง array ของ dependencies ที่ประมวลผลทั้งหมด
            allProcessedDeps.push(...processedFileDeps.filter(Boolean));

        } catch (error) {
            // Handle errors that occur while processing the manifest file.
            // จัดการ errors ที่เกิดขึ้นขณะประมวลผลไฟล์ manifest
            console.error(`Failed to process ${relativePath}:`, error);
            // Show an error message.
            // แสดงข้อความ error
            vscode.window.showErrorMessage(`Error processing ${relativePath}. Check its format and console for details.`);
        }
    }
    // Return the array of all processed dependencies.
    // คืนค่า array ของ dependencies ที่ประมวลผลทั้งหมด
    return allProcessedDeps;
}

// Export the scanWorkspace function.
// ส่งออกฟังก์ชัน scanWorkspace
module.exports = { scanWorkspace };