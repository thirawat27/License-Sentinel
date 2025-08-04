// --- START OF FILE strategies/rustCargoStrategy.js (FINAL) ---

// This file defines the strategy for parsing Rust Cargo.toml files and fetching license information.
// ไฟล์นี้กำหนด strategy สำหรับการ parsing ไฟล์ Rust Cargo.toml และดึงข้อมูล license

const { fetchJson } = require('../utils/network');
const toml = require('toml');

const rustCargoStrategy = {
    fileName: 'Cargo.toml',

    /**
     * Parses the Cargo.toml file and extracts dependencies with their locations.
     * @param {string} fileContent The content of the Cargo.toml file.
     * @param {import('vscode').TextDocument} document The VS Code document object for position mapping.
     * @returns {Array<{name: string, version: string, line: number}>} An array of dependency objects.
     */
    parseDependencies(fileContent, document) {
        const dependencies = [];
        const parsedToml = toml.parse(fileContent);

        const allDeps = {
            ...(parsedToml.dependencies || {}),
            ...(parsedToml['dev-dependencies'] || {}),
            ...(parsedToml['build-dependencies'] || {})
        };

        const cleanedDeps = {};
        for (const [name, value] of Object.entries(allDeps)) {
            if (typeof value === 'string') {
                cleanedDeps[name] = value;
            } else if (typeof value === 'object' && value.version) {
                cleanedDeps[name] = value.version;
            } else {
                cleanedDeps[name] = "*";
            }
        }
        
        const lines = fileContent.split(/\r?\n/);
        let inDepsSection = false;
        const depSections = ['[dependencies]', '[dev-dependencies]', '[build-dependencies]'];
        const keyRegex = /^\s*([a-zA-Z0-9_-]+)\s*=/;

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (depSections.some(s => trimmedLine.startsWith(s))) {
                inDepsSection = true;
                return;
            }
            if (trimmedLine.startsWith('[')) {
                // This logic handles sections like [workspace.dependencies] or [target...]
                const isWorkspaceOrTarget = trimmedLine.includes('.dependencies]') || trimmedLine.startsWith('[target');
                if (isWorkspaceOrTarget) {
                    inDepsSection = true;
                } else {
                    inDepsSection = false;
                }
                return;
            }

            if (inDepsSection) {
                const match = trimmedLine.match(keyRegex);
                if (match && match[1]) {
                    const name = match[1];
                    if (cleanedDeps[name]) {
                        dependencies.push({
                            name,
                            version: cleanedDeps[name],
                            line: index
                        });
                    }
                }
            }
        });

        return dependencies;
    },

    /**
     * Fetches License information from crates.io API.
     * @param {string} packageName The name of the crate.
     * @returns {Promise<{license: string, homepage: string}>}
     */
    async fetchLicenseInfo(packageName) {
        const responseData = await fetchJson(`https://crates.io/api/v1/crates/${packageName}`);
        
        const latestVersionData = responseData.versions && responseData.versions[0];
        const crateData = responseData.crate;

        const license = (latestVersionData && latestVersionData.license) || 'N/A';
        const homepage = crateData.homepage || crateData.repository || `https://crates.io/crates/${packageName}`;
        
        return {
            license: license,
            homepage: homepage
        };
    }
};

module.exports = rustCargoStrategy;
// --- END OF FILE strategies/rustCargoStrategy.js (FINAL) ---