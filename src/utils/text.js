/**
 * Converts an array of objects into a CSV-formatted string.
 * @param {Array<Object>} data The array of objects to convert.
 * @returns {string} The data as a CSV string.
 */
function convertToCsv(data) {
    if (!data || data.length === 0) return "";
    
    const headers = Object.keys(data[0]);
    
    const escapeCsvCell = (cell) => {
        const cellStr = String(cell || '');
        // If the cell contains a comma, a quote, or a newline, wrap it in double quotes.
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            // Escape existing double quotes by doubling them up.
            return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
    };

    const csvRows = [
        headers.join(','),
        ...data.map(row => 
            headers.map(header => escapeCsvCell(row[header])).join(',')
        )
    ];

    return csvRows.join('\n');
}

/**
 * Creates a debounced function that delays invoking the provided function
 * until after `timeout` milliseconds have elapsed since the last time
 * the debounced function was invoked.
 * @param {Function} func The function to debounce.
 * @param {number} timeout The number of milliseconds to delay.
 * @returns {(...args: any[]) => void} The new debounced function.
 */
function debounce(func, timeout = 500){
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

module.exports = { convertToCsv, debounce };