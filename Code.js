// =====================================================================
//  Blood Gas Reagent Tracker  —  Code.gs  (v5.8 - DIAGNOSTIC)
//  Fix: Differentiate between 0 and null, and add column diagnostics
// =====================================================================

const RECORDS_SHEET = 'Records';
const LOGS_SHEET    = 'Logs';
const USERS_SHEET   = 'Users';
const WARDS_SHEET   = 'Wards';

const USER_HEADERS = ['Username', 'Password', 'FullName', 'Role', 'Active', 'Ward'];

// ─── Utility: Advanced Dynamic Column Mapping ──────────────────────

function getColMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
  const map = {};
  
  headers.forEach((h, i) => {
    const raw = String(h || '').trim();
    if (!raw) return;
    map[raw.toLowerCase()] = i;
    const clean = raw.replace(/[^a-zA-Z0-9ก-๙]/g, '').toLowerCase();
    if (clean && map[clean] === undefined) map[clean] = i;
  });
  
  const getIdx = (candidates, defaultIdx) => {
    for (const c of candidates) {
      const cleanC = c.replace(/[^a-zA-Z0-9ก-๙]/g, '').toLowerCase();
      if (map[c.toLowerCase()] !== undefined) return map[c.toLowerCase()];
      if (map[cleanC] !== undefined) return map[cleanC];
    }
    return defaultIdx;
  };

  return {
    ts:     getIdx(['timestamp', 'เวลา'], 0),
    ward:   getIdx(['ward', 'วอร์ด', 'ตึก'], 1),
    worker: getIdx(['worker', 'ผู้บันทึก', 'ชื่อ'], 2),
    r_pct:  getIdx(['reagent%', 'reagentpct', 'reagent', 'น้ำยา'], 3),
    r_exp:  getIdx(['reagentexpiry', 'reagentexp', 'วันหมดอายุน้ำยา'], 4),
    r_lot:  getIdx(['reagentlot', 'lotreagent', 'ล็อตน้ำยา'], 13),
    w_pct:  getIdx(['wash%', 'washpct', 'wash', 'น้ำยาล้าง'], 5),
    w_exp:  getIdx(['washexpiry', 'washexp', 'วันหมดอายุน้ำยาล้าง'], 6),
    w_lot:  getIdx(['washlot', 'lotwash', 'ล็อตน้ำยาล้าง'], 14),
    q_pct:  getIdx(['qc%', 'qcpct', 'qc', 'คิวซี'], 7),
    q_exp:  getIdx(['qcexpiry', 'qcexp', 'วันหมดอายุคิวซี'], 8),
    q_lot:  getIdx(['qclot', 'lotqc', 'ล็อตคิวซี'], 15),
    cmt:    getIdx(['comment', 'หมายเหตุ'], 9),
    dp:     getIdx(['deprotein', 'ล้างโปรตีน'], 10),
    cd:     getIdx(['condition', 'ปรับสภาพ'], 11),
    waste:  getIdx(['waste', 'ของเสีย'], 12)
  };
}

function parseAnyNum_(v) {
  if (v === null || v === undefined || v === '') return null; // Use null for empty
  let n = (typeof v === 'string') ? parseFloat(v.replace(/,/g, '.').replace(/[^0-9.-]/g, '').trim()) : Number(v);
  if (isNaN(n)) return null;
  if (n > 0 && n <= 1) return Math.round(n * 100);
  return n;
}

function toObj_(r, col) {
  return {
    timestamp: r[col.ts] ? (r[col.ts] instanceof Date ? r[col.ts].toISOString() : String(r[col.ts])) : '',
    ward:      String(r[col.ward] || ''), 
    worker:    String(r[col.worker] || ''),
    reagent:   parseAnyNum_(r[col.r_pct]), 
    reagentExpiry: isoDate_(r[col.r_exp]), 
    reagentLot:    String(r[col.r_lot] || ''),
    wash:      parseAnyNum_(r[col.w_pct]), 
    washExpiry:    isoDate_(r[col.w_exp]), 
    washLot:       String(r[col.w_lot] || ''),
    qc:        parseAnyNum_(r[col.q_pct]), 
    qcExpiry:      isoDate_(r[col.q_exp]), 
    qcLot:         String(r[col.q_lot] || ''),
    comment:   String(r[col.cmt] || ''),
    deprotein: String(r[col.dp]) === 'ทำ' || String(r[col.dp]).toUpperCase() === 'TRUE',
    condition: String(r[col.cd]) === 'ทำ' || String(r[col.cd]).toUpperCase() === 'TRUE',
    waste:     String(r[col.waste] || 'ไม่ได้ทิ้ง Waste')
  };
}

// ─── Entry Points ──────────────────────────────────────────────────

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index').setTitle('Blood Gas Tracker').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const data = body.data || {};
    let result;

    if (action === 'login') result = login(body.username, body.password);
    else if (action === 'getLastRecord') result = getLastRecord(body.ward);
    else if (action === 'getLogs') result = getLogs(body.ward);
    else if (action === 'saveRecord') result = saveRecord(data);
    else if (action === 'getWards') result = getWards();
    else result = { success: false, message: 'Invalid Action' };

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── Actions ────────────────────────────────────────────────────────

