// This file provides utility functions for making network requests using HTTPS.
// ไฟล์นี้มีฟังก์ชันอำนวยความสะดวกสำหรับการทำ network requests โดยใช้ HTTPS

const https = require("https"); // Import the HTTPS module. นำเข้าโมดูล HTTPS

// Function to fetch data from a URL using HTTPS.
// ฟังก์ชันสำหรับดึงข้อมูลจาก URL โดยใช้ HTTPS
function fetchWithHttps(url, options = {}) {
  // Return a new promise.
  // คืนค่า promise ใหม่
  return new Promise((resolve, reject) => {
    // Make an HTTPS GET request.
    // สร้าง HTTPS GET request
    const request = https.get(url, options, (response) => {
      // Handle redirects (300-399 status codes).
      // จัดการ redirects (status code 300-399)
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        // Follow the redirect.
        // ตาม redirect
        return fetchWithHttps(response.headers.location, options)
          .then(resolve)
          .catch(reject);
      }

      // Handle errors (status codes outside 200-299 range).
      // จัดการ errors (status code นอกช่วง 200-299)
      if (response.statusCode < 200 || response.statusCode >= 300) {
        // Create an error object.
        // สร้าง error object
        const error = new Error(
          `Request Failed. Status Code: ${response.statusCode} (${response.statusMessage})`
        );
        error.statusCode = response.statusCode;
        return reject(error);
      }

      // Accumulate the response body.
      // สะสม response body
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });

      // Resolve the promise when the response is complete.
      // Resolve promise เมื่อ response เสร็จสมบูรณ์
      response.on("end", () => {
        resolve(body);
      });
    });

    // Handle network errors.
    // จัดการ network errors
    request.on("error", (err) => {
      err.statusCode = "NETWORK_ERROR";
      reject(err);
    });

    // End the request.
    // จบ request
    request.end();
  });
}

// Function to fetch JSON data from a URL using HTTPS.
// ฟังก์ชันสำหรับดึงข้อมูล JSON จาก URL โดยใช้ HTTPS
async function fetchJson(url, options = {}) {
  // Set default options, including the User-Agent header.
  // ตั้งค่า default options รวมถึง header User-Agent
  const defaultOptions = {
    headers: {
      "User-Agent": "Node.js/LicenseSentinel-VSCode-Extension",
    },
    ...options,
  };
  // Fetch the data using fetchWithHttps.
  // ดึงข้อมูลโดยใช้ fetchWithHttps
  const body = await fetchWithHttps(url, defaultOptions);
  try {
    // Parse the JSON data.
    // Parse ข้อมูล JSON
    return JSON.parse(body);
  } catch (error) {
    // Handle JSON parsing errors.
    // จัดการ errors ในการ parse JSON
    console.error(
      "Failed to parse JSON from URL:",
      url,
      "Body:",
      body.substring(0, 500)
    );
    throw new Error("Invalid JSON response");
  }
}

// Export the functions.
// Export ฟังก์ชัน
module.exports = { fetchWithHttps, fetchJson };