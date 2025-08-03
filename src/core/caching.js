const vscode = require('vscode');

/**
 * ดึงข้อมูลจากแคช หากยังไม่หมดอายุ
 * @param {vscode.ExtensionContext} context
 * @param {string} key
 * @returns {any | null}
 */
function getCache(context, key) {
    const config = vscode.workspace.getConfiguration('license-sentinel');
    const cacheDurationHours = config.get('cacheDurationHours', 24);
    // แปลงเป็นมิลลิวินาที
    const CACHE_DURATION_MS = cacheDurationHours * 60 * 60 * 1000;

    const cachedItem = context.workspaceState.get(key);

    // สำหรับ mtime ของไฟล์ ไม่ต้องเช็ควันหมดอายุ
    if (key.startsWith('file-mtime-')) {
        return cachedItem;
    }

    if (!cachedItem || !cachedItem.timestamp) {
        return null;
    }

    // เช็คว่าแคชหมดอายุหรือยัง (ยกเว้นข้อมูลไฟล์)
    if ((Date.now() - cachedItem.timestamp) > CACHE_DURATION_MS) {
        return null;
    }
    return cachedItem.data;
}

/**
 * บันทึกข้อมูลลงแคชพร้อม timestamp
 * @param {vscode.ExtensionContext} context
 * @param {string} key
 * @param {any} data
 */
function setCache(context, key, data) {
    // สำหรับ mtime ของไฟล์ ไม่ต้องใส่ timestamp
    if (key.startsWith('file-mtime-')) {
        context.workspaceState.update(key, data);
    } else {
        context.workspaceState.update(key, { data, timestamp: Date.now() });
    }
}

module.exports = { getCache, setCache };