const https = require('https');

/**
 * Fetches data from a URL using the native Node.js https module.
 * It handles redirects automatically.
 * @param {string | URL} url The URL to fetch.
 * @param {object} [options] Options for the request, e.g., headers.
 * @returns {Promise<string>} A promise that resolves with the response body as a string.
 */
function fetchWithHttps(url, options = {}) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, options, (response) => {
            // Handle redirects
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                return fetchWithHttps(response.headers.location, options).then(resolve).catch(reject);
            }

            if (response.statusCode < 200 || response.statusCode >= 300) {
                return reject(new Error(`Request Failed. Status Code: ${response.statusCode}`));
            }

            let body = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => {
                body += chunk;
            });

            response.on('end', () => {
                resolve(body);
            });
        });

        request.on('error', (err) => {
            reject(err);
        });
        
        request.end();
    });
}

/**
 * Fetches and parses JSON data from a URL.
 * @param {string | URL} url The URL to fetch JSON data from.
 * @param {object} [options] Options for the request, e.g., headers.
 * @returns {Promise<any>} A promise that resolves with the parsed JSON object.
 */
async function fetchJson(url, options = {}) {
    // Some APIs require a User-Agent header
    const defaultOptions = {
        headers: {
            'User-Agent': 'Node.js/LicenseSentinel-VSCode-Extension'
        },
        ...options
    };
    const body = await fetchWithHttps(url, defaultOptions);
    try {
        return JSON.parse(body);
    } catch (error) {
        console.error("Failed to parse JSON from URL:", url, "Body:", body.substring(0, 500));
        throw new Error("Invalid JSON response");
    }
}

module.exports = { fetchWithHttps, fetchJson };