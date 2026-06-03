/**
 * db/seed-resources.js
 * Seeds resources table from Resource Information.xlsx
 * Run: node db/seed-resources.js  (from server/ directory)
 * Or:  node db/seed-resources.js <path-to-xlsx>
 */

const XLSX = require("xlsx");
const path = require("path");
const { getDb, resetDb } = require("./connection");

const DEFAULT_XLSX = path.join(
  __dirname, "..", "..", "..", "..",
  "Ref docs", "Resource", "Resource Information.xlsx"
);

async function seed() {
  const xlsxPath = process.argv[2] || DEFAULT_XLSX;
  console.log("Reading:", xlsxPath);

  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

  if (!rows.length) { console.log("No rows found."); return; }
  console.log("Columns:", Object.keys(rows[0]).join(" | "));

  const db = await getDb();
  db.run("DELETE FROM resources");

  let inserted = 0;
  rows.forEach((r, i) => {
    const raId = String(r["RA ID"] || r["Ra ID"] || "").trim();
    if (!raId) return;
    db.run(
      `INSERT INTO resources (sno, ra_id, emp_name, email_id, piw_role, role_or_domain,
       previous_workex, doj, total_workex, engagement, skills) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        r["S.NO"] || i + 1,
        raId,
        String(r["Emp Name"] || r["Employee Name"] || "").trim(),
        String(r["Email Id"] || r["Email ID"] || "").trim(),
        String(r["PIW Role"] || r["Role"] || "").trim(),
        String(r["Role/Domain"] || r["Domain"] || "").trim(),
        String(r["Previous Workex"] || r["Prev Workex"] || "").trim(),
        String(r["DOJ"] || r["Date of Joining"] || "").trim(),
        String(r["Total Workex"] || r["Total Experience"] || "").trim(),
        String(r["Current Engagement"] || r["Engagement"] || "").trim(),
        String(r["Skills"] || "").trim(),
      ]
    );
    inserted++;
  });

  console.log(`Seeded ${inserted} resources.`);
  db.close();
  resetDb();
}

seed().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });