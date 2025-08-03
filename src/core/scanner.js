const vscode = require('vscode');
const path = require('path');
const fs = require('fs/promises');
const { getCache, setCache } = require('./caching');

// --- นำเข้า Strategies ทั้งหมด ---
const npmStrategy = require('../strategies/npmStrategy');
const composerStrategy = require('../strategies/composerStrategy');
const pythonPoetryStrategy = require('../strategies/pythonPoetryStrategy');
const javaMavenStrategy = require('../strategies/javaMavenStrategy');
const goModStrategy = require('../strategies/goModStrategy');
const rustCargoStrategy = require('../strategies/rustCargoStrategy');

const ALL_STRATEGIES = [
    npmStrategy,
    composerStrategy,
    pythonPoetryStrategy,
    javaMavenStrategy,
    goModStrategy,
    rustCargoStrategy
];

/**
 * สแกน Workspace เพื่อหา Dependencies และข้อมูล License
 * @param {vscode.ExtensionContext} context
 * @param {vscode.Progress<{ message?: string }>} progress
 * @param {string | null} specificManifest - ชื่อไฟล์ manifest ที่ต้องการสแกนโดยเฉพาะ (ถ้ามี)
 * @returns {Promise<Array<Object>>} ข้อมูล dependency ทั้งหมดที่ผ่านการตรวจสอบแล้ว
 */
async function scanWorkspace(context, progress, specificManifest = null) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return [];

    const rootPath = workspaceFolders[0].uri.fsPath;
    const config = vscode.workspace.getConfiguration('license-sentinel');
    const policy = {
        allowed: config.get('allowedLicenses', []),
        denied: config.get('deniedLicenses', [])
    };

    let allProcessedDeps = [];

    // ถ้ามีการระบุไฟล์มา ให้สแกนเฉพาะไฟล์นั้น
    const strategiesToRun = specificManifest
        ? ALL_STRATEGIES.filter(s => s.fileName === specificManifest)
        : ALL_STRATEGIES;

    for (const strategy of strategiesToRun) {
        const manifestPath = path.join(rootPath, strategy.fileName);

        try {
            const stats = await fs.stat(manifestPath);
            const fileCacheKey = `file-mtime-${strategy.fileName}`;
            const lastMtime = getCache(context, fileCacheKey);

            // ถ้าไฟล์ไม่มีการเปลี่ยนแปลง และไม่ได้เป็นการบังคับสแกนไฟล์เดียว ให้ข้ามไป
            if (lastMtime && lastMtime === stats.mtime.getTime() && !specificManifest) {
                // ดึงข้อมูลเก่ามาใช้ได้เลย
                const oldDeps = getCache(context, `deps-data-${strategy.fileName}`);
                if(oldDeps) allProcessedDeps.push(...oldDeps);
                continue;
            }

            progress.report({ message: `Parsing ${strategy.fileName}...` });
            const content = await fs.readFile(manifestPath, 'utf8');
            const dependencies = await Promise.resolve(strategy.parseDependencies(content));

            const promises = Object.entries(dependencies).map(([name, version]) =>
                fetchAndProcessDependency(context, progress, policy, strategy, name, version)
            );

            const processed = await Promise.all(promises);
            allProcessedDeps.push(...processed);

            // บันทึกข้อมูลการสแกนครั้งนี้ลงแคช
            setCache(context, fileCacheKey, stats.mtime.getTime());
            setCache(context, `deps-data-${strategy.fileName}`, processed);

        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Failed to process ${strategy.fileName}:`, error);
                vscode.window.showErrorMessage(`Error processing ${strategy.fileName}.`);
            }
        }
    }
    return allProcessedDeps;
}

/**
 * ดึงข้อมูล license, ตรวจสอบ และจัดรูปแบบ dependency
 */
async function fetchAndProcessDependency(context, progress, policy, strategy, name, version) {
    const cacheKey = `license-${name}@${version}`;
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

        const result = { name, version, status, manifestFile: strategy.fileName, ...info };
        setCache(context, cacheKey, result);
        return result;
    } catch (error) {
        console.error(`Failed to fetch info for ${name}:`, error);
        return { name, version, license: 'Error', status: 'unknown', manifestFile: strategy.fileName, homepage: '' };
    }
}

module.exports = { scanWorkspace };