const vscode = require('vscode');
const path = require('path');
const fs = require('fs/promises'); // <-- เปลี่ยนมาใช้ fs/promises
const { getCache, setCache } = require('./caching');

// --- นำเข้า Strategies ทั้งหมด ---
const npmStrategy = require('../strategies/npmStrategy');
const composerStrategy = require('../strategies/composerStrategy');
const pythonPoetryStrategy = require('../strategies/pythonPoetryStrategy');
const javaMavenStrategy = require('../strategies/javaMavenStrategy');
const goModStrategy = require('../strategies/goModStrategy');
const rustCargoStrategy = require('../strategies/rustCargoStrategy');

// --- รวม Strategies ทั้งหมดไว้ใน Array เดียว ---
const ALL_STRATEGIES = [
    npmStrategy,
    composerStrategy,
    pythonPoetryStrategy,
    javaMavenStrategy,
    goModStrategy,
    rustCargoStrategy
];

/**
 * สแกน Workspace ทั้งหมดเพื่อหา Dependencies และข้อมูล License จากไฟล์ที่รองรับ
 * @param {vscode.ExtensionContext} context
 * @param {vscode.Progress<{ message?: string }>} progress
 * @returns {Promise<Array<Object>>} ข้อมูล dependency ทั้งหมดที่ผ่านการตรวจสอบแล้ว
 */
async function scanWorkspace(context, progress) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return [];
    }
    const rootPath = workspaceFolders[0].uri.fsPath;

    // อ่าน Policy จากการตั้งค่าของผู้ใช้
    const config = vscode.workspace.getConfiguration('license-sentinel');
    const policy = {
        allowed: config.get('allowedLicenses', []),
        denied: config.get('deniedLicenses', [])
    };

    let allProcessedDeps = [];

    // วนลูปตรวจสอบแต่ละ Strategy
    for (const strategy of ALL_STRATEGIES) {
        const manifestPath = path.join(rootPath, strategy.fileName);

        try {
            // ใช้ fs.access เพื่อตรวจสอบว่าไฟล์มีอยู่จริงหรือไม่ (จะ throw error ถ้าไม่มี)
            await fs.access(manifestPath);
            progress.report({ message: `Parsing ${strategy.fileName}...` });

            // อ่านไฟล์แบบ Asynchronous
            const content = await fs.readFile(manifestPath, 'utf8');
            const dependencies = await Promise.resolve(strategy.parseDependencies(content));

            const promises = Object.entries(dependencies).map(async ([name, version]) => {
                const cacheKey = `license-sentinel-${name}@${version}`;
                const cachedData = getCache(context, cacheKey);
                if (cachedData) {
                    return cachedData;
                }

                try {
                    progress.report({ message: `Fetching: ${name}...` });
                    const info = await strategy.fetchLicenseInfo(name, version);

                    let status = 'unknown';
                    if (policy.denied.length > 0 && policy.denied.includes(info.license)) {
                        status = 'non-compliant';
                    } else if (policy.allowed.includes(info.license)) {
                        status = 'compliant';
                    }

                    const result = {
                        name,
                        version,
                        status,
                        manifestFile: strategy.fileName,
                        ...info
                    };
                    setCache(context, cacheKey, result);
                    return result;
                } catch (error) {
                    console.error(`Failed to fetch info for ${name}:`, error);
                    return { name, version, license: 'Error', status: 'unknown', manifestFile: strategy.fileName, homepage: '' };
                }
            });

            const processed = await Promise.all(promises);
            allProcessedDeps.push(...processed);

        } catch (error) {
            // ถ้า error code เป็น ENOENT หมายถึงหาไฟล์ไม่เจอ ซึ่งเป็นเรื่องปกติ ไม่ต้องแสดง error
            if (error.code !== 'ENOENT') {
                console.error(`Failed to process ${strategy.fileName}:`, error);
                vscode.window.showErrorMessage(`Error processing ${strategy.fileName}. Please check its format.`);
            }
        }
    }
    return allProcessedDeps;
}

module.exports = { scanWorkspace };