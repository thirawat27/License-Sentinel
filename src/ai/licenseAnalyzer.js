// This file contains functions for analyzing license policies and determining compliance.
// ไฟล์นี้มีฟังก์ชันสำหรับการวิเคราะห์นโยบายใบอนุญาตและตรวจสอบการปฏิบัติตามข้อกำหนด

const LICENSE_KEYWORDS = {
    // Keywords and phrases that trigger specific license obligations.
    // คำหลักและวลีที่กระตุ้นภาระผูกพันใบอนุญาตที่เฉพาะเจาะจง
    discloseSource: {
        // Triggers for licenses that require source code disclosure.
        // ตัวกระตุ้นสำหรับใบอนุญาตที่กำหนดให้เปิดเผยซอร์สโค้ด
        triggers: ["disclose source", "source code must be made available"],
        // Summary of the obligation.
        // สรุปภาระผูกพัน
        summary: "Obligation to disclose source code if distributed.",
        // Risk level associated with this obligation.
        // ระดับความเสี่ยงที่เกี่ยวข้องกับภาระผูกพันนี้
        risk: "high"
    },
    sameLicense: {
        // Triggers for copyleft licenses that require modifications to be released under the same license.
        // ตัวกระตุ้นสำหรับใบอนุญาต copyleft ที่กำหนดให้เผยแพร่การแก้ไขภายใต้ใบอนุญาตเดียวกัน
        triggers: ["same license", "licensed under the same terms", "copyleft"],
        // Summary of the obligation.
        // สรุปภาระผูกพัน
        summary: "Modifications must be released under the same license (Copyleft).",
        // Risk level associated with this obligation.
        // ระดับความเสี่ยงที่เกี่ยวข้องกับภาระผูกพันนี้
        risk: "high"
    },
    includeCopyright: {
        // Triggers for licenses that require the inclusion of the original copyright notice.
        // ตัวกระตุ้นสำหรับใบอนุญาตที่กำหนดให้รวมประกาศลิขสิทธิ์เดิม
        triggers: ["include the original copyright", "copyright notice"],
        // Summary of the obligation.
        // สรุปภาระผูกพัน
        summary: "Requirement to include original copyright notice.",
        // Risk level associated with this obligation.
        // ระดับความเสี่ยงที่เกี่ยวข้องกับภาระผูกพันนี้
        risk: "medium"
    },
    noLiability: {
        // Triggers for licenses that disclaim liability.
        // ตัวกระตุ้นสำหรับใบอนุญาตที่ปฏิเสธความรับผิด
        triggers: ["no liability", "without warranty", "as is"],
        // Summary of the obligation.
        // สรุปภาระผูกพัน
        summary: "Provided 'as-is' without warranty.",
        // Risk level associated with this obligation.
        // ระดับความเสี่ยงที่เกี่ยวข้องกับภาระผูกพันนี้
        risk: "low"
    },
     noTrademark: {
        // Triggers for licenses that restrict the use of trademarks.
        // ตัวกระตุ้นสำหรับใบอนุญาตที่ จำกัด การใช้เครื่องหมายการค้า
        triggers: ["not use the name", "trademark"],
        // Summary of the obligation.
        // สรุปภาระผูกพัน
        summary: "You may not use the names or trademarks of the original authors.",
        // Risk level associated with this obligation.
        // ระดับความเสี่ยงที่เกี่ยวข้องกับภาระผูกพันนี้
        risk: "medium"
    }
};

/**
 * Analyzes a license string against a given policy to determine compliance.
 * วิเคราะห์ license string กับนโยบายที่กำหนดเพื่อตรวจสอบ compliance
 * @param {string} licenseString The license string to analyze. license string ที่จะวิเคราะห์
 * @param {object} policy An object containing allowed and denied licenses. object ที่มี allowed และ denied licenses
 * @returns {object} An object containing the analysis summary, risk level, and reason. object ที่มี analysis summary, risk level และ reason
 */
