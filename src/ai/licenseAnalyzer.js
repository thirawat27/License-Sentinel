// --- START OF FILE src/ai/licenseAnalyzer.js (THE DEFINITIVE ORACLE) ---

// This is the definitive, synthesized version. It combines the advanced analytical power
// (Risk Scoring, Compatibility Checking) of the "Upgraded Version" with the superior
// user experience and transparent reasoning (structured details, traces, suggestions)
// of the "Final Boss Version", creating the most powerful and insightful engine possible.

// --- ADVANCED ALGORITHMS & HELPERS ---

/**
 * Calculates the Jaro-Winkler similarity between two strings.
 * @returns {number} A score from 0 (no similarity) to 1 (exact match).
 */
function jaroWinkler(s1, s2) {
  let m = 0
  if (s1.length === 0 || s2.length === 0) return 0
  if (s1 === s2) return 1
  const range = Math.floor(Math.max(s1.length, s2.length) / 2) - 1
  const s1Matches = new Array(s1.length).fill(false),
    s2Matches = new Array(s2.length).fill(false)
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - range),
      end = Math.min(i + range + 1, s2.length)
    for (let j = start; j < end; j++) {
      if (!s2Matches[j] && s1[i] === s2[j]) {
        s1Matches[i] = true
        s2Matches[j] = true
        m++
        break
      }
    }
  }
  if (m === 0) return 0
  let t = 0,
    k = 0
  for (let i = 0; i < s1.length; i++) {
    if (s1Matches[i]) {
      while (!s2Matches[k]) k++
      if (s1[i] !== s2[k]) t++
      k++
    }
  }
  t /= 2
  const jaro = (m / s1.length + m / s2.length + (m - t) / m) / 3
  let p = 0.1,
    l = 0
  while (s1[l] === s2[l] && l < 4) l++
  return jaro + l * p * (1 - jaro)
}

/**
 * Checks compatibility between two licenses.
 * @param {string} licenseA SPDX ID of the project's main license.
 * @param {string} licenseB SPDX ID of the dependency's license.
 * @returns {boolean} True if compatible, false otherwise.
 */
function checkCompatibility(licenseA, licenseB) {
  // A simplified compatibility matrix for demonstration. A real-world version would be more complex.
  const COMPATIBILITY_MATRIX = {
    // Permissive licenses are generally compatible with most.
    MIT: ["*"],
    "Apache-2.0": ["*"],
    "BSD-3-Clause": ["*"],
    ISC: ["*"],
    // Weak copyleft can be included in stronger copyleft projects.
    "MPL-2.0": [
      "MIT",
      "Apache-2.0",
      "BSD-3-Clause",
      "ISC",
      "MPL-2.0",
      "LGPL-3.0-only",
      "GPL-3.0-only",
      "AGPL-3.0-only",
    ],
    "LGPL-3.0-only": [
      "MIT",
      "Apache-2.0",
      "BSD-3-Clause",
      "ISC",
      "LGPL-3.0-only",
      "GPL-3.0-only",
      "AGPL-3.0-only",
    ],
    // Strong copyleft is very restrictive.
    "GPL-3.0-only": ["GPL-3.0-only", "AGPL-3.0-only", "LGPL-3.0-only"], // Can include LGPL
    "AGPL-3.0-only": ["AGPL-3.0-only"],
  }
  return (
    COMPATIBILITY_MATRIX[licenseA]?.includes(licenseB) ||
    COMPATIBILITY_MATRIX[licenseA]?.includes("*") ||
    false
  )
}

/**
 * Calculates a risk score for a license based on its type and normalization confidence.
 * @param {object} normalizedLicense The result from normalizeLicense.
 * @returns {number} A risk score from 0 (low risk) to 1 (high risk).
 */
