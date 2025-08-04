// This file contains the core logic for scanning the workspace for dependency files and analyzing their licenses.
const vscode = require('vscode');
const { getCache, setCache } = require('./caching');
const { analyzeLicensePolicy } = require('../ai/licenseAnalyzer');

// Import all strategies for different package managers.
const npmStrategy = require('../strategies/npmStrategy');
const composerStrategy = require('../strategies/composerStrategy');
const pythonPoetryStrategy = require('../strategies/pythonPoetryStrategy');
const pythonRequirementsStrategy = require('../strategies/pythonRequirementsStrategy');
const javaMavenStrategy = require('../strategies/javaMavenStrategy');
const goModStrategy = require('../strategies/goModStrategy');
const rustCargoStrategy = require('../strategies/rustCargoStrategy');

// Define an array containing all supported dependency file strategies.
const ALL_STRATEGIES = [
    npmStrategy,
    composerStrategy,
    pythonPoetryStrategy,
    pythonRequirementsStrategy,
    javaMavenStrategy,
    goModStrategy,
    rustCargoStrategy
];

// Create a map for quick lookup of strategies by file name.
const strategyMap = new Map(ALL_STRATEGIES.map(s => [s.fileName, s]));
// Define a pattern to match all supported dependency files.
const supportedFilesPattern = `{${ALL_STRATEGIES.map(s => s.fileName).join(',')}}`;

/**
 * Processes an array of asynchronous tasks with a limited concurrency.
 * This function ensures that not too many tasks run at the same time, preventing resource exhaustion.
 * @param {Array<Function>} tasks An array of functions, each representing an asynchronous task.
 * @param {number} concurrency The maximum number of tasks to run concurrently.
 * @returns {Promise<Array<any>>} A promise that resolves to an array of results from the tasks.
 */
async function processWithConcurrency(tasks, concurrency) {
    // Initialize an array to store the results of the tasks.
    const results = new Array(tasks.length);
    // Keep track of the current task index.
    let taskIndex = 0;

    // Define an asynchronous worker function.
    async function worker() {
        // Keep processing tasks until all tasks are completed.
        while (taskIndex < tasks.length) {
            // Get the index of the current task and increment the task index.
            const currentIndex = taskIndex++;
            // Get the task at the current index.
            const task = tasks[currentIndex];
            // If the task exists.
            if (task) {
                try {
                    // Execute the task and store the result.
                    results[currentIndex] = await task();
                } catch (error) {
                    // If an error occurs, store the error in the results array.
                    results[currentIndex] = error;
                }
            }
        }
    }

    // Create an array of worker promises and start them.
    const workers = Array(concurrency).fill(null).map(worker);
    // Wait for all workers to complete.
    await Promise.all(workers);
    // Return the array of results.
    return results;
}

/**
 * Scans the workspace for dependency files and analyzes their licenses.
 * This is the main function that orchestrates the license scanning process.
 * @param {vscode.ExtensionContext} context The extension context.
 * @param {vscode.Progress} progress A progress object to report progress to the user.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of dependency objects with license information.
 */