function login(u, p) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET) || initSheets().ush;
  const rows = sh.getDataRange().getValues();
  const search = String(u || '').trim().toLowerCase();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === search) {
      if (String(rows[i][1]) === String(p)) {
        return { success: true, user: { username: u, fullName: rows[i][2], role: rows[i][3], ward: rows[i][5] || '' } };
      }
    }
  }
  return { success: false, message: 'Invalid credentials' };
}

function getWards() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(WARDS_SHEET) || initSheets().wsh;
  return { success: true, wards: sh.getDataRange().getValues().slice(1).map(r => String(r[0]).trim()).filter(Boolean) };
}

function getLastRecord(wardName) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RECORDS_SHEET) || initSheets().rsh;
  const data = sh.getDataRange().getValues();
  const col = getColMap_(sh);
  const search = String(wardName || '').trim().toLowerCase();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][col.ward]).trim().toLowerCase() === search) {
      return { 
        success: true, 
        record: toObj_(data[i], col),
        _debug_col: col,
        _debug_raw: data[i].slice(0, 16)
      };
    }
  }
  return { success: true, record: null };
}

function getLogs(wardName) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOGS_SHEET) || initSheets().lsh;
  const data = sh.getDataRange().getValues();
  const col = getColMap_(sh);
  const filter = wardName ? String(wardName).trim().toLowerCase() : null;
  const logs = data.slice(1).reverse()
    .filter(r => !filter || String(r[col.ward]).trim().toLowerCase() === filter)
    .slice(0, 20)
    .map(r => toObj_(r, col));
  return { success: true, logs };
}

function saveRecord(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rsh = ss.getSheetByName(RECORDS_SHEET) || initSheets().rsh;
  const lsh = ss.getSheetByName(LOGS_SHEET) || initSheets().lsh;
  const colR = getColMap_(rsh);
  const colL = getColMap_(lsh);

  function prepareRow(col) {
    let row = new Array(Math.max(...Object.values(col)) + 1).fill('');
    if (col.ts >= 0) row[col.ts] = new Date();
    if (col.ward >= 0) row[col.ward] = data.ward || '';
    if (col.worker >= 0) row[col.worker] = data.worker || '';
    if (col.r_pct >= 0) row[col.r_pct] = Number(data.reagent) || 0;
    if (col.r_exp >= 0) row[col.r_exp] = data.reagentExpiry || '';
    if (col.r_lot >= 0) row[col.r_lot] = data.reagentLot || '';
    if (col.w_pct >= 0) row[col.w_pct] = Number(data.wash) || 0;
    if (col.w_exp >= 0) row[col.w_exp] = data.washExpiry || '';
    if (col.w_lot >= 0) row[col.w_lot] = data.washLot || '';
    if (col.q_pct >= 0) row[col.q_pct] = Number(data.qc) || 0;
    if (col.q_exp >= 0) row[col.q_exp] = data.qcExpiry || '';
    if (col.q_lot >= 0) row[col.q_lot] = data.qcLot || '';
    if (col.cmt >= 0) row[col.cmt] = data.comment || '';
    if (col.dp >= 0) row[col.dp] = data.deprotein ? 'ทำ' : 'ไม่ได้ทำ';
    if (col.cd >= 0) row[col.cd] = data.condition ? 'ทำ' : 'ไม่ได้ทำ';
    if (col.waste >= 0) row[col.waste] = data.waste || 'ไม่ได้ทิ้ง Waste';
    return row;
  }

  const wardSearch = String(data.ward || '').trim().toLowerCase();
  const recValues = rsh.getDataRange().getValues();
  let targetRow = -1;
  for (let i = 1; i < recValues.length; i++) {
    if (String(recValues[i][colR.ward]).trim().toLowerCase() === wardSearch) { targetRow = i + 1; break; }
  }

  const rowR = prepareRow(colR);
  if (targetRow > 0) rsh.getRange(targetRow, 1, 1, rowR.length).setValues([rowR]);
  else rsh.appendRow(rowR);

  lsh.appendRow(prepareRow(colL));
  return { success: true, message: 'บันทึกสำเร็จ' };
}

function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const headers = ['Timestamp', 'Ward', 'Worker', 'Reagent (%)', 'Reagent Expiry', 'Wash (%)', 'Wash Expiry', 'QC (%)', 'QC Expiry', 'Comment', 'Deprotein', 'Condition', 'Waste', 'Reagent Lot', 'Wash Lot', 'QC Lot'];
  [RECORDS_SHEET, LOGS_SHEET].forEach(n => {
    let sh = ss.getSheetByName(n) || ss.insertSheet(n);
    if (sh.getLastRow() === 0) sh.appendRow(headers);
  });
  return { rsh: ss.getSheetByName(RECORDS_SHEET), lsh: ss.getSheetByName(LOGS_SHEET), ush: ss.getSheetByName(USERS_SHEET), wsh: ss.getSheetByName(WARDS_SHEET) };
}

function isoDate_(v) {
  if (!v) return '';
  try {
    let d = (v instanceof Date) ? v : new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  } catch (e) { return String(v); }
}
