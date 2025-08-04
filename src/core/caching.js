/**
 * Retrieves a value from the extension's workspace cache.
 * @param {import('vscode').ExtensionContext} context The extension context.
 * @param {string} key The cache key.
 * @returns {any | undefined} The cached value, or undefined if not found.
 */
function getCache(context, key) {
    // This function retrieves a value from the extension's workspace state, which acts as a cache.
    // The workspace state is specific to the current VS Code workspace and persists across sessions.
    // It takes the extension context and a key as input.
    // If a value is found for the given key, it's returned. Otherwise, it returns undefined.
    return context.workspaceState.get(key);
}

/**
 * Stores a value in the extension's workspace cache.
 * @param {import('vscode').ExtensionContext} context The extension context.
 * @param {string} key The cache key.
 * @param {any} value The value to store.
 */
function setCache(context, key, value) {
    // This function stores a value in the extension's workspace state, using the provided key.
    // The workspace state allows the extension to persist data across VS Code sessions for a specific workspace.
    // It takes the extension context, a key, and the value to store as input.
    // The update method is used to set or update the value associated with the key in the workspace state.
    context.workspaceState.update(key, value);
}

// Export the getCache and setCache functions.
module.exports = { getCache, setCache };