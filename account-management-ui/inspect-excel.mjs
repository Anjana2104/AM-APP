import XLSX from 'xlsx';

const filePath = "C:/Users/ASharma33/OneDrive - Rockwell Automation, Inc/Anjana Sharma - All Important Documents/1. My work/RA Work/AM-APP/Ref docs/Client Request Details.xlsx";

try {
  const file = XLSX.readFile(filePath, { cellDates: true, defval: '' });
  const ws = file.Sheets[file.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(ws, { defval: '', blankrows: false });

  console.log("=== TOTAL ROWS:", json.length);
  console.log("\n=== FIRST ROW ===");
  if (json[0]) {
    Object.entries(json[0]).forEach(([k, v]) => {
      console.log(`${k}: '${v}' (${typeof v})`);
    });
  }
  
  console.log("\n=== UNIQUE STATUS VALUES ===");
  const processingStatuses = new Set();
  const overallStatuses = new Set();

  json.forEach(row => {
    if (row['Processing Status']) processingStatuses.add(row['Processing Status']);
    if (row['Overall Status']) overallStatuses.add(row['Overall Status']);
  });

  console.log("Processing Status:", Array.from(processingStatuses).sort());
  console.log("Overall Status:", Array.from(overallStatuses).sort());

  console.log("\n=== DATE ANALYSIS ===");
  const row1 = json[0];
  if (row1) {
    console.log("Request Raised:", row1['Request Raised'], "type:", typeof row1['Request Raised']);
    console.log("Updated on:", row1['Updated on'], "type:", typeof row1['Updated on']);
  }
} catch(err) {
  console.error("Error:", err.message);
}