async function scanWorkspace(context, progress) {
    // Get the configuration settings for the extension.
    const config = vscode.workspace.getConfiguration('license-sentinel');
    // Get the exclude patterns from the configuration.
    const excludePatterns = config.get('excludePatterns', []);
    // Find all manifest files in the workspace, excluding those that match the exclude patterns.
    const manifestFiles = await vscode.workspace.findFiles(`**/${supportedFilesPattern}`, `{${excludePatterns.join(',')}}`);

    // If no manifest files are found, show an information message and return an empty array.
    if (manifestFiles.length === 0) {
        vscode.window.showInformationMessage("LicenseSentinel: No supported dependency files found in the workspace.");
        return [];
    }
    
    // Define the license policy based on the configuration settings.
    const policy = {
        allowed: new Set(config.get('allowedLicenses', []).map(l => String(l).toLowerCase())),
        denied: new Set(config.get('deniedLicenses', []).map(l => String(l).toLowerCase())),
        overrides: config.get('policyOverrides', [])
    };
    // Get the concurrency limit from the configuration.
    const concurrency = config.get('concurrencyLimit', 10);

    // Initialize an array to store all processed dependencies.
    let allProcessedDeps = [];
    // Get the total number of manifest files.
    const totalFiles = manifestFiles.length;
    // Report the initial progress message.
    progress.report({ message: `Found ${totalFiles} manifest files to analyze...`, increment: 0 });

    // Iterate over each manifest file.
    for (const [index, fileUri] of manifestFiles.entries()) {
        // Extract the file name from the file URI.
        const fileName = fileUri.path.split('/').pop();
        // Get the strategy for the current file name.
        const strategy = strategyMap.get(fileName);
        // Get the relative path of the file within the workspace.
        const relativePath = vscode.workspace.asRelativePath(fileUri, false);

        // If no strategy is found for the file name, skip to the next file.
        if (!strategy) continue;

        // Report the progress message for the current file.
        progress.report({ message: `Processing (${index + 1}/${totalFiles}): ${relativePath}` });

        try {
            // Open the text document for the current file.
            const document = await vscode.workspace.openTextDocument(fileUri);
            // Get the content of the document.
            const content = document.getText();
            // Parse the dependencies from the file content using the appropriate strategy.
            const dependencies = await Promise.resolve(strategy.parseDependencies(content, document));
            
            // If no dependencies are found, skip to the next file.
            if (dependencies.length === 0) continue;

            // Create an array of tasks to fetch license information for each dependency.
            const tasks = dependencies.map(dep => async () => {
                // Extract the dependency name, version, and line number.
                const { name, version, line } = dep;
                // Create a cache key for the dependency.
                const cacheKey = `license-sentinel:${relativePath}:${name}@${version}`;
                // Check if the dependency information is cached.
                const cachedData = getCache(context, cacheKey);
                // If the dependency information is cached, return it.
                if (cachedData) {
                    return { ...cachedData, line };
                }

                try {
                    // Report the progress message for fetching the license information.
                    progress.report({ message: `Fetching: ${name}...` });
                    // Fetch the license information for the dependency using the appropriate strategy.
                    const info = await strategy.fetchLicenseInfo(name, version);
                    
                    // Check if there is a policy override for the dependency.
                    const override = policy.overrides.find(o => o.name === name && (!o.version || o.version === version));
                    let analysis;

                    // If there is a policy override, use it to determine the dependency's status.
                    if (override) {
                        analysis = {
                            status: override.allow ? 'compliant' : 'non-compliant',
                            reason: `Policy override: ${override.reason}`,
                            obligations: []
                        };
                    } else {
                        // Otherwise, analyze the license policy using the fetched license information.
                        analysis = analyzeLicensePolicy(info.license || 'N/A', policy);
                    }

                    // Create a result object with the dependency information and analysis.
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

                    // Cache the result.
                    setCache(context, cacheKey, result);
                    // Return the result.
                    return result;

                } catch (error) {
                    // If an error occurs while fetching the license information, create an error message.
                    let licenseMessage = 'Error';
                    if (error.statusCode === 404) licenseMessage = 'Error: Not Found';
                    else if (error.statusCode === 'NETWORK_ERROR') licenseMessage = 'Error: Network';
                    else if (error.message.includes('Invalid JSON')) licenseMessage = 'Error: Invalid Response';
                    
                    // Return an object indicating the error.
                    return { 
                        name, version, license: licenseMessage, status: 'unknown', manifestFile: relativePath, homepage: '', line,
                        analysis: { status: 'unknown', reason: `Failed to fetch info: ${error.message}`, obligations: [] }
                    };
                }
            });

            // Process the tasks with the specified concurrency limit.
            const processedFileDeps = await processWithConcurrency(tasks.map(t => () => t()), concurrency);
            // Add the processed dependencies to the array of all processed dependencies.
            allProcessedDeps.push(...processedFileDeps.filter(Boolean));

        } catch (error) {
            // If an error occurs while processing the file, log the error and show an error message.
            console.error(`Failed to process ${relativePath}:`, error);
            vscode.window.showErrorMessage(`Error processing ${relativePath}. Check its format and console for details.`);
        }
    }
    // Return the array of all processed dependencies.
    return allProcessedDeps;
}

// Export the scanWorkspace function.
module.exports = { scanWorkspace };