function calculateRisk(normalizedLicense) {
  const riskFactors = {
    [LICENSE_TYPES.PROPRIETARY]: 1.0,
    [LICENSE_TYPES.NETWORK_COPYLEFT]: 0.9,
    [LICENSE_TYPES.STRONG_COPYLEFT]: 0.8,
    [LICENSE_TYPES.NON_COMMERCIAL]: 0.7,
    [LICENSE_TYPES.WEAK_COPYLEFT]: 0.5,
    [LICENSE_TYPES.PERMISSIVE]: 0.1,
    [LICENSE_TYPES.UNKNOWN]: 0.6,
  }
  const baseRisk = riskFactors[normalizedLicense.dbEntry.type] || 0.6
  const confidenceFactor = (1 - normalizedLicense.confidence) * 0.5 // Uncertainty adds risk
  return Math.min(1, baseRisk + confidenceFactor) // Cap risk at 1.0
}

// --- THE ULTIMATE KNOWLEDGE VAULT ---

const LICENSE_TYPES = {
  PERMISSIVE: "permissive",
  WEAK_COPYLEFT: "weak-copyleft",
  STRONG_COPYLEFT: "strong-copyleft",
  NETWORK_COPYLEFT: "network-copyleft",
  NON_COMMERCIAL: "non-commercial",
  PROPRIETARY: "proprietary",
  UNKNOWN: "unknown",
}

const LICENSE_DB = {
  MIT: {
    spdx: "MIT",
    aliases: ["mit", "mit license", "the mit license", "x11", "expat"],
    type: LICENSE_TYPES.PERMISSIVE,
    notes: ["A simple and very popular permissive license."],
  },
  "Apache-2.0": {
    spdx: "Apache-2.0",
    aliases: ["apache-2.0", "apache 2.0", "apache license", "asl 2.0"],
    type: LICENSE_TYPES.PERMISSIVE,
    notes: ["Grants patent rights, a key feature over MIT."],
  },
  "BSD-3-Clause": {
    spdx: "BSD-3-Clause",
    aliases: ["bsd", "bsd license", "bsd-3-clause", "new bsd", "modified bsd"],
    type: LICENSE_TYPES.PERMISSIVE,
    notes: ["Similar to MIT but includes a non-endorsement clause."],
  },
  "BSD-2-Clause": {
    spdx: "BSD-2-Clause",
    aliases: ["bsd-2-clause", "simplified bsd"],
    type: LICENSE_TYPES.PERMISSIVE,
    notes: ["A more permissive version of the BSD license."],
  },
  ISC: {
    spdx: "ISC",
    aliases: ["isc", "isc license"],
    type: LICENSE_TYPES.PERMISSIVE,
    notes: ["Functionally equivalent to MIT, but with simpler language."],
  },
  Unlicense: {
    spdx: "Unlicense",
    aliases: ["unlicense", "public domain"],
    type: LICENSE_TYPES.PERMISSIVE,
    notes: ["A template for dedicating software to the public domain."],
  },
  WTFPL: {
    spdx: "WTFPL",
    aliases: ["wtfpl"],
    type: LICENSE_TYPES.PERMISSIVE,
    notes: [
      "Not OSI-approved. Legal standing can be uncertain in some jurisdictions.",
    ],
  },
  HPND: {
    spdx: "HPND",
    aliases: ["hpnd", "historical permission notice and disclaimer"],
    type: LICENSE_TYPES.PERMISSIVE,
    notes: [
      "The license used by the Pillow library, a permissive BSD-style license.",
    ],
  },
  "MPL-2.0": {
    spdx: "MPL-2.0",
    aliases: [
      "mpl-2.0",
      "mozilla public license 2.0",
      "mozilla public license",
    ],
    type: LICENSE_TYPES.WEAK_COPYLEFT,
    notes: [
      "File-level copyleft. Good compromise between permissive and strong copyleft.",
    ],
  },
  "LGPL-3.0-only": {
    spdx: "LGPL-3.0-only",
    aliases: ["lgpl-3.0", "lgpl 3.0", "lgpl license"],
    type: LICENSE_TYPES.WEAK_COPYLEFT,
    notes: [
      "Allows linking from proprietary code, but modifications to the library must be shared.",
    ],
  },
  "GPL-3.0-only": {
    spdx: "GPL-3.0-only",
    aliases: ["gpl-3.0", "gpl 3.0", "gpl license"],
    type: LICENSE_TYPES.STRONG_COPYLEFT,
    notes: [
      "Viral license. Any work that uses this code must also be licensed under GPL.",
    ],
  },
  "AGPL-3.0-only": {
    spdx: "AGPL-3.0-only",
    aliases: ["agpl-3.0", "agpl 3.0", "affero", "agpl license"],
    type: LICENSE_TYPES.NETWORK_COPYLEFT,
    notes: [
      "Like GPL, but copyleft is triggered by network use, not just distribution.",
    ],
  },
  JSON: {
    spdx: "JSON",
    aliases: ["json", "json license"],
    type: LICENSE_TYPES.PROPRIETARY,
    notes: [
      "Not a true open-source license due to the 'The software shall be used for Good, not Evil' clause.",
    ],
  },
  "CC-BY-NC-4.0": {
    spdx: "CC-BY-NC-4.0",
    aliases: ["cc-by-nc-4.0", "cc by nc 4.0"],
    type: LICENSE_TYPES.NON_COMMERCIAL,
    notes: ["Creative Commons license that explicitly forbids commercial use."],
  },
  "SSPL-1.0": {
    spdx: "SSPL-1.0",
    aliases: ["sspl", "sspl-1.0", "server side public license"],
    type: LICENSE_TYPES.NETWORK_COPYLEFT,
    notes: [
      "Controversial and not considered Open Source by the OSI. Extremely broad copyleft scope.",
    ],
  },
}

