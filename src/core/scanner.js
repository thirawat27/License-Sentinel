// --- START OF FILE src/core/scanner.js (FIXED FOR NEW STRUCTURE) ---

// This file contains the core logic for scanning the workspace for dependency files and analyzing their licenses.
const vscode = require('vscode');
const { getCache, setCache } = require('./caching');
// --- FIX 1: Path to licenseAnalyzer is now in ../ai/ ---
const { analyzeLicensePolicy } = require('../ai/licenseAnalyzer'); 

// Import all strategies for different package managers.
const npmStrategy = require('../strategies/npmStrategy');
const composerStrategy = require('../strategies/composerStrategy');
const pythonPoetryStrategy = require('../strategies/pythonPoetryStrategy');
// --- FIX 2: Add the new requirements strategy ---
const pythonRequirementsStrategy = require('../strategies/pythonRequirementsStrategy');
const javaMavenStrategy = require('../strategies/javaMavenStrategy');
const goModStrategy = require('../strategies/goModStrategy');
const rustCargoStrategy = require('../strategies/rustCargoStrategy');

const ALL_STRATEGIES = [
    npmStrategy,
    composerStrategy,
    pythonPoetryStrategy,
    pythonRequirementsStrategy, // <-- ADDED
    javaMavenStrategy,
    goModStrategy,
    rustCargoStrategy
];
const strategyMap = new Map(ALL_STRATEGIES.map(s => [s.fileName, s]));
const supportedFilesPattern = `{${ALL_STRATEGIES.map(s => s.fileName).join(',')}}`;

// ... (ส่วนที่เหลือของไฟล์เหมือนเดิมทุกประการ) ...

async function processWithConcurrency(tasks, concurrency) {
    const results = new Array(tasks.length);
    let taskIndex = 0;

    async function worker() {
        while (taskIndex < tasks.length) {
            const currentIndex = taskIndex++;
            const task = tasks[currentIndex];
            if (task) {
                try {
                    results[currentIndex] = await task();
                } catch (error) {
                    results[currentIndex] = error;
                }
            }
        }
    }

    const workers = Array(concurrency).fill(null).map(worker);
    await Promise.all(workers);
    return results;
}

async function scanWorkspace(context, progress) {
    const config = vscode.workspace.getConfiguration('license-sentinel');
    const excludePatterns = config.get('excludePatterns', []);
    const manifestFiles = await vscode.workspace.findFiles(`**/${supportedFilesPattern}`, `{${excludePatterns.join(',')}}`);

    if (manifestFiles.length === 0) {
        vscode.window.showInformationMessage("LicenseSentinel: No supported dependency files found in the workspace.");
        return [];
    }
    
    const policy = {
        allowed: new Set(config.get('allowedLicenses', []).map(l => String(l).toLowerCase())),
        denied: new Set(config.get('deniedLicenses', []).map(l => String(l).toLowerCase())),
        overrides: config.get('policyOverrides', [])
    };
    const concurrency = config.get('concurrencyLimit', 10);

    let allProcessedDeps = [];
    const totalFiles = manifestFiles.length;
    progress.report({ message: `Found ${totalFiles} manifest files to analyze...`, increment: 0 });

    for (const [index, fileUri] of manifestFiles.entries()) {
        const fileName = fileUri.path.split('/').pop();
        const strategy = strategyMap.get(fileName);
        const relativePath = vscode.workspace.asRelativePath(fileUri, false);

        if (!strategy) continue;

        progress.report({ message: `Processing (${index + 1}/${totalFiles}): ${relativePath}` });

        try {
            const document = await vscode.workspace.openTextDocument(fileUri);
            const content = document.getText();
            const dependencies = await Promise.resolve(strategy.parseDependencies(content, document));
            
            if (dependencies.length === 0) continue;

            const tasks = dependencies.map(dep => async () => {
                const { name, version, line } = dep;
                const cacheKey = `license-sentinel:${relativePath}:${name}@${version}`;
                const cachedData = getCache(context, cacheKey);
                if (cachedData) {
                    return { ...cachedData, line };
                }

                try {
                    progress.report({ message: `Fetching: ${name}...` });
                    const info = await strategy.fetchLicenseInfo(name, version);
                    
                    const override = policy.overrides.find(o => o.name === name && (!o.version || o.version === version));
                    let analysis;

                    if (override) {
                        analysis = {
                            status: override.allow ? 'compliant' : 'non-compliant',
                            reason: `Policy override: ${override.reason}`,
                            obligations: []
                        };
                    } else {
                        analysis = analyzeLicensePolicy(info.license || 'N/A', policy);
                    }

                    const result = {
                        name,
                        version,
                        status: analysis.status,
                        manifestFile: relativePath,
                        license: info.license || 'N/A',
                        homepage: info.homepage || '',
                        line,
                        analysis
                    };

                    setCache(context, cacheKey, result);
                    return result;

                } catch (error) {
                    let licenseMessage = 'Error';
                    if (error.statusCode === 404) licenseMessage = 'Error: Not Found';
                    else if (error.statusCode === 'NETWORK_ERROR') licenseMessage = 'Error: Network';
                    else if (error.message.includes('Invalid JSON')) licenseMessage = 'Error: Invalid Response';
                    
                    return { 
                        name, version, license: licenseMessage, status: 'unknown', manifestFile: relativePath, homepage: '', line,
                        analysis: { status: 'unknown', reason: `Failed to fetch info: ${error.message}`, obligations: [] }
                    };
                }
            });

            const processedFileDeps = await processWithConcurrency(tasks.map(t => () => t()), concurrency);
            allProcessedDeps.push(...processedFileDeps.filter(Boolean));

        } catch (error) {
            console.error(`Failed to process ${relativePath}:`, error);
            vscode.window.showErrorMessage(`Error processing ${relativePath}. Check its format and console for details.`);
        }
    }
    return allProcessedDeps;
}

module.exports = { scanWorkspace };
// --- END OF FILE src/core/scanner.js (FIXED FOR NEW STRUCTURE) ---