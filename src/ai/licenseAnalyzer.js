// --- START OF FILE src/ai/licenseAnalyzer.js (ULTIMATE AI VERSION) ---

// This file contains functions for analyzing license policies and determining compliance.
// ไฟล์นี้มีฟังก์ชันสำหรับการวิเคราะห์นโยบายใบอนุญาตและตรวจสอบการปฏิบัติตามข้อกำหนด

// A more comprehensive list of keywords and their corresponding licenses.
const LICENSE_OBLIGATIONS = {
    discloseSource: {
        summary: "Source code must be disclosed if distributed.",
        risk: "high",
        licenses: ["gpl-2.0", "gpl-3.0", "agpl-3.0", "lgpl-2.1", "lgpl-3.0", "mpl-2.0", "cpl-1.0", "epl-1.0", "epl-2.0"]
    },
    sameLicense: {
        summary: "Modifications must be released under the same license (Copyleft).",
        risk: "high",
        licenses: ["gpl-2.0", "gpl-3.0", "agpl-3.0", "lgpl-2.1", "lgpl-3.0", "mpl-2.0"]
    },
    networkUseIsDistribution: {
        summary: "Use over a network may be considered distribution (AGPL).",
        risk: "high",
        licenses: ["agpl-3.0"]
    },
    stateChanges: {
        summary: "Changes to the licensed code must be stated.",
        risk: "medium",
        licenses: ["apache-2.0", "bsd-3-clause", "mpl-2.0", "lgpl-2.1", "lgpl-3.0"]
    },
    includeCopyright: {
        summary: "Must include the original copyright notice and license text.",
        risk: "medium",
        licenses: ["mit", "isc", "apache-2.0", "bsd-2-clause", "bsd-3-clause", "mpl-2.0", "epl-2.0"]
    },
    noLiability: {
        summary: "Provided 'as-is' without any warranty.",
        risk: "low",
        licenses: ["mit", "isc", "apache-2.0", "bsd-2-clause", "bsd-3-clause", "unlicense"]
    },
    noTrademark: {
        summary: "Cannot use trademarks of the original authors.",
        risk: "medium",
        licenses: ["apache-2.0"]
    }
};

// A greatly expanded map to convert common license names to their SPDX identifier.
const LICENSE_NAME_TO_SPDX = {
    'mit license': 'MIT',
    'the mit license': 'MIT',
    'apache license, version 2.0': 'Apache-2.0',
    'apache 2.0': 'Apache-2.0',
    'apache software license': 'Apache-2.0',
    'bsd license': 'BSD-3-Clause', // Default to 3-clause as it's common and safer
    'new bsd license': 'BSD-3-Clause',
    'modified bsd license': 'BSD-3-Clause',
    'simplified bsd license': 'BSD-2-Clause',
    'bsd 2-clause': 'BSD-2-Clause',
    'bsd 3-clause': 'BSD-3-Clause',
    'isc license': 'ISC',
    'mozilla public license 2.0': 'MPL-2.0',
    'mpl 2.0': 'MPL-2.0',
    'gnu general public license v2': 'GPL-2.0-only',
    'gnu general public license v3': 'GPL-3.0-only',
    'gnu lesser general public license v2.1': 'LGPL-2.1-only',
    'gnu lesser general public license v3': 'LGPL-3.0-only',
    'gnu affero general public license v3': 'AGPL-3.0-only',
    'zlib/libpng license': 'Zlib',
    'python software foundation license': 'Python-2.0',
    'historical permission notice and disclaimer': 'HPND',
    'public domain': 'CC0-1.0'
};

/**
 * Normalizes a single license string to a standard SPDX-like identifier.
 * This is the core intelligence of the analyzer.
 * @param {string} license The license string.
 * @returns {string} The normalized license identifier (in lowercase).
 */
function normalizeLicense(license) {
    if (!license) return '';
    
    let lowerLicense = license.toLowerCase().trim();

    // 1. Check for an exact match in our smart map first
    if (LICENSE_NAME_TO_SPDX[lowerLicense]) {
        return LICENSE_NAME_TO_SPDX[lowerLicense].toLowerCase();
    }

    // 2. Check for partial matches in the map keys
    for (const key in LICENSE_NAME_TO_SPDX) {
        if (lowerLicense.includes(key)) {
            return LICENSE_NAME_TO_SPDX[key].toLowerCase();
        }
    }
    
    // 3. Handle complex expressions like "WITH" and "+"
    // Remove "WITH" exceptions for policy matching, as the base license is the primary concern.
    // e.g., "GPL-2.0-only WITH Classpath-exception-2.0" -> "gpl-2.0-only"
    lowerLicense = lowerLicense.split(/\s*with\s/)[0];

    // Handle "or-later" expressions by matching against the base license.
    // e.g., "GPL-2.0+" -> "gpl-2.0-or-later", but for matching, we check for "gpl-2.0"
    // For simplicity in policy matching, we'll treat "GPL-2.0+" as "gpl-2.0-or-later"
    if (lowerLicense.endsWith('+')) {
        lowerLicense = `${lowerLicense.slice(0, -1)}-or-later`;
    }

    // 4. Fallback to advanced regex-based cleaning
    return lowerLicense
        .replace(/license/g, '')
        .replace(/\(and\)/g, 'or')
        .replace(/,\s*$/, '')
        .replace(/\s*v?(\d\.\d).*/, '-$1')
        .replace(/\s*(\d)-clause/, '-$1-clause')
        .replace(/[\s,()]/g, '-')
        .replace(/--+/, '-')
        .replace(/^-|-$/, '')
        .trim();
}