const LICENSE_OBLIGATIONS = {
  discloseSource: {
    summary: "Source code must be disclosed if distributed.",
    risk: "high",
    types: [
      LICENSE_TYPES.WEAK_COPYLEFT,
      LICENSE_TYPES.STRONG_COPYLEFT,
      LICENSE_TYPES.NETWORK_COPYLEFT,
    ],
  },
  sameLicense: {
    summary:
      "Modifications must be released under the same or compatible license (Copyleft / Share-Alike).",
    risk: "high",
    types: [
      LICENSE_TYPES.WEAK_COPYLEFT,
      LICENSE_TYPES.STRONG_COPYLEFT,
      LICENSE_TYPES.NETWORK_COPYLEFT,
    ],
  },
  networkUseIsDistribution: {
    summary:
      "Use over a network may be considered distribution, triggering copyleft.",
    risk: "high",
    types: [LICENSE_TYPES.NETWORK_COPYLEFT],
  },
  commercialUseForbidden: {
    summary: "This license explicitly forbids commercial use.",
    risk: "high",
    types: [LICENSE_TYPES.NON_COMMERCIAL],
  },
  includeCopyright: {
    summary:
      "Must include the original copyright notice and license text (Attribution).",
    risk: "medium",
    types: [
      LICENSE_TYPES.PERMISSIVE,
      LICENSE_TYPES.WEAK_COPYLEFT,
      LICENSE_TYPES.NON_COMMERCIAL,
    ],
  },
  compatibilityWarning: {
    summary:
      "Using this strong copyleft license may require you to re-license your own project.",
    risk: "high",
    types: [LICENSE_TYPES.STRONG_COPYLEFT, LICENSE_TYPES.NETWORK_COPYLEFT],
  },
}

// --- NORMALIZATION AND EXPRESSION PARSING ---

