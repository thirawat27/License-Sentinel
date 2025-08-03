/**
 * แปลงข้อมูล Array of Objects เป็น String ในรูปแบบ CSV
 * @param {Array<Object>} data 
 * @returns {string}
 */
function convertToCsv(data) {
    if (data.length === 0) return "";
    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.join(','),
        ...data.map(row => 
            headers.map(header => `"${row[header] || ''}"`).join(',')
        )
    ];
    return csvRows.join('\n');
}

/**
 * สร้างฟังก์ชันที่หน่วงเวลาการเรียกใช้งาน (debounce)
 * @param {Function} func ฟังก์ชันที่ต้องการหน่วง
 * @param {number} timeout ระยะเวลาที่หน่วง (ms)
 */
function debounce(func, timeout = 500){
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

module.exports = { convertToCsv, debounce };