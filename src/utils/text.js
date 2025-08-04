// This file provides utility functions for text manipulation, such as converting data to CSV format and debouncing function calls.

/**
 * Converts an array of objects to a CSV (Comma Separated Values) string.
 * @param {Array<object>} data - The array of objects to convert. Each object represents a row in the CSV.
 * @returns {string} - A CSV formatted string. Returns an empty string if the input data is null, undefined, or empty.
 */
function convertToCsv(data) {
    // If the input data is null, undefined, or empty, return an empty string.
    if (!data || data.length === 0) return "";
    
    // Extract the headers (column names) from the first object in the array.
    const headers = Object.keys(data[0]);
    
    /**
     * Escapes a single cell in the CSV to handle commas, double quotes, and newlines.
     * @param {any} cell - The cell value to escape.
     * @returns {string} - The escaped cell value.
     */
    const escapeCsvCell = (cell) => {
        // Convert the cell value to a string, or an empty string if it's null or undefined.
        const cellStr = String(cell || '');
        // If the cell string contains a comma, double quote, or newline, it needs to be escaped.
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            // Escape the cell by wrapping it in double quotes and replacing any inner double quotes with two double quotes.
            return `"${cellStr.replace(/"/g, '""')}"`;
        }
        // If the cell doesn't need escaping, return it as is.
        return cellStr;
    };

    // Create an array of CSV rows.
    const csvRows = [
        // The first row is the headers, joined by commas.
        headers.join(','),
        // Map each object in the data array to a CSV row.
        ...data.map(row => 
            // For each row, map the headers to the corresponding cell value, escape the cell, and join the cells with commas.
            headers.map(header => escapeCsvCell(row[header])).join(',')
        )
    ];

    // Join the rows with newline characters to create the final CSV string.
    return csvRows.join('\n');
}

/**
 * Debounces a function to prevent it from being called too frequently.
 * @param {Function} func - The function to debounce.
 * @param {number} timeout - The delay in milliseconds before the function is called. Defaults to 500ms.
 * @returns {Function} - A new function that, when called, delays the execution of the original function.
 */
function debounce(func, timeout = 500){
  // Store the timer ID in a closure.
  let timer;
  // Return a new function that will be called instead of the original.
  return (...args) => {
    // Clear the existing timer, if any.
    clearTimeout(timer);
    // Set a new timer that will call the original function after the specified timeout.
    timer = setTimeout(() => { 
        // Call the original function with the provided arguments.
        func.apply(this, args); 
    }, timeout);
  };
}

// Export the convertToCsv and debounce functions so they can be used in other modules.
module.exports = { convertToCsv, debounce };