function normalizeLicense(license) {
  if (!license || typeof license !== "string") return null
  const cleanLicense = license.toLowerCase().trim()

  // Stage 1: Direct Hit
  for (const key in LICENSE_DB) {
    if (LICENSE_DB[key].aliases.includes(cleanLicense)) {
      const dbEntry = LICENSE_DB[key]
      return {
        id: dbEntry.spdx.toLowerCase(),
        confidence: 1.0,
        method: "Direct Match",
        dbEntry,
      }
    }
  }

  // Stage 2: Regex Match (New)
  const regexPatterns = [
    { pattern: /mit|expat/i, id: "MIT" },
    { pattern: /apache.*2\.?0/i, id: "Apache-2.0" },
    { pattern: /gpl.*v?3/i, id: "GPL-3.0-only" },
    { pattern: /lgpl.*v?3/i, id: "LGPL-3.0-only" },
    { pattern: /affero|agpl/i, id: "AGPL-3.0-only" },
    { pattern: /(?:3|three).clause.bsd/i, id: "BSD-3-Clause" },
  ]
  for (const { pattern, id } of regexPatterns) {
    if (pattern.test(cleanLicense)) {
      const dbEntry = LICENSE_DB[id]
      return {
        id: dbEntry.spdx.toLowerCase(),
        confidence: 0.95,
        method: "Regex Match",
        dbEntry,
      }
    }
  }

  // Stage 3: Jaro-Winkler Fuzzy Matching
  let bestMatch = { id: null, confidence: 0.88, method: "none", dbEntry: null }
  for (const key in LICENSE_DB) {
    for (const alias of LICENSE_DB[key].aliases) {
      const similarity = jaroWinkler(cleanLicense, alias)
      if (similarity > bestMatch.confidence) {
        const dbEntry = LICENSE_DB[key]
        bestMatch = {
          id: dbEntry.spdx.toLowerCase(),
          confidence: similarity,
          method: "Fuzzy Match",
          dbEntry,
        }
      }
    }
  }
  if (bestMatch.id) return bestMatch

  // Stage 4: Fallback
  const fallbackId = cleanLicense
    .replace(/[\s(),]/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-|-$/, "")
  return {
    id: fallbackId,
    confidence: 0.1,
    method: "Fallback",
    dbEntry: {
      type: LICENSE_TYPES.UNKNOWN,
      notes: ["This license is not in the Oracle's knowledge base."],
    },
  }
}

function parseExpression(expression) {
  expression = expression.trim()
  if (expression.startsWith("(") && expression.endsWith(")")) {
    let balance = 0,
      isOuter = true
    for (let i = 0; i < expression.length - 1; i++) {
      if (expression[i] === "(") balance++
      if (expression[i] === ")") balance--
      if (balance === 0 && i < expression.length - 2) {
        isOuter = false
        break
      }
    }
    if (isOuter)
      return parseExpression(expression.substring(1, expression.length - 1))
  }
  const splitByOperator = (op) => {
    const regex = new RegExp(`\\s+${op}\\s+`, "i")
    let balance = 0,
      lastSplit = 0
    const parts = []
    for (let i = 0; i < expression.length; i++) {
      if (expression[i] === "(") balance++
      else if (expression[i] === ")") balance--
      else if (
        balance === 0 &&
        regex.test(expression.substring(i, i + op.length + 2))
      ) {
        parts.push(expression.substring(lastSplit, i).trim())
        lastSplit = i + op.length + 2
        i = lastSplit - 1
      }
    }
    parts.push(expression.substring(lastSplit).trim())
    return parts
  }
  const andParts = splitByOperator("AND")
  if (andParts.length > 1)
    return { and: andParts.map((p) => parseExpression(p)) }
  const orParts = splitByOperator("OR")
  if (orParts.length > 1) return { or: orParts.map((p) => parseExpression(p)) }
  return expression
}

// --- THE DEFINITIVE ORACLE'S CORE ANALYSIS FUNCTION ---

