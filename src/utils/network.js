// --- START OF FILE src/utils/network.js (FINAL) ---

const axios = require("axios");

const defaultOptions = {
  headers: {
    "User-Agent": "Node.js/LicenseSentinel-VSCode-Extension",
  },
  timeout: 15000,
};

async function fetchText(url, options = {}, retries = 3, delay = 1000) {
  try {
    const response = await axios.get(url, { ...defaultOptions, ...options });
    return response.data;
  } catch (error) {
    const isRetryable =
      !error.response ||
      error.response.status === 429 ||
      error.response.status >= 500;

    if (retries > 0 && isRetryable) {
      console.log(
        `Request to ${url} failed. Retrying in ${delay}ms... (${retries - 1} retries left)`
      );
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchText(url, options, retries - 1, delay * 2);
    }

    console.error(
      `Request Failed to ${url}. Status Code: ${error.response?.status} (${error.message})`
    );
    const customError = new Error(error.message);
    customError.statusCode = error.response?.status || 'NETWORK_ERROR';
    throw customError;
  }
}

async function fetchJson(url, options = {}) {
  const body = await fetchText(url, options);
  try {
    return (typeof body === 'string') ? JSON.parse(body) : body;
  } catch (error) {
    console.error(
      "Failed to parse JSON from URL:",
      url,
      "Body:",
      String(body).substring(0, 500)
    );
    throw new Error("Invalid JSON response");
  }
}

module.exports = { fetchJson, fetchText };
// --- END OF FILE src/utils/network.js (FINAL) ---