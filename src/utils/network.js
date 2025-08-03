// This file provides utility functions for making network requests using axios.
// ไฟล์นี้มีฟังก์ชันอำนวยความสะดวกสำหรับการทำ network requests โดยใช้ axios
const axios = require("axios"); // Import the axios library. นำเข้าไลบรารี axios

const defaultOptions = {
  headers: {
    "User-Agent": "Node.js/LicenseSentinel-VSCode-Extension",
  },
};

/**
 * Fetches text data from a URL using axios.
 * @param {string} url The URL to fetch data from.
 * @param {object} options Axios request configuration options.
 * @returns {Promise<string>} A promise that resolves to the text data.
 */
// Fetches text data from a URL using axios.
// ฟังก์ชันสำหรับดึงข้อมูลข้อความจาก URL โดยใช้ axios
async function fetchText(url, options = {}) {
  try {
    const response = await axios.get(url, { ...defaultOptions, ...options });
    return response.data;
  } catch (error) {
    // Handle network or other errors from axios.
    // จัดการ network errors หรือ error อื่นๆ จาก axios
    console.error(
      `Request Failed to ${url}. Status Code: ${error.response?.status} (${error.message})`
    );
    // Create a new error object to standardize the error format.
    // สร้าง error object ใหม่เพื่อให้มีรูปแบบ error ที่เป็นมาตรฐานเดียวกัน
    const customError = new Error(error.message);
    customError.statusCode = error.response?.status || 'NETWORK_ERROR';
    throw customError;
  }
}

/**
 * Fetches JSON data from a URL using axios.
 * @param {string} url The URL to fetch data from.
 * @param {object} options Axios request configuration options.
 * @returns {Promise<object>} A promise that resolves to the JSON data.
 */
// Fetches JSON data from a URL using axios.
// ฟังก์ชันสำหรับดึงข้อมูล JSON จาก URL โดยใช้ axios
async function fetchJson(url, options = {}) {
  const body = await fetchText(url, options);
  try {
    // axios automatically parses JSON if content-type is correct,
    // but the body might already be an object. If it's a string, we parse.
    // axios จะ parse JSON อัตโนมัติถ้า content-type ถูกต้อง
    // แต่ body อาจจะเป็น object อยู่แล้ว ถ้าเป็น string เราจะ parse เอง
    return (typeof body === 'string') ? JSON.parse(body) : body;
  } catch (error) {
    // Handle JSON parsing errors.
    // จัดการ errors ในการ parse JSON
    console.error(
      "Failed to parse JSON from URL:",
      url,
      "Body:",
      String(body).substring(0, 500)
    );
    throw new Error("Invalid JSON response");
  }
}

// Export the functions.
// Export ฟังก์ชัน
module.exports = { fetchJson, fetchText };