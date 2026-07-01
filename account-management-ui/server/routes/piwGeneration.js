/**
 * PIW Generation Routes
 * Uses xlsx-populate to modify only target cells while preserving ALL
 * formatting, styles, formulas, and VBA macros from the template.
 *
 * Cell map (from template inspection):
 *
 * T&M sheet rows 20+:
 *   F = Staffing Notes       — EMPTY → write name
 *   G = Resource Type        — EMPTY → write resource type
 *   H = Standard Rate        — HAS FORMULA (VLOOKUP Resource_List) → DO NOT TOUCH
 *   I = Project Rate         — EMPTY rows 21+ → write formula =H{row}/8
 *   J = Final Project Rate   — HAS FORMULA IF(I="",H,I)           → DO NOT TOUCH
 *   K = Revenue at Standard  — HAS FORMULA H*M                    → DO NOT TOUCH
 *   L = Revenue at Proj Rate — HAS FORMULA J*M                    → DO NOT TOUCH
 *   M = Budgeted Hours       — HAS FORMULA SUM(N:DM)              → DO NOT TOUCH
 *   N+ = Week 1, 2, ...      — EMPTY → write 40
 *
 * Fixed Fee sheet rows 20+:
 *   F = Staffing Notes       — EMPTY → write name
 *   G = Resource Type        — EMPTY → write resource type
 *   H = Standard Rate        — HAS FORMULA (VLOOKUP)              → DO NOT TOUCH
 *   I = Normalized Rate      — HAS FORMULA IFERROR($H$10*H,0)    → DO NOT TOUCH
 *   J,K,L = formulas         — DO NOT TOUCH
 *   M+ = Week 1, 2, ...      — EMPTY → write 40
 */

const express = require('express');
const router = express.Router();
const XlsxPopulate = require('xlsx-populate');
const { getDb } = require('../db/connection');


// ── RA Bangalore FIXED Public Holidays ───────────────────────────────────
// Only mandatory/fixed holidays — excludes restricted/optional leaves.
// Covers: National holidays + Karnataka state fixed holidays (Bangalore).
const RA_BANGALORE_HOLIDAYS = [
  // 2025
  { date: '2025-01-26', name: 'Republic Day' },
  { date: '2025-04-14', name: 'Dr. B.R. Ambedkar Jayanti' },
  { date: '2025-05-01', name: 'May Day (Labour Day)' },
  { date: '2025-08-15', name: 'Independence Day' },
  { date: '2025-08-27', name: 'Ganesh Chaturthi (Karnataka)' },
  { date: '2025-10-02', name: 'Gandhi Jayanti / Dussehra (Vijaya Dashami)' },
  { date: '2025-10-21', name: 'Diwali / Lakshmi Puja' },
  { date: '2025-11-01', name: 'Kannada Rajyotsava (Bangalore Fixed)' },
  { date: '2025-12-25', name: 'Christmas Day' },
  // 2026
  { date: '2026-01-26', name: 'Republic Day' },
  { date: '2026-03-25', name: 'Ugadi (Karnataka New Year)' },
  { date: '2026-04-14', name: 'Dr. B.R. Ambedkar Jayanti' },
  { date: '2026-05-01', name: 'May Day (Labour Day)' },
  { date: '2026-08-15', name: 'Independence Day' },
  { date: '2026-09-16', name: 'Ganesh Chaturthi (Karnataka)' },
  { date: '2026-10-02', name: 'Gandhi Jayanti' },
  { date: '2026-10-19', name: 'Diwali / Lakshmi Puja' },
  { date: '2026-11-01', name: 'Kannada Rajyotsava (Bangalore Fixed)' },
  { date: '2026-12-25', name: 'Christmas Day' },
];

// Build a Set of YYYY-MM-DD strings for fast lookup
const HOLIDAY_SET = new Set(RA_BANGALORE_HOLIDAYS.map(h => h.date));
const HOLIDAY_MAP = Object.fromEntries(RA_BANGALORE_HOLIDAYS.map(h => [h.date, h.name]));