function analyzeLicensePolicy(licenseString, policy) {
    // If the license string is missing or invalid, return an unknown result.
    // ถ้า license string หายไปหรือไม่ถูกต้อง, คืนค่าผลลัพธ์ที่ไม่รู้จัก
    if (!licenseString || licenseString === 'N/A' || licenseString.startsWith('Error')) {
        return { 
            // Summary of the analysis.
            // สรุปการวิเคราะห์
            summary: ["License information is missing or could not be fetched."],
            // Risk level associated with the missing license.
            // ระดับความเสี่ยงที่เกี่ยวข้องกับ license ที่หายไป
            risk: 'unknown',
            // Reason for the unknown result.
            // เหตุผลสำหรับผลลัพธ์ที่ไม่รู้จัก
            reason: "Missing or invalid license data."
        };
    }

    // Split the license string into individual licenses.
    // แยก license string เป็น licenses แต่ละรายการ
    const individualLicenses = licenseString.split(/ OR |\/|\sOR\s/i).map(l => l.trim().toLowerCase());
    // Array to store the analysis summary.
    // Array เพื่อเก็บสรุปการวิเคราะห์
    let analysisSummary = [];
    // Overall risk level.
    // ระดับความเสี่ยงโดยรวม
    let overallRisk = 'unknown';
    // Primary reason for the analysis result.
    // เหตุผลหลักสำหรับผลการวิเคราะห์
    let primaryReason = `License: "${licenseString}". `;

    // Check if any of the individual licenses are on the denied list.
    // ตรวจสอบว่ามี licenses ใด ๆ อยู่ในรายการ denied หรือไม่
    const deniedMatch = individualLicenses.find(l => l && policy.denied.has(l));
    if (deniedMatch) {
        // If a denied license is found, set the risk to high and add a reason.
        // หากพบ license ที่ถูกปฏิเสธ, ตั้งค่าความเสี่ยงเป็นสูงและเพิ่มเหตุผล
        overallRisk = 'high';
        primaryReason += `It is considered NON-COMPLIANT because '${deniedMatch}' is on your denied licenses list.`;
        analysisSummary.push(`- ❌ **Non-Compliant:** Matches denied license '${deniedMatch}'.`);
    } else {
        // If no denied licenses are found, check if any are on the allowed list.
        // หากไม่พบ licenses ที่ถูกปฏิเสธ, ตรวจสอบว่ามี licenses ใด ๆ อยู่ในรายการ allowed หรือไม่
        const allowedMatch = individualLicenses.find(l => l && policy.allowed.has(l));
        if (allowedMatch) {
            // If an allowed license is found, set the risk to low and add a reason.
            // หากพบ license ที่ได้รับอนุญาต, ตั้งค่าความเสี่ยงเป็นต่ำและเพิ่มเหตุผล
            overallRisk = 'low';
            primaryReason += `It is considered COMPLIANT because '${allowedMatch}' is on your allowed licenses list.`;
            analysisSummary.push(`- ✅ **Compliant:** Matches allowed license '${allowedMatch}'.`);
        } else {
            // If no allowed licenses are found, set the risk to medium and add a reason.
            // หากไม่พบ licenses ที่ได้รับอนุญาต, ตั้งค่าความเสี่ยงเป็นปานกลางและเพิ่มเหตุผล
            overallRisk = 'medium';
            primaryReason += `It is UNKNOWN because it is not explicitly on your allowed or denied lists. Manual review is recommended.`;
            analysisSummary.push(`- ❓ **Unknown Status:** Not found in your defined policies.`);
        }
    }

    // Add a disclaimer to the analysis summary.
    // เพิ่มข้อจำกัดความรับผิดชอบในสรุปการวิเคราะห์
    analysisSummary.push("- *This is an automated analysis. Always verify important licenses manually.*");

    // Return the analysis result.
    // คืนค่าผลการวิเคราะห์
    return {
        // Summary of the analysis.
        // สรุปการวิเคราะห์
        summary: analysisSummary,
        // Overall risk level.
        // ระดับความเสี่ยงโดยรวม
        risk: overallRisk,
        // Primary reason for the analysis result.
        // เหตุผลหลักสำหรับผลการวิเคราะห์
        reason: primaryReason
    };
}

// Export the analyzeLicensePolicy function.
// ส่งออกฟังก์ชัน analyzeLicensePolicy
module.exports = { analyzeLicensePolicy };