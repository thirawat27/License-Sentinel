// --- START OF FILE src/ai/licenseAnalyzer.js (FINAL & SMARTEST) ---

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

// --- NEW: Smart License Identifier Mapping ---
// A map to convert common license names to their SPDX identifier.
// Map สำหรับแปลงชื่อ license ทั่วไปให้เป็น SPDX identifier
const LICENSE_NAME_TO_SPDX = {
    'mit license': 'MIT',
    'apache license, version 2.0': 'Apache-2.0',
    'apache 2.0': 'Apache-2.0',
    'bsd license': 'BSD-3-Clause', // Default to 3-clause as it's common, can be ambiguous
    'new bsd license': 'BSD-3-Clause',
    'simplified bsd license': 'BSD-2-Clause',
    'isc license': 'ISC',
    'mozilla public license 2.0': 'MPL-2.0',
    'gnu gpl v3': 'GPL-3.0-only',
    'gnu lgpl v3': 'LGPL-3.0-only',
};

/**
 * Normalizes a license string to a standard SPDX-like identifier.
 * This version is smarter and uses a mapping first.
 * @param {string} license The license string.
 * @returns {string} The normalized license identifier (in lowercase).
 */
function normalizeLicense(license) {
    if (!license) return '';
    
    const lowerLicense = license.toLowerCase().trim();

    // 1. Check for an exact match in our smart map
    if (LICENSE_NAME_TO_SPDX[lowerLicense]) {
        return LICENSE_NAME_TO_SPDX[lowerLicense].toLowerCase();
    }

    // 2. Check for partial matches in the map keys
    for (const key in LICENSE_NAME_TO_SPDX) {
        if (lowerLicense.includes(key)) {
            return LICENSE_NAME_TO_SPDX[key].toLowerCase();
        }
    }
    
    // 3. Fallback to regex-based cleaning for common patterns if no map entry found
    // This handles cases like "BSD 3-Clause License" -> "bsd-3-clause"
    return lowerLicense
        .replace(/license/g, '')      // remove the word "license"
        .replace(/\(and\)/g, 'or')     // treat 'and' as 'or' for splitting
        .replace(/,\s*$/, '')         // remove trailing commas
        .replace(/\s*v?(\d\.\d).*/, '-$1') // normalize version "2.0" -> "-2.0"
        .replace(/\s*(\d)-clause/, '-$1-clause') // normalize "3-Clause" -> "-3-clause"
        .replace(/[\s,()]/g, '-')      // replace spaces, commas, parens with dashes
        .replace(/--+/, '-')           // collapse multiple dashes
        .replace(/^-|-$/, '')          // remove leading/trailing dashes
        .trim();
}


/**
 * Analyzes a license string against a given policy to determine compliance and obligations.
 * @param {string} licenseString The license string to analyze.
 * @param {object} policy An object containing allowed and denied licenses.
 * @returns {{status: 'compliant'|'non-compliant'|'unknown', reason: string, obligations: Array<{summary: string, risk: 'low'|'medium'|'high'}>}} Analysis result.
 */
function analyzeLicensePolicy(licenseString, policy) {
    if (!licenseString || licenseString === 'N/A' || licenseString.startsWith('Error')) {
        return {
            status: 'unknown',
            reason: "Missing or invalid license data.",
            obligations: []
        };
    }

    // Normalize and split the license string (e.g., "MIT OR Apache-2.0")
    const individualLicenses = licenseString.split(/ OR |\/|\sOR\s/i);
    // --- FIX: Apply the new, smarter normalization to each part ---
    const normalizedLicenses = individualLicenses.map(l => normalizeLicense(l));
    
    let status = 'unknown';
    let reason = `License: "${licenseString}". `;
    
    // The policy lists (allowed, denied) are already lowercased in scanner.js
    const deniedMatch = normalizedLicenses.find(l => l && policy.denied.has(l));
    const allowedMatch = normalizedLicenses.find(l => l && policy.allowed.has(l));

    if (deniedMatch) {
        status = 'non-compliant';
        reason += `It is NON-COMPLIANT because '${deniedMatch}' is on your denied list.`;
    } else if (allowedMatch) {
        status = 'compliant';
        reason += `It is COMPLIANT because '${allowedMatch}' is on your allowed list.`;
    } else {
        // More helpful "unknown" message
        reason += `Its status is UNKNOWN. Normalized identifiers found: [${normalizedLicenses.join(', ')}]. Check if these are in your policies.`;
    }

    // Analyze obligations based on all found licenses
    const obligations = [];
    const foundObligations = new Set(); 

    for (const license of normalizedLicenses) {
        const normalizedForObligation = license.replace(/\(|\)/g, '');
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

// Export the analyzeLicensePolicy function.
module.exports = { analyzeLicensePolicy };
// --- END OF FILE src/ai/licenseAnalyzer.js (FINAL & SMARTEST) ---