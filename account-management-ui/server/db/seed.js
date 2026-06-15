/**
 * db/seed.js
 * Reads Revenue Details.xlsx and populates the SQLite database.
 * Run: node db/seed.js  (from server/ directory)
 * Or:  node db/seed.js <path-to-xlsx>
 */

const XLSX = require("xlsx");
const path = require("path");
const { getDb, resetDb } = require("./connection");

const DEFAULT_XLSX = path.join(
  __dirname, "..", "..", "..", "..",
  "Ref docs", "Revenue Details.xlsx"
);

async function seed() {
  const xlsxPath = process.argv[2] || DEFAULT_XLSX;

  const wb = XLSX.readFile(xlsxPath);
  const sheetName = wb.SheetNames.find(n => n.includes("SOW Budget")) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(ws, { defval: "" });

  if (!raw.length) { return; }

  // Detect month columns (not fixed columns)
  const FIXED = new Set(["S.No.", "Project", "Code", "Space", "Owners"]);
  const monthCols = Object.keys(raw[0]).filter(k => !FIXED.has(k));

  const db = await getDb();

  // Clear existing data
  db.run("DELETE FROM finance_revenue");
  db.run("DELETE FROM finance_projects");

  let inserted = 0;
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    const project = String(row["Project"] || "").trim();
    if (!project) continue;

    db.run(
      `INSERT INTO finance_projects (sno, project, code, space, owner) VALUES (?, ?, ?, ?, ?)`,
      [row["S.No."] || i + 1, project, String(row["Code"] || ""), String(row["Space"] || ""), String(row["Owners"] || "")]
    );
    const projectId = db.lastId();

    for (const month of monthCols) {
      const amt = parseFloat(row[month]);
      if (!isNaN(amt) && amt !== 0) {
        db.run(
          `INSERT OR REPLACE INTO finance_revenue (project_id, month, amount) VALUES (?, ?, ?)`,
          [projectId, month, amt]
        );
      }
    }
    inserted++;
  }

  db.close();
  resetDb();
}

seed().catch(err => { process.exit(1); });