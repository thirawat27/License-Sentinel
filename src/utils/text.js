// This file provides utility functions for text manipulation, such as converting data to CSV format and debouncing function calls.
// ไฟล์นี้มีฟังก์ชันอำนวยความสะดวกสำหรับการจัดการข้อความ เช่น การแปลงข้อมูลเป็นรูปแบบ CSV และการทำ debouncing การเรียกฟังก์ชัน

/**
 * Converts an array of objects into a CSV-formatted string.
 * @param {Array<Object>} data The array of objects to convert.
 * @returns {string} The data as a CSV string.
 */
function convertToCsv(data) {
    // If the input data is null or empty, return an empty string.
    // ถ้าข้อมูลนำเข้าเป็น null หรือว่างเปล่า, คืนค่า string ว่าง
    if (!data || data.length === 0) return "";
    
    // Extract the headers from the first object in the array.
    // ดึง headers จาก object แรกใน array
    const headers = Object.keys(data[0]);
    
    // Function to escape CSV cells that contain commas, quotes, or newlines.
    // ฟังก์ชันสำหรับ escape CSV cells ที่มี commas, quotes, หรือ newlines
    const escapeCsvCell = (cell) => {
        // Convert the cell to a string, or an empty string if it's null or undefined.
        // แปลง cell เป็น string หรือ string ว่างถ้าเป็น null หรือ undefined
        const cellStr = String(cell || '');
        // If the cell contains a comma, a quote, or a newline, wrap it in double quotes.
        // ถ้า cell มี comma, quote, หรือ newline, ให้ห่อด้วย double quotes
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            // Escape existing double quotes by doubling them up.
            // Escape double quotes ที่มีอยู่แล้วโดยการทำซ้ำ
            return `"${cellStr.replace(/"/g, '""')}"`;
        }
        // Return the cell as is.
        // คืนค่า cell ตามเดิม
        return cellStr;
    };

    // Create the CSV rows.
    // สร้าง CSV rows
    const csvRows = [
        // The first row is the headers.
        // แถวแรกคือ headers
        headers.join(','),
        // The remaining rows are the data.
        // แถวที่เหลือคือข้อมูล
        ...data.map(row => 
            // Map each row to a CSV string.
            // Map แต่ละแถวเป็น CSV string
            headers.map(header => escapeCsvCell(row[header])).join(',')
        )
    ];

    // Join the rows with newlines to create the CSV string.
    // รวมแถวด้วย newlines เพื่อสร้าง CSV string
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
  // Store the timer ID.
  // เก็บ ID ของ timer
  let timer;
  // Return a new function that will debounce the original function.
  // คืนค่าฟังก์ชันใหม่ที่จะ debounce ฟังก์ชันเดิม
  return (...args) => {
    // Clear the existing timer.
    // ล้าง timer ที่มีอยู่
    clearTimeout(timer);
    // Set a new timer.
    // ตั้ง timer ใหม่
    timer = setTimeout(() => { 
        // When the timer expires, call the original function with the provided arguments.
        // เมื่อ timer หมดเวลา, เรียกฟังก์ชันเดิมด้วย arguments ที่ให้มา
        func.apply(this, args); 
    }, timeout);
  };
}

// Export the functions.
// ส่งออกฟังก์ชัน
module.exports = { convertToCsv, debounce };