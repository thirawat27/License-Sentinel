const vscode = require('vscode');
const fs = require('fs/promises');
const { getCache, setCache } = require('./caching');

// Import all strategies
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

const strategyMap = new Map(ALL_STRATEGIES.map(s => [s.fileName, s]));
const supportedFilesPattern = `{${ALL_STRATEGIES.map(s => s.fileName).join(',')}}`;

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
        denied: new Set(config.get('deniedLicenses', []).map(l => String(l).toLowerCase()))
    };

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
            const content = await fs.readFile(fileUri.fsPath, 'utf8');
            const dependencies = await Promise.resolve(strategy.parseDependencies(content));
            const dependencyEntries = Object.entries(dependencies);
            if (dependencyEntries.length === 0) continue;

            const promises = dependencyEntries.map(async ([name, version]) => {
                const cacheKey = `license-sentinel:${relativePath}:${name}@${version}`;
                const cachedData = getCache(context, cacheKey);
                if (cachedData) {
                    return cachedData;
                }

                try {
                    progress.report({ message: `Fetching: ${name}...` });
                    const info = await strategy.fetchLicenseInfo(name, version);
                    
                    const licenses = (info.license || 'N/A').split(/ OR |\/|\sOR\s/i).map(l => l.trim().toLowerCase());
                    let status = 'unknown';
                    const isDenied = licenses.some(l => policy.denied.has(l));
                    const isAllowed = licenses.some(l => policy.allowed.has(l));

                    if (isDenied) {
                        status = 'non-compliant';
                    } else if (isAllowed) {
                        status = 'compliant';
                    }

                    const result = {
                        name,
                        version,
                        status,
                        manifestFile: relativePath,
                        license: info.license || 'N/A',
                        homepage: info.homepage || ''
                    };
                    setCache(context, cacheKey, result);
                    return result;
                } catch (error) {
                    let licenseMessage = 'Error';
                    if (error.statusCode === 404) {
                        licenseMessage = 'Error: Not Found';
                    } else if (error.statusCode === 'NETWORK_ERROR') {
                        licenseMessage = 'Error: Network';
                    } else if (error.message.includes('Invalid JSON')) {
                         licenseMessage = 'Error: Invalid Response';
                    }
                    return { name, version, license: licenseMessage, status: 'unknown', manifestFile: relativePath, homepage: '' };
                }
            });

            const processedFileDeps = await Promise.all(promises);
            allProcessedDeps.push(...processedFileDeps.filter(Boolean));

        } catch (error) {
            console.error(`Failed to process ${relativePath}:`, error);
            vscode.window.showErrorMessage(`Error processing ${relativePath}. Check its format and console for details.`);
        }
    }
    return allProcessedDeps;
}

module.exports = { scanWorkspace };