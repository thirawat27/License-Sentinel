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
    const CACHE_DURATION_MS = cacheDurationHours * 60 * 60 * 1000;

    const cachedItem = context.workspaceState.get(key);
    if (!cachedItem || (Date.now() - cachedItem.timestamp) > CACHE_DURATION_MS) {
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
    context.workspaceState.update(key, { data, timestamp: Date.now() });
}

module.exports = { getCache, setCache };