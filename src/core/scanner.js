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

// Create a map for quick lookup from filename to strategy
const strategyMap = new Map(ALL_STRATEGIES.map(s => [s.fileName, s]));
const supportedFilesPattern = `{${ALL_STRATEGIES.map(s => s.fileName).join(',')}}`;

/**
 * Scans the entire workspace for supported dependency files and analyzes their licenses.
 * @param {vscode.ExtensionContext} context
 * @param {vscode.Progress<{ message?: string; increment?: number }>} progress
 * @returns {Promise<Array<Object>>} A promise resolving to an array of all processed dependencies.
 */
async function scanWorkspace(context, progress) {
    // Find all supported manifest files in the entire workspace, excluding common dependency folders
    const manifestFiles = await vscode.workspace.findFiles(`**/${supportedFilesPattern}`, '**/{node_modules,vendor,target,dist,build}/**');

    if (manifestFiles.length === 0) {
        vscode.window.showInformationMessage("LicenseSentinel: No supported dependency files found in the workspace.");
        return [];
    }

    const config = vscode.workspace.getConfiguration('license-sentinel');
    const policy = {
        allowed: config.get('allowedLicenses', []).map(l => String(l).toLowerCase()),
        denied: config.get('deniedLicenses', []).map(l => String(l).toLowerCase())
    };

    let allProcessedDeps = [];
    const totalFiles = manifestFiles.length;
    progress.report({ message: `Found ${totalFiles} manifest files to analyze...`, increment: 0 });

    for (const [index, fileUri] of manifestFiles.entries()) {
        const fileName = fileUri.path.split('/').pop();
        const strategy = strategyMap.get(fileName);
        const relativePath = vscode.workspace.asRelativePath(fileUri, false);

        if (!strategy) continue;

        progress.report({
            message: `Processing (${index + 1}/${totalFiles}): ${relativePath}`,
        });

        try {
            const content = await fs.readFile(fileUri.fsPath, 'utf8');
            const dependencies = await Promise.resolve(strategy.parseDependencies(content));

            const dependencyEntries = Object.entries(dependencies);
            if (dependencyEntries.length === 0) continue;

            const promises = dependencyEntries.map(async ([name, version]) => {
                // Use a more specific cache key including the file path to avoid collisions in monorepos
                const cacheKey = `license-sentinel:${relativePath}:${name}@${version}`;
                const cachedData = getCache(context, cacheKey);
                if (cachedData) {
                    return cachedData;
                }

                try {
                    // Report fetching progress for individual packages
                    progress.report({ message: `Fetching: ${name}...` });
                    const info = await strategy.fetchLicenseInfo(name, version);
                    const license = String(info.license || 'N/A').toLowerCase();

                    let status = 'unknown';
                    if (policy.denied.length > 0 && policy.denied.includes(license)) {
                        status = 'non-compliant';
                    } else if (policy.allowed.length > 0 && policy.allowed.includes(license)) {
                        status = 'compliant';
                    }

                    const result = {
                        name,
                        version,
                        status,
                        manifestFile: relativePath, // Use relative path for uniqueness and display
                        license: info.license || 'N/A',
                        homepage: info.homepage || ''
                    };
                    setCache(context, cacheKey, result);
                    return result;
                } catch (error) {
                    console.error(`Failed to fetch info for ${name} from ${relativePath}:`, error.message);
                    return { name, version, license: 'Error', status: 'unknown', manifestFile: relativePath, homepage: '' };
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