/**
 * Parses a complex license string (e.g., "MIT OR Apache-2.0") into an array of normalized identifiers.
 * @param {string} licenseString The full license string from the package manager.
 * @returns {string[]} An array of normalized license identifiers.
 */
function parseLicenseString(licenseString) {
    if (!licenseString || licenseString === 'N/A' || licenseString.startsWith('Error')) {
        return [];
    }
    // Handles expressions like "(MIT OR Apache-2.0)" or "MIT / Apache-2.0"
    return licenseString
        .split(/ or |\/|\(|\)/i)
        .map(part => normalizeLicense(part))
        .filter(part => part && part.length > 0); // Filter out empty strings from splitting
}


/**
 * Analyzes a license string against a given policy to determine compliance and obligations.
 * @param {string} licenseString The license string to analyze.
 * @param {object} policy An object containing allowed and denied licenses.
 * @returns {{status: 'compliant'|'non-compliant'|'unknown', reason: string, obligations: Array<{summary: string, risk: 'low'|'medium'|'high'}>}} Analysis result.
 */
function analyzeLicensePolicy(licenseString, policy) {
    const normalizedLicenses = parseLicenseString(licenseString);

    if (normalizedLicenses.length === 0) {
        return {
            status: 'unknown',
            reason: "Missing, invalid license data, or could not be parsed.",
            obligations: []
        };
    }
    
    let status = 'unknown';
    let reason = `License: "${licenseString}". `;
    
    // Policy check is now more robust.
    // We check if ANY of the parsed licenses are denied or allowed.
    let deniedMatch = null;
    let allowedMatch = null;

    for (const license of normalizedLicenses) {
        if (policy.denied.has(license)) {
            deniedMatch = license;
            break; // A single denied license is enough to fail compliance.
        }
        // Also check for "or-later" policies. If policy denies "gpl-2.0-or-later", and we find "gpl-3.0", it's denied.
        if (policy.denied.has(`${license.split('-')[0]}-or-later`)) {
             deniedMatch = `${license} (violates ${license.split('-')[0]}-or-later policy)`;
             break;
        }
    }

    if (!deniedMatch) {
         for (const license of normalizedLicenses) {
            if (policy.allowed.has(license)) {
                allowedMatch = license;
                break; // A single allowed license is enough to pass compliance in an "OR" expression.
            }
             // Handle "or-later" for allowed licenses. If policy allows "lgpl-2.1-or-later", then "lgpl-3.0" is compliant.
            const baseLicense = license.match(/([a-z]+)-(\d\.\d)/);
            if (baseLicense) {
                const baseName = baseLicense[1];
                const baseVersion = parseFloat(baseLicense[2]);
                if (policy.allowed.has(`${baseName}-2.1-or-later`) && baseVersion >= 2.1) {
                    allowedMatch = license;
                    break;
                }
                 if (policy.allowed.has(`${baseName}-3.0-or-later`) && baseVersion >= 3.0) {
                    allowedMatch = license;
                    break;
                }
            }
        }
    }


    if (deniedMatch) {
        status = 'non-compliant';
        reason += `It is NON-COMPLIANT because '${deniedMatch}' is on your denied list.`;
    } else if (allowedMatch) {
        status = 'compliant';
        reason += `It is COMPLIANT because '${allowedMatch}' is on your allowed list.`;
    } else {
        reason += `Its status is UNKNOWN. Normalized identifiers found: [${normalizedLicenses.join(', ')}]. Check if these are in your policies.`;
    }

    const obligations = [];
    const foundObligations = new Set(); 

    for (const license of normalizedLicenses) {
        const normalizedForObligation = license.replace(/-or-later|-only/, '');
        for (const [key, value] of Object.entries(LICENSE_OBLIGATIONS)) {
            if (value.licenses.includes(normalizedForObligation) && !foundObligations.has(key)) {
                obligations.push({ summary: value.summary, risk: value.risk });
                foundObligations.add(key);
            }
        }
    }

    return {
        status,
        reason,
        obligations
    };
}

module.exports = { analyzeLicensePolicy };
// --- END OF FILE src/ai/licenseAnalyzer.js (ULTIMATE AI VERSION) ---