const https = require("https")

function fetchWithHttps(url, options = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, options, (response) => {
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        return fetchWithHttps(response.headers.location, options)
          .then(resolve)
          .catch(reject)
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        const error = new Error(
          `Request Failed. Status Code: ${response.statusCode} (${response.statusMessage})`
        )
        error.statusCode = response.statusCode
        return reject(error)
      }

      let body = ""
      response.setEncoding("utf8")
      response.on("data", (chunk) => {
        body += chunk
      })

      response.on("end", () => {
        resolve(body)
      })
    })

    request.on("error", (err) => {
      err.statusCode = "NETWORK_ERROR"
      reject(err)
    })

    request.end()
  })
}

async function fetchJson(url, options = {}) {
  const defaultOptions = {
    headers: {
      "User-Agent": "Node.js/LicenseSentinel-VSCode-Extension",
    },
    ...options,
  }
  const body = await fetchWithHttps(url, defaultOptions)
  try {
    return JSON.parse(body)
  } catch (error) {
    console.error(
      "Failed to parse JSON from URL:",
      url,
      "Body:",
      body.substring(0, 500)
    )
    throw new Error("Invalid JSON response")
  }
}

module.exports = { fetchWithHttps, fetchJson }
