// --- START OF FILE strategies/pythonPoetryStrategy.js (ULTIMATE FIX) ---

// This file defines the strategy for parsing Python Poetry's pyproject.toml files and fetching license information.
// ไฟล์นี้กำหนด strategy สำหรับการ parsing ไฟล์ pyproject.toml ของ Python Poetry และดึงข้อมูล license

const { fetchJson } = require('../utils/network');
const toml = require('toml');

const pythonPoetryStrategy = {
    fileName: 'pyproject.toml',

    /**
     * Parses the pyproject.toml file content and extracts dependencies with their locations.
     * @param {string} fileContent The content of the pyproject.toml file.
     * @param {import('vscode').TextDocument} document The VS Code document object for position mapping.
     * @returns {Array<{name: string, version: string, line: number}>} An array of dependency objects.
     */
    parseDependencies(fileContent, document) {
        const dependencies = [];
        try {
            const parsedToml = toml.parse(fileContent);
            
            const deps = { 
                ...(parsedToml.tool?.poetry?.dependencies || {}), 
                ...(parsedToml.tool?.poetry?.['dev-dependencies'] || {}) 
            };
            delete deps.python;

            const lines = fileContent.split(/\r?\n/);
            let inDepsSection = false;
            const depSections = ['[tool.poetry.dependencies]', '[tool.poetry.dev-dependencies]'];
            const keyRegex = /^\s*([a-zA-Z0-9_.-]+)\s*=/;

            lines.forEach((line, index) => {
                const trimmedLine = line.trim();
                if (depSections.includes(trimmedLine)) {
                    inDepsSection = true;
                    return;
                }
                if (trimmedLine.startsWith('[')) {
                    const isWorkspaceOrTarget = trimmedLine.includes('.dependencies]') || trimmedLine.startsWith('[target');
                    inDepsSection = isWorkspaceOrTarget;
                    return;
                }

                if (inDepsSection) {
                    const match = trimmedLine.match(keyRegex);
                    if (match && match[1]) {
                        const name = match[1];
                        if (deps[name]) {
                             dependencies.push({
                                name,
                                version: typeof deps[name] === 'string' ? deps[name] : deps[name].version || '*',
                                line: index
                            });
                        }
                    }
                }
            });
        } catch (e) {
            console.error("Failed to parse pyproject.toml:", e);
        }
        
        return dependencies;
    },

    /**
     * Fetches the license information for a given package name from the PyPI API.
     * This version is the most robust and handles edge cases like Pillow.
     * @param {string} packageName The name of the package.
     * @returns {Promise<object>} An object containing the license and homepage information.
     */
    async fetchLicenseInfo(packageName) {
        const responseData = await fetchJson(`https://pypi.org/pypi/${packageName}/json`);
        const info = responseData.info;
        
        let foundLicense = 'N/A';

        // --- NEW HIERARCHY FOR FINDING THE LICENSE ---
        // 1. Check for a specific license string in the 'license' field.
        //    This is often the most accurate if it's not empty.
        //    Pillow's license is "HPND" but it's listed as "Historical Permission Notice and Disclaimer"
        if (info.license && info.license.trim() !== '' && info.license.length < 100) { // Avoid long license texts
            foundLicense = info.license;
        }

        // 2. If the license field is not helpful, check the classifiers. This is the standard way.
        const classifiers = info.classifiers || [];
        const licenseClassifiers = classifiers.filter(c => c.startsWith('License :: OSI Approved ::'));

        if (licenseClassifiers.length > 0) {
            // If we find a standard OSI approved license, it's better than a custom string.
            foundLicense = licenseClassifiers.map(c => c.split('::').pop().trim()).join(' OR ');
        } 
        // 3. If still no specific license, but we have a non-empty license field from step 1, use that.
        //    (This condition is already handled by the initial assignment)

        // 4. As a last resort, check for any license classifier, even if not OSI approved.
        if (foundLicense === 'N/A') {
             const genericLicenseClassifier = classifiers.find(c => c.startsWith('License ::'));
             if (genericLicenseClassifier) {
                foundLicense = genericLicenseClassifier.split('::').pop().trim();
             }
        }
        
        // Final cleanup: if the result is something generic like "OSI Approved", it's not useful.
        if (foundLicense.toLowerCase().trim() === 'osi approved') {
            foundLicense = 'N/A';
        }

        // --- SPECIFIC FIX FOR PILLOW ---
        // Pillow's license is "HPND" (Historical Permission Notice and Disclaimer) but it's often listed as just "Pillow" or a long text.
        // The classifier for it is often just "License :: Other/Proprietary License".
        // Let's add a manual check.
        if (packageName.toLowerCase() === 'pillow' && foundLicense === 'N/A') {
             // After checking Pillow's metadata, its license is HPND, which is a permissive, BSD-style license.
             // We will manually set it here as a fallback.
             console.log("Applying manual fallback for Pillow license.");
             foundLicense = 'HPND'; // Historical Permission Notice and Disclaimer
        }


        return {
            license: foundLicense,
            homepage: info.project_url || info.home_page || `https://pypi.org/project/${packageName}`
        };
    }
};

module.exports = pythonPoetryStrategy;
// --- END OF FILE strategies/pythonPoetryStrategy.js (ULTIMATE FIX) ---