// Count Mon-Fri weekdays in [start, end] inclusive, excluding public holidays
function countWorkdays(start, end) {
  let count = 0;
  const d = new Date(start.getTime());
  while (d <= end) {
    const day = d.getUTCDay();
    const ds  = d.toISOString().slice(0, 10);
    if (day >= 1 && day <= 5 && !HOLIDAY_SET.has(ds)) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

// Count Mon-Fri weekdays only (no holiday deduction — for raw gross)
function countWeekdays(start, end) {
  let count = 0;
  const d = new Date(start.getTime());
  while (d <= end) {
    const day = d.getUTCDay();
    if (day >= 1 && day <= 5) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

// Get public holidays (Mon-Fri only) within [start, end]
function getHolidaysInRange(start, end) {
  const result = [];
  const d = new Date(start.getTime());
  while (d <= end) {
    const day = d.getUTCDay();
    const ds  = d.toISOString().slice(0, 10);
    if (day >= 1 && day <= 5 && HOLIDAY_SET.has(ds)) {
      result.push({ date: ds, name: HOLIDAY_MAP[ds] });
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return result;
}

function nearestPrecedingMonday(dateStr) {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  return new Date(d.getTime() - offset * 86400000);
}


// Returns true if this week (Mon–Sun) contains the 1st of any calendar month
// (used to deduct 1 assumed leave day in the first week of every month the resource works)
function weekIsFirstOfMonth(weekStart, weekEnd) {
  const d = new Date(weekStart.getTime());
  while (d <= weekEnd) {
    if (d.getUTCDate() === 1) return true;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return false;
}
const DELIVERY_SHEETS = [
  {
    sheetName: 'T&M',
    dataStartRow: 20,
    staffingCol:     6,   // F — Staffing Notes (write name)
    resourceTypeCol: 7,   // G — Resource Type  (write role; VLOOKUP in H reads from G)
    projectRateCol:  9,   // I — Project Rate   (write formula =H{row}/8)
    week1Col:        14,  // N — Week 1
  },
  {
    sheetName: 'Fixed Fee',
    dataStartRow: 20,
    staffingCol:     6,   // F — Staffing Notes
    resourceTypeCol: 7,   // G — Resource Type
    projectRateCol:  null, // I has formula already — do not touch
    week1Col:        13,  // M — Week 1
  },
];

router.post('/generate', async (req, res) => {
  try {
    const {
      projectName, sowNumber, crmOpportunityId,
      contractType, currency, plannedStartDate, plannedEndDate,
      resources = []
    } = req.body;


    const db = await getDb();
    const template = db.get(
      'SELECT file_name, file_data FROM templates WHERE type = ? ORDER BY uploaded_at DESC LIMIT 1',
      ['piw_template']
    );
    if (!template) {
      return res.status(404).json({ error: 'PIW template not found. Upload one in Configuration → Templates.' });
    }

    const fileBuffer = Buffer.from(template.file_data);

    // ── Load holiday calendar from uploaded Excel (if available) ─────────
    let activeHolidays = [...RA_BANGALORE_HOLIDAYS]; // default: hardcoded list
    try {
      const holTemplate = db.get(
        'SELECT file_name, file_data FROM templates WHERE type = ? ORDER BY uploaded_at DESC LIMIT 1',
        ['holiday_calendar']
      );
      if (holTemplate && (holTemplate.file_name.endsWith('.xlsx') || holTemplate.file_name.endsWith('.xls'))) {
        const XLSX = require('xlsx');
        const holBuf = Buffer.from(holTemplate.file_data);
        const holWb  = XLSX.read(holBuf, { type: 'buffer', cellDates: false });
        const holWs  = holWb.Sheets[holWb.SheetNames[0]];
        const holRows = XLSX.utils.sheet_to_json(holWs, { raw: false });
        // Normalise header keys by trimming whitespace
        const normRows = holRows.map(row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k.trim(), v])));
        const parsed = [];
        normRows.forEach(row => {
          const rawDate = row['Date'] || row['date'] || row['DATE'] || '';
          const rawName = row['Holiday'] || row['holiday'] || row['Name'] || row['name'] || row['Description'] || '';
          if (!rawDate) return;
          // Normalise date string → YYYY-MM-DD
          // Handles: "January 26, 2026" / M/D/YY / M/D/YYYY / YYYY-MM-DD / DD-MM-YYYY
          let iso = '';
          const s = String(rawDate).trim();
          if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
            iso = s.slice(0, 10);
          } else {
            // "Month DD, YYYY" — e.g. "January 26, 2026"
            const longDate = new Date(s);
            if (!isNaN(longDate.getTime())) {
              // new Date() parses "Month DD, YYYY" in local time — use local getters
              const y = longDate.getFullYear();
              const m = String(longDate.getMonth() + 1).padStart(2, '0');
              const d = String(longDate.getDate()).padStart(2, '0');
              iso = `${y}-${m}-${d}`;
            }
          }
          if (!iso) { const mdy2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/); if (mdy2) iso = `${2000+parseInt(mdy2[3])}-${mdy2[1].padStart(2,'0')}-${mdy2[2].padStart(2,'0')}`; }
          if (!iso) { const mdy4 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (mdy4) iso = `${mdy4[3]}-${mdy4[1].padStart(2,'0')}-${mdy4[2].padStart(2,'0')}`; }
          if (!iso) { const dmy = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/); if (dmy) iso = `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`; }
          if (iso) parsed.push({ date: iso, name: String(rawName).trim() || 'Holiday' });
        });
        if (parsed.length > 0) {
          activeHolidays = parsed;
        }
      }
    } catch (holErr) {
    }

    // Rebuild holiday sets from active list
    const HOLIDAY_SET_ACTIVE = new Set(activeHolidays.map(h => h.date));
    const HOLIDAY_MAP_ACTIVE = Object.fromEntries(activeHolidays.map(h => [h.date, h.name]));
    const getHolidaysActive = (start, end) => {
      const result = [];
      const d = new Date(start.getTime());
      while (d <= end) {
        const day = d.getUTCDay();
        const ds  = d.toISOString().slice(0, 10);
        if (day >= 1 && day <= 5 && HOLIDAY_SET_ACTIVE.has(ds)) result.push({ date: ds, name: HOLIDAY_MAP_ACTIVE[ds] });
        d.setUTCDate(d.getUTCDate() + 1);
      }
      return result;
    };
    const countWeekdaysNoHol = (start, end) => {
      let count = 0;
      const d = new Date(start.getTime());
      while (d <= end) {
        const day = d.getUTCDay();
        const ds  = d.toISOString().slice(0, 10);
        if (day >= 1 && day <= 5 && !HOLIDAY_SET_ACTIVE.has(ds)) count++;
        d.setUTCDate(d.getUTCDate() + 1);
      }
      return count;
    };

    const wb = await XlsxPopulate.fromDataAsync(fileBuffer);

    // ── 1. Fill FrontPage (plain data entry cells only) ───────────────────
    const fp = wb.sheet('FrontPage');
    if (!fp) return res.status(500).json({ error: 'FrontPage sheet not found in template' });

    // Snap project start to nearest preceding Monday so week columns are Mon-Sun aligned
    const projectMonday = plannedStartDate ? nearestPrecedingMonday(plannedStartDate) : null;

    fp.cell('B4').value(projectName || '');
    fp.cell('B5').value(sowNumber || '');
    fp.cell('B6').value(crmOpportunityId || '');
    fp.cell('B7').value(contractType || 'T&M');
    // B8 (Currency) is hardcoded in the template — do not overwrite
    if (projectMonday) fp.cell('B9').value(projectMonday);   // week-1 header = this Monday
    if (plannedEndDate) fp.cell('B10').value(new Date(plannedEndDate));

    // ── 2. Fill BOTH delivery sheets ──────────────────────────────────────
    if (resources.length > 0) {

      for (const cfg of DELIVERY_SHEETS) {
        const sheet = wb.sheet(cfg.sheetName);

        resources.forEach((resource, i) => {
          const row = cfg.dataStartRow + i;
          const { name = '', resourceType = '', dailyRate = 0, allocationPercentage = 100, resourceStartDate, resourceEndDate } = resource;
          const normalizedAllocation = Math.max(1, Math.min(100, Number(allocationPercentage) || 100));
          const hoursPerDay = 8 * (normalizedAllocation / 100);

          const resStart = new Date(resourceStartDate || plannedStartDate);
          const resEnd   = new Date(resourceEndDate   || plannedEndDate);
          const week1Monday = projectMonday || nearestPrecedingMonday(resStart.toISOString());

          // Which week indices does this resource span?
          const startWeekIdx = Math.max(0, Math.floor((resStart - week1Monday) / (7 * 86400000)));
          const endWeekIdx   = Math.floor((resEnd - week1Monday) / (7 * 86400000));

          sheet.cell(row, cfg.staffingCol).value(name);
          sheet.cell(row, cfg.resourceTypeCol).value(resourceType);
          // Write project rate as a visible formula (dailyRate/8) so it's verifiable in Excel
          if (cfg.projectRateCol && dailyRate > 0) {
            sheet.cell(row, cfg.projectRateCol).formula(`${dailyRate}/8`);
          }

          // Track which months have already had their 1-day leave deducted (per resource)
          const monthLeaveDeducted = new Set();

          for (let w = startWeekIdx; w <= endWeekIdx; w++) {
            const weekStart = new Date(week1Monday.getTime() + w * 7 * 86400000);
            const weekEnd   = new Date(weekStart.getTime() + 6 * 86400000); // Sun
            const overlapStart = new Date(Math.max(resStart.getTime(), weekStart.getTime()));
            const overlapEnd   = new Date(Math.min(resEnd.getTime(), weekEnd.getTime()));

            // Gross weekdays (Mon-Fri) in this overlap
            let grossHours = countWeekdays(overlapStart, overlapEnd) * hoursPerDay;            if (grossHours <= 0) continue;

            // Deduct RA Bangalore public holidays in this week
            const weekHolidays = getHolidaysActive(overlapStart, overlapEnd);
            const holidayHours = weekHolidays.length * hoursPerDay;

            // Deduct 1 assumed leave in first active week of each month
            const newMonths = [];
            const d = new Date(overlapStart.getTime());
            while (d <= overlapEnd) {
              const dayOfWeek = d.getUTCDay();
              const ds = d.toISOString().slice(0, 10);
              if (dayOfWeek >= 1 && dayOfWeek <= 5 && !HOLIDAY_SET_ACTIVE.has(ds)) {
                const mk = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
                if (!monthLeaveDeducted.has(mk) && !newMonths.includes(mk)) newMonths.push(mk);
              }
              d.setUTCDate(d.getUTCDate() + 1);
            }
            newMonths.forEach(mk => monthLeaveDeducted.add(mk));
            const leaveHours = newMonths.length * hoursPerDay;

            const netHours = Math.max(0, grossHours - holidayHours - leaveHours);
            if (netHours <= 0 && grossHours > 0) continue; // whole week is holiday/leave

            const cell = sheet.cell(row, cfg.week1Col + w);
            cell.value(netHours);

            // Build cell comment — short format, dates as "26 Jan 2026"
            const commentLines = [];
            const FMT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const fmtDate = ds => { const d = new Date(ds); return `${d.getUTCDate()} ${FMT_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
            if (holidayHours > 0) {
              weekHolidays.forEach(h => commentLines.push(`${fmtDate(h.date)}: ${h.name}`));
            }
            if (leaveHours > 0) {
              commentLines.push('1 assumed leave');
            }
            if (commentLines.length > 0) {
              commentLines.unshift(`${grossHours}→${netHours} hrs @ ${normalizedAllocation}% (${hoursPerDay} hrs/day)`);
              try { cell.comment(commentLines.join('\n')); } catch (_) {}
            }
          }
        });

      }
    }

    // ── 3. Build "Calculation" sheet for verification ─────────────────────
    try {
      const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

      const countWorkdaysInRange = (s1, e1, s2, e2) => {
        const start = new Date(Math.max(s1.getTime(), s2.getTime()));
        const end   = new Date(Math.min(e1.getTime(), e2.getTime()));
        return start <= end ? countWorkdays(start, end) : 0;
      };
      const countWeekdaysInRange = (s1, e1, s2, e2) => {
        const start = new Date(Math.max(s1.getTime(), s2.getTime()));
        const end   = new Date(Math.min(e1.getTime(), e2.getTime()));
        return start <= end ? countWeekdays(start, end) : 0;
      };

      // Build per-resource monthly breakdown (mirrors week-filling logic)
      const calcData = resources.map((resource, idx) => {
        const { name = '', resourceType = '', dailyRate = 0, skillType = '', raId = '', allocationPercentage = 100, resourceStartDate, resourceEndDate } = resource;
        const normalizedAllocation = Math.max(1, Math.min(100, Number(allocationPercentage) || 100));
        const hoursPerDay = 8 * (normalizedAllocation / 100);
        const resStart = new Date(resourceStartDate || plannedStartDate);
        const resEnd   = new Date(resourceEndDate   || plannedEndDate);
        const week1Monday = projectMonday || nearestPrecedingMonday(resStart.toISOString());

        const monthLeaveTrack = new Set();
        const months = [];
        const cur = new Date(Date.UTC(resStart.getUTCFullYear(), resStart.getUTCMonth(), 1));
        const lastMonth = new Date(Date.UTC(resEnd.getUTCFullYear(), resEnd.getUTCMonth(), 1));

        while (cur <= lastMonth) {
          const mStart = new Date(cur.getTime());
          const mEnd   = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 0));
          const overlapStart = new Date(Math.max(resStart.getTime(), mStart.getTime()));
          const overlapEnd   = new Date(Math.min(resEnd.getTime(), mEnd.getTime()));

          const grossDays    = countWeekdaysInRange(resStart, resEnd, mStart, mEnd);
          const publicHols   = getHolidaysActive(overlapStart, overlapEnd);
          const holDays      = publicHols.length;

          // First active week of this month for assumed leave
          let leaveWeekLabel = '';
          if (grossDays > 0) {
            const mk = `${cur.getUTCFullYear()}-${cur.getUTCMonth()}`;
            if (!monthLeaveTrack.has(mk)) {
              monthLeaveTrack.add(mk);
              // Find the Monday of the first week this resource is active in this month
              const firstActiveDay = new Date(Math.max(resStart.getTime(), mStart.getTime()));
              const wkMon = nearestPrecedingMonday(firstActiveDay.toISOString());
              const FMN2 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              leaveWeekLabel = `Week of ${wkMon.getUTCDate()} ${FMN2[wkMon.getUTCMonth()]} ${wkMon.getUTCFullYear()}`;
            }
          }
          const leaveDays  = leaveWeekLabel ? 1 : 0;
          const netDays    = Math.max(0, grossDays - holDays - leaveDays);

          months.push({
            label: `${MONTH_NAMES[cur.getUTCMonth()]} ${cur.getUTCFullYear()}`,
            grossDays, holDays, leaveDays, netDays,
            netHours: netDays * hoursPerDay,
            publicHolidays: publicHols,
            leaveWeekLabel,
          });
          cur.setUTCMonth(cur.getUTCMonth() + 1);
        }

        const totalNetHours = months.reduce((s, m) => s + m.netHours, 0);
        return { sno: idx + 1, raId, name, resourceType, skillType, allocationPercentage: normalizedAllocation, hoursPerDay, dailyRate, hourlyRate: dailyRate / 8,
                 startDate: resStart.toISOString().slice(0,10), endDate: resEnd.toISOString().slice(0,10),
                 months, totalNetHours };
      });

      const calcSheet = wb.addSheet('Calculation');

      const SS = (cell, obj) => {
        try {
          if (obj.bold !== undefined)             cell.style('bold', obj.bold);
          if (obj.fontSize)                       cell.style('fontSize', obj.fontSize);
          if (obj.fill)                           cell.style('fill', obj.fill);
          if (obj.fontColor)                      cell.style('fontColor', obj.fontColor);
          if (obj.hAlign)                         cell.style('horizontalAlignment', obj.hAlign);
          if (obj.wrapText !== undefined)         cell.style('wrapText', obj.wrapText);
        } catch (_) {}
      };

      const HDR1 = { bold: true, fill: { type: 'solid', color: '1F3864' }, fontColor: 'FFFFFF', fontSize: 10 };
      const HDR2 = { bold: true, fill: { type: 'solid', color: '2E75B6' }, fontColor: 'FFFFFF', fontSize: 10 };
      const TOTAL = { bold: true, fill: { type: 'solid', color: 'FFF2CC' }, fontSize: 10 };
      const DATA  = { fontSize: 10 };
      const HOLI  = { fontSize: 10, fill: { type: 'solid', color: 'FFE6E6' } };
      const NUM   = { fontSize: 10, hAlign: 'center' };
      const LEAVE = { fontSize: 10, fill: { type: 'solid', color: 'E2EFDA' } };
      const fmtDS = ds => { const FMN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; const d = new Date(ds); return `${d.getUTCDate()} ${FMN[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

      let r = 1;

      // Title
      SS(calcSheet.cell(r, 1).value('PIW Resource Calculation Verification — RA Bangalore'), { bold: true, fontSize: 13 });
      r++;
      SS(calcSheet.cell(r, 1).value(`Project: ${projectName || '(unnamed)'}   |   Generated: ${new Date().toLocaleDateString('en-IN')}   |   Holidays: RA Bangalore calendar`), { fontSize: 10 });
      r += 2;

      // ── SECTION 1: Resource Summary ──────────────────────────────────────
      SS(calcSheet.cell(r, 1).value('SECTION 1: RESOURCE SUMMARY'), { bold: true, fontSize: 11 });
      r++;
      ['#', 'RAID', 'Resource Name', 'PIW Role', 'Skill Type', 'Allocation %', 'Hours / Day', 'Daily Rate', 'Hourly Rate (÷8)', 'Start Date', 'End Date', 'Total Net Hours'].forEach((h, ci) => SS(calcSheet.cell(r, ci+1).value(h), HDR1));
      r++;
      calcData.forEach(res => {
        const vals = [res.sno, res.raId || '—', res.name, res.resourceType, res.skillType,
                      res.allocationPercentage, +res.hoursPerDay.toFixed(2), res.dailyRate, +res.hourlyRate.toFixed(2), fmtDS(res.startDate), fmtDS(res.endDate), res.totalNetHours];
        vals.forEach((v, ci) => SS(calcSheet.cell(r, ci+1).value(v), ci >= 5 ? NUM : DATA));
        r++;
      });

      r += 2;

      // ── SECTION 2: Monthly Breakdown with holidays ────────────────────────
      SS(calcSheet.cell(r, 1).value('SECTION 2: MONTHLY BREAKDOWN (Gross → Fixed Holidays → Assumed Leave → Net)'), { bold: true, fontSize: 11 });
      r++;
      const mbCols = ['#', 'Resource Name', 'Month', 'Allocation %', 'Hours / Day', 'Gross Days', 'Fixed Holidays', 'Assumed Leave Day', 'Net Working Days', 'Net Billable Hours', 'Assumed Leave Week', 'Comments'];
      mbCols.forEach((h, ci) => SS(calcSheet.cell(r, ci+1).value(h), HDR2));
      r++;

      calcData.forEach(res => {
        res.months.forEach(m => {
          const commentVal = m.publicHolidays.length > 0
            ? m.publicHolidays.map(h => `${fmtDS(h.date)}: ${h.name}`).join(', ')
            : '—';

          const vals = [res.sno, res.name, m.label, res.allocationPercentage, +res.hoursPerDay.toFixed(2), m.grossDays, m.holDays, m.leaveDays, m.netDays, m.netHours, m.leaveWeekLabel || '—', commentVal];
          vals.forEach((v, ci) => {
            let style = DATA;
            if (ci === 6 && m.holDays > 0) style = HOLI;
            else if (ci === 7 && m.leaveDays > 0) style = LEAVE;
            else if (ci >= 3 && ci <= 9) style = NUM;
            SS(calcSheet.cell(r, ci+1).value(v), style);
          });
          r++;
        });
        // Resource total
        const tv = ['', res.name + ' — TOTAL', '',
          res.months.reduce((s,m)=>s+m.grossDays,0),
          res.months.reduce((s,m)=>s+m.holDays,0),
          res.months.reduce((s,m)=>s+m.leaveDays,0),
          res.months.reduce((s,m)=>s+m.netDays,0),
          res.totalNetHours, '', ''];
        tv.forEach((v, ci) => SS(calcSheet.cell(r, ci+1).value(v), TOTAL));
        r++;
      });

      r += 2;

      // ── SECTION 3: Public Holiday Reference List ──────────────────────────
      SS(calcSheet.cell(r, 1).value(`SECTION 3: HOLIDAY REFERENCE (${activeHolidays === RA_BANGALORE_HOLIDAYS ? 'RA Bangalore Default — Fixed Mandatory' : 'Loaded from uploaded Excel'})`), { bold: true, fontSize: 11 });
      r++;
      ['Date', 'Holiday Name', 'Day'].forEach((h, ci) => SS(calcSheet.cell(r, ci+1).value(h), HDR1));
      r++;
      activeHolidays.forEach(h => {        const d = new Date(h.date);
        const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()];
        [h.date, h.name, dayName].forEach((v, ci) => SS(calcSheet.cell(r, ci+1).value(v), DATA));
        r++;
      });

      r += 2;

      // ── SECTION 4: Assumptions ────────────────────────────────────────────
      SS(calcSheet.cell(r, 1).value('SECTION 4: ASSUMPTIONS & METHODOLOGY'), { bold: true, fontSize: 11 });
      r++;
      [
        '• Working week: Mon–Fri, 8 hrs/day',
        '• Public holidays: RA Bangalore FIXED holidays only (National + Karnataka state mandatory) — restricted/optional leaves NOT included',
        '• Assumed leave: 1 day per calendar month per resource, deducted from the first active working week of that month',
        '• Partial weeks: pro-rated by actual Mon–Fri days within resource engagement range',
        '• Week alignment: Project weeks start on nearest preceding Monday from project start date',
        '• Project Rate = Daily Rate ÷ 8  (rate from RA rate card based on experience & skill type)',
        '• Net Billable Hours = (Gross Days − Fixed Holiday Days − Assumed Leave Day) × 8',
      ].forEach(a => { SS(calcSheet.cell(r, 1).value(a), { fontSize: 10 }); r++; });

      // Column widths
      [6, 28, 14, 12, 16, 18, 18, 18, 24, 50].forEach((w, i) => {
        try { calcSheet.column(i + 1).width(w); } catch (_) {}
      });

    } catch (calcErr) {
    }

    // ── 4. Output ─────────────────────────────────────────────────────────
    const outBuffer = await wb.outputAsync();    const safeName = (projectName || 'PIW').replace(/[^a-zA-Z0-9]/g, '-');
    const fileName = `PIW-${safeName}.xlsm`;

    res.set('Content-Type', 'application/vnd.ms-excel.sheet.macroEnabled.12');
    res.set('Content-Disposition', `attachment; filename="${fileName}"`);
    res.set('Content-Length', outBuffer.length);
    res.end(outBuffer);

  } catch (error) {
    console.error('❌ PIW generation error:', error.message);
    res.status(500).json({ error: 'Failed to generate PIW', message: error.message });
  }
});

module.exports = router;
