/**
 * Retrieves a value from the extension's workspace cache.
 * @param {import('vscode').ExtensionContext} context The extension context.
 * @param {string} key The cache key.
 * @returns {any | undefined} The cached value, or undefined if not found.
 */
// Retrieves a value from the extension's workspace cache.
// ดึงค่าจาก cache ของ workspace ของ extension
function getCache(context, key) {
    // Return the cached value, or undefined if not found.
    // คืนค่า cached value หรือ undefined ถ้าไม่พบ
    return context.workspaceState.get(key);
}

/**
 * Stores a value in the extension's workspace cache.
 * @param {import('vscode').ExtensionContext} context The extension context.
 * @param {string} key The cache key.
 * @param {any} value The value to store.
 */
// Stores a value in the extension's workspace cache.
// เก็บค่าใน cache ของ workspace ของ extension
function setCache(context, key, value) {
    // Update the workspace state with the given key and value.
    // อัปเดต workspace state ด้วย key และ value ที่กำหนด
    context.workspaceState.update(key, value);
}

// Export the getCache and setCache functions.
// ส่งออกฟังก์ชัน getCache และ setCache
module.exports = { getCache, setCache };