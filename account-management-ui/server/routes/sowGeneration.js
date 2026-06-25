/**
 * SOW Generation Routes
 *
 * Template: "SOW Template - June 2026.docx" (RA Internal Process / SOW)
 *
 * Highlighted placeholder replacements:
 *   "Work Order"         → Work Order (SOW) field from UI
 *   "Current Date"       → today's date (18 June 2026 format), appears twice
 *   "Service Provider"   → Service Provider field, appears twice (body + signature)
 *   "Work Product/Service"                       → Work Product / Service field
 *   "Service Provider's Personnel to be assigned" → Personnel field
 *
 * Resource table (9 columns): same structure as before
 */

const express   = require('express');
const router    = express.Router();
const { getDb } = require('../db/connection');


const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

function fmtDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}-${months[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(2)}`;
}
function fmtDateLong(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function escXml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/**
 * Replace consecutive yellow-highlighted OOXML runs whose combined text
 * equals `phrase` with a single run containing `value`.
 *
 * Uses:
 *  - Negative-lookahead regex so rPr matching never crosses </w:rPr> boundary
 *    (prevents matching non-highlighted runs that happen to precede a highlight)
 *  - Scan-and-compare approach (no large multi-capture regex) for consecutive runs
 *  - [^<]* for text content (safe — <w:t> text never contains <)
 */
function replHighPhrase(xml, phrase, value) {
  if (!value) return xml;

  // Collect yellow-highlighted runs; rPr bounded by </w:rPr> via negative lookahead
  const runRe = /<w:r(?:\s[^>]*)?>(<w:rPr>(?:(?!<\/w:rPr>)[\s\S])*?<w:highlight w:val="yellow"\/>(?:(?!<\/w:rPr>)[\s\S])*?<\/w:rPr>)<w:t[^>]*>([^<]*)<\/w:t><\/w:r>/g;
  const runs = [];
  let m;
  runRe.lastIndex = 0;
  while ((m = runRe.exec(xml)) !== null) {
    runs.push({ start: m.index, end: m.index + m[0].length, rPr: m[1], text: m[2] });
  }

  // Normalise phrase for comparison: replace curly/straight apostrophe variants
  const normalise = s => s.replace(/[\u2018\u2019\u0027]/g, '\u2019');
  const normPhrase = normalise(phrase);

  for (let i = 0; i < runs.length; i++) {
    let combined = '';
    for (let j = i; j < runs.length; j++) {
      if (j > i && runs[j].start !== runs[j - 1].end) break;
      combined += runs[j].text;
      if (normalise(combined) === normPhrase) {
        const cleanRPr = runs[i].rPr.replace(/<w:highlight[^/]*\/>/g, '');
        return (
          xml.slice(0, runs[i].start) +
          `<w:r>${cleanRPr}<w:t xml:space="preserve">${escXml(value)}</w:t></w:r>` +
          xml.slice(runs[j].end)
        );
      }
      if (combined.length > phrase.length) break;
    }
  }

  console.warn(`⚠️  replHighPhrase: phrase not found: "${phrase}"`);
  return xml;
}

/** Build a plain data row for the 9-column resource table */
function buildRow(cells) {
  const cellXml = cells.map((txt, i) => {
    const leftBorder = i === 0
      ? '<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
      : '<w:left w:val="nil"/>';
    return `<w:tc><w:tcPr><w:tcBorders>` +
      `<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>` +
      `${leftBorder}` +
      `<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>` +
      `<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>` +
      `</w:tcBorders><w:vAlign w:val="center"/></w:tcPr>` +
      `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>` +
      `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>` +
      `<w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>` +
      `<w:t xml:space="preserve">${escXml(String(txt ?? ''))}</w:t></w:r></w:p></w:tc>`;
  }).join('');
  return `<w:tr><w:trPr><w:trHeight w:val="260"/></w:trPr>${cellXml}</w:tr>`;
}

router.post('/generate', async (req, res) => {
  try {
    const {
      sowNumber, serviceProvider, workProduct, personnelNote,
      signatoryName, resources = [],
    } = req.body;

    const providerName = serviceProvider || 'Rockwell Automation Pvt Ltd';
    const todayStr     = new Date().toISOString().slice(0, 10);
    const todayFmt     = fmtDateLong(todayStr); // e.g. "18 June 2026"


    const db = await getDb();
    const template = db.get(
      'SELECT file_name, file_data FROM templates WHERE type = ? ORDER BY uploaded_at DESC LIMIT 1',
      ['sow_template']
    );
    if (!template) {
      return res.status(404).json({ error: 'SOW template not found. Upload one in Configuration → Templates.' });
    }

    const fileBuffer = Buffer.from(template.file_data);

    const PizZip = require('pizzip');
    const zip = new PizZip(fileBuffer);
    let xml = zip.files['word/document.xml'].asText();

    // ── 1. Work Order (SOW) — highlighted "Work Order" (3 runs) ────────────────────
    if (sowNumber) {
      xml = replHighPhrase(xml, 'Work Order', sowNumber);
    }

    // ── 2. Current Date — single highlighted run, appears twice (header + body) ──────
    xml = xml.split('>Current Date<').join(`>${escXml(todayFmt)}<`);

    // ── 3. Service Provider — single highlighted run, appears twice (body + signature)─
    xml = xml.split('>Service Provider<').join(`>${escXml(providerName)}<`);

    // ── 4. Work Product / Service — highlighted "Work Product/Service" (3 runs) ───────
    if (workProduct) {
      xml = replHighPhrase(xml, 'Work Product/Service', workProduct);
    }

    // ── 5. Personnel — 9 highlighted runs; apostrophe normalised automatically ─────────
    if (personnelNote) {
      xml = replHighPhrase(xml, "Service Provider's Personnel to be assigned", personnelNote);
    }

    // ── 6. Inject resource table rows ────────────────────────────────────────────────
    const rowsXml = resources.map(r => buildRow([
      r.empId     || r.raId     || '',
      r.name      || '',
      r.skill     || r.resourceType || '',
      r.location  || 'Bengaluru',
      r.experience|| '',
      r.overheadCategory || '',
      fmtDateShort(r.resourceStartDate),
      fmtDateShort(r.resourceEndDate),
      r.dailyRate ? r.dailyRate.toLocaleString('en-IN') : '',
    ])).join('');
    xml = xml.replace('</w:tbl>', rowsXml + '</w:tbl>');

    // ── 7. Signatory name (second "Authorized Signatory" = RA side) ──────────────────
    if (signatoryName) {
      let count = 0;
      xml = xml.replace(/>Authorized Signatory</g, (match) => {
        count++;
        return count === 2 ? `>${escXml(signatoryName)}<` : match;
      });
    }

    // ── Pack and send ─────────────────────────────────────────────────────────────────
    zip.file('word/document.xml', xml);
    const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    const downloadName = req.body.sowName || sowNumber || 'SOW';
    const safeFileName = downloadName.replace(/[^\w\s\-]/g, '').trim();

    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}.docx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buf);
  } catch (err) {
    console.error('❌ SOW generation error:', err.message || err);
    res.status(500).json({ error: err.message || 'SOW generation failed' });
  }
});

module.exports = router;