function analyzeLicensePolicy(licenseString, policy) {
  if (
    !licenseString ||
    licenseString === "N/A" ||
    licenseString.startsWith("Error")
  ) {
    return {
      status: "unknown",
      reason: `Invalid license string: "${licenseString}"`,
      riskScore: 0.7,
      obligations: [],
      details: {
        trace: [],
        warnings: ["Unable to analyze invalid license string."],
        suggestions: ["Verify the package's license information manually."],
        compatibilityIssues: [],
      },
    }
  }

  const expressionTree = parseExpression(licenseString)
  const allObligations = new Set(),
    allWarnings = new Set(),
    allSuggestions = new Set()
  const allTraces = [],
    allRisks = [],
    allCompatibilityIssues = []

  const _evaluate = (node) => {
    if (typeof node === "string") {
      const result = normalizeLicense(node)
      if (!result)
        return {
          status: "unknown",
          reason: `could not normalize '${node}'`,
          riskScore: 0.6,
        }

      allTraces.push(
        `'${node}' -> '${result.id}' (via ${result.method}, ${Math.round(
          result.confidence * 100
        )}% confidence)`
      )
      const riskScore = calculateRisk(result)
      allRisks.push(riskScore)

      const { dbEntry } = result
      if (dbEntry.notes) dbEntry.notes.forEach((note) => allWarnings.add(note))
      if (dbEntry) {
        for (const [key, value] of Object.entries(LICENSE_OBLIGATIONS)) {
          if (value.types.includes(dbEntry.type)) allObligations.add(value)
        }
      }

      if (
        policy.mainLicense &&
        dbEntry &&
        dbEntry.type !== LICENSE_TYPES.UNKNOWN
      ) {
        if (!checkCompatibility(policy.mainLicense, result.id)) {
          allCompatibilityIssues.push({
            from: result.id,
            to: policy.mainLicense,
          })
          allWarnings.add(
            `Compatibility Issue: '${result.id}' may be incompatible with your project's main license ('${policy.mainLicense}').`
          )
        }
      }

      if (policy.denied.has(result.id)) {
        allSuggestions.add(
          `Consider alternatives with licenses like ${[...policy.allowed]
            .slice(0, 3)
            .join(", ")}.`
        )
        return {
          status: "non-compliant",
          reason: `'${result.id}' is on the denied list`,
          riskScore,
        }
      }
      if (policy.allowed.has(result.id)) {
        return {
          status: "compliant",
          reason: `'${result.id}' is on the allowed list`,
          riskScore,
        }
      }
      allSuggestions.add(
        `Review '${result.id}' and decide whether to add it to your allowed or denied policies.`
      )
      return {
        status: "unknown",
        reason: `'${result.id}' is not in any policy list`,
        riskScore,
      }
    }

    if (node.or) {
      const results = node.or.map(_evaluate)
      if (results.some((r) => r.status === "compliant"))
        return {
          status: "compliant",
          reason: `one of the OR options is compliant`,
          riskScore: Math.min(...results.map((r) => r.riskScore)),
        }
      if (results.every((r) => r.status === "non-compliant"))
        return {
          status: "non-compliant",
          reason: "all options in the OR expression are non-compliant",
          riskScore: Math.max(...results.map((r) => r.riskScore)),
        }
      return {
        status: "unknown",
        reason: "an OR option has an unknown or mixed status",
        riskScore: Math.max(...results.map((r) => r.riskScore)),
      }
    }
    if (node.and) {
      const results = node.and.map(_evaluate)
      const nonCompliant = results.find((r) => r.status === "non-compliant")
      if (nonCompliant)
        return {
          status: "non-compliant",
          reason: `a required AND condition (${nonCompliant.reason}) is non-compliant`,
          riskScore: Math.max(...results.map((r) => r.riskScore)),
        }
      if (results.every((r) => r.status === "compliant"))
        return {
          status: "compliant",
          reason: "all required AND conditions are compliant",
          riskScore: Math.max(...results.map((r) => r.riskScore)),
        }
      return {
        status: "unknown",
        reason: "a required AND condition has an unknown status",
        riskScore: Math.max(...results.map((r) => r.riskScore)),
      }
    }
    return {
      status: "unknown",
      reason: "invalid expression structure",
      riskScore: 0.7,
    }
  }

  const finalResult = _evaluate(expressionTree)
  const overallRisk =
    allRisks.length > 0 ? Math.max(...allRisks) : finalResult.riskScore || 0.6

  return {
    status: finalResult.status,
    reason: `Overall status is ${finalResult.status.toUpperCase()}. Reason: ${
      finalResult.reason
    }.`,
    riskScore: parseFloat(overallRisk.toFixed(2)),
    obligations: Array.from(allObligations).sort((a, b) =>
      b.risk.localeCompare(a.risk)
    ),
    details: {
      trace: allTraces,
      warnings: Array.from(allWarnings),
      suggestions: Array.from(allSuggestions),
      compatibilityIssues: allCompatibilityIssues,
    },
  }
}

module.exports = { analyzeLicensePolicy }

// --- END OF FILE src/ai/licenseAnalyzer.js (THE DEFINITIVE ORACLE) ---
