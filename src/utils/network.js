// This file provides utility functions for making network requests, specifically for fetching text and JSON data.

const axios = require("axios");

// Define default options for all HTTP requests. These include setting a User-Agent and a timeout.
const defaultOptions = {
  headers: {
    // Setting a User-Agent helps servers identify the client making the request.
    "User-Agent": "Node.js/LicenseSentinel-VSCode-Extension",
  },
  // Set a timeout to prevent requests from hanging indefinitely.
  timeout: 15000, // 15 seconds
};

// Fetches text data from a given URL with retry logic.
async function fetchText(url, options = {}, retries = 3, delay = 1000) {
  try {
    // Attempt to make an HTTP GET request to the specified URL.
    const response = await axios.get(url, { ...defaultOptions, ...options });
    // Return the response data (text).
    return response.data;
  } catch (error) {
    // Determine if the error is retryable based on the HTTP status code.
    const isRetryable =
      !error.response ||
      error.response.status === 429 || // Too Many Requests
      error.response.status >= 500; // Internal Server Error and other server errors

    // If retries are remaining and the error is retryable, attempt to retry the request.
    if (retries > 0 && isRetryable) {
      console.log(
        `Request to ${url} failed. Retrying in ${delay}ms... (${retries - 1} retries left)`
      );
      // Wait for the specified delay before retrying.
      await new Promise(resolve => setTimeout(resolve, delay));
      // Recursively call fetchText with reduced retries and increased delay.
      return fetchText(url, options, retries - 1, delay * 2);
    }

    // If no retries are left or the error is not retryable, log the error and throw a custom error.
    console.error(
      `Request Failed to ${url}. Status Code: ${error.response?.status} (${error.message})`
    );
    const customError = new Error(error.message);
    // Set a custom status code on the error object.
    customError.statusCode = error.response?.status || 'NETWORK_ERROR';
    throw customError;
  }
}

// Fetches JSON data from a given URL.
async function fetchJson(url, options = {}) {
  // First, fetch the text data from the URL.
  const body = await fetchText(url, options);
  try {
    // Attempt to parse the text data as JSON.
    return (typeof body === 'string') ? JSON.parse(body) : body;
  } catch (error) {
    // If parsing fails, log the error and throw a new error indicating an invalid JSON response.
    console.error(
      "Failed to parse JSON from URL:",
      url,
      "Body:",
      String(body).substring(0, 500) // Show only the first 500 characters of the body
    );
    throw new Error("Invalid JSON response");
  }
}

// Export the fetchJson and fetchText functions so they can be used in other modules.
module.exports = { fetchJson, fetchText };