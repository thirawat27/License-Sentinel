/**
 * Retrieves a value from the extension's workspace cache.
 * @param {import('vscode').ExtensionContext} context The extension context.
 * @param {string} key The cache key.
 * @returns {any | undefined} The cached value, or undefined if not found.
 */
function getCache(context, key) {
    return context.workspaceState.get(key);
}

/**
 * Stores a value in the extension's workspace cache.
 * @param {import('vscode').ExtensionContext} context The extension context.
 * @param {string} key The cache key.
 * @param {any} value The value to store.
 */
function setCache(context, key, value) {
    context.workspaceState.update(key, value);
}

module.exports = { getCache, setCache };