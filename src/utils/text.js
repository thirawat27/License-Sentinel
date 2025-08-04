// --- START OF FILE src/utils/text.js (FINAL) ---

function convertToCsv(data) {
    if (!data || data.length === 0) return "";
    
    const headers = Object.keys(data[0]);
    
    const escapeCsvCell = (cell) => {
        const cellStr = String(cell || '');
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
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

function debounce(func, timeout = 500){
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { 
        func.apply(this, args); 
    }, timeout);
  };
}

module.exports = { convertToCsv, debounce };
// --- END OF FILE src/utils/text.js (FINAL) ---