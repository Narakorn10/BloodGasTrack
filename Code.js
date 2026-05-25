// =====================================================================
//  Blood Gas Reagent Tracker  —  Code.gs  (v5.6 - ULTRA ROBUST)
//  Fix: Reagent/Wash/QC % displaying as 0% despite Lot/Exp working
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
    
    // 1. Exact match (lowercase)
    map[raw.toLowerCase()] = i;
    
    // 2. Alphanumeric only (remove %, spaces, symbols)
    const clean = raw.replace(/[^a-zA-Z0-9ก-๙]/g, '').toLowerCase();
    if (clean && map[clean] === undefined) map[clean] = i;
  });
  
  // Strategy: Try multiple possible header names for each field
  const getIdx = (candidates, defaultIdx) => {
    for (const c of candidates) {
      const cleanC = c.replace(/[^a-zA-Z0-9ก-๙]/g, '').toLowerCase();
      // Try exact, then try clean
      if (map[c.toLowerCase()] !== undefined) return map[c.toLowerCase()];
      if (map[cleanC] !== undefined) return map[cleanC];
    }
    return defaultIdx;
  };

  return {
    ts:     getIdx(['timestamp', 'เวลา', 'วันเวลา'], 0),
    ward:   getIdx(['ward', 'วอร์ด', 'หน่วยงาน', 'ตึก'], 1),
    worker: getIdx(['worker', 'ผู้บันทึก', 'ชื่อ', 'staff'], 2),
    
    // Reagent
    r_pct:  getIdx(['reagent%', 'reagentpct', 'reagent', 'น้ำยา', 'น้ำยา%'], 3),
    r_exp:  getIdx(['reagentexpiry', 'reagentexp', 'วันหมดอายุน้ำยา'], 4),
    r_lot:  getIdx(['reagentlot', 'lotreagent', 'ล็อตน้ำยา'], 13),
    
    // Wash
    w_pct:  getIdx(['wash%', 'washpct', 'wash', 'น้ำยาล้าง', 'น้ำยาล้าง%'], 5),
    w_exp:  getIdx(['washexpiry', 'washexp', 'วันหมดอายุน้ำยาล้าง'], 6),
    w_lot:  getIdx(['washlot', 'lotwash', 'ล็อตน้ำยาล้าง'], 14),
    
    // QC
    q_pct:  getIdx(['qc%', 'qcpct', 'qc', 'คิวซี', 'คิวซี%'], 7),
    q_exp:  getIdx(['qcexpiry', 'qcexp', 'วันหมดอายุคิวซี'], 8),
    q_lot:  getIdx(['qclot', 'lotqc', 'ล็อตคิวซี'], 15),
    
    cmt:    getIdx(['comment', 'หมายเหตุ', 'บันทึก'], 9),
    dp:     getIdx(['deprotein', 'ล้างโปรตีน'], 10),
    cd:     getIdx(['condition', 'ปรับสภาพ'], 11),
    waste:  getIdx(['waste', 'ของเสีย'], 12)
  };
}

// ─── Utility: Safe Data Parsing ─────────────────────────────────────

function parseAnyNum_(v) {
  if (v === null || v === undefined || v === '') return 0;
  
  let n;
  if (typeof v === 'string') {
    // Handle localized numbers (comma to dot) and remove symbols
    const clean = v.replace(/,/g, '.').replace(/[^0-9.-]/g, '').trim();
    n = parseFloat(clean);
  } else {
    n = Number(v);
  }
  
  if (isNaN(n)) return 0;
  
  // Google Sheets quirk: if a cell is formatted as %, 75% is stored as 0.75
  // We want to return 75 for the UI.
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

// ─── Main Actions ───────────────────────────────────────────────────

function getLastRecord(wardName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(RECORDS_SHEET) || initSheets().rsh;
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return JSON.stringify({ success: true, record: null });

  const col = getColMap_(sheet);
  const search = String(wardName || '').trim().toLowerCase();

  // Bottom-up search for efficiency
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][col.ward]).trim().toLowerCase() === search) {
      return JSON.stringify({ success: true, record: toObj_(data[i], col) });
    }
  }
  return JSON.stringify({ success: true, record: null });
}

function saveRecord(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rsh = ss.getSheetByName(RECORDS_SHEET) || initSheets().rsh;
  const lsh = ss.getSheetByName(LOGS_SHEET) || initSheets().lsh;
  
  const colR = getColMap_(rsh);
  const colL = getColMap_(lsh);

  function prepareRow(col) {
    var maxIdx = 0;
    Object.values(col).forEach(v => { if (v > maxIdx) maxIdx = v; });
    var row = new Array(maxIdx + 1).fill('');
    
    if (col.ts >= 0)     row[col.ts]     = new Date();
    if (col.ward >= 0)   row[col.ward]   = data.ward || '';
    if (col.worker >= 0) row[col.worker] = data.worker || '';
    
    // Percentages: Ensure numeric storage
    if (col.r_pct >= 0)  row[col.r_pct]  = Number(data.reagent) || 0;
    if (col.r_exp >= 0)  row[col.r_exp]  = data.reagentExpiry || '';
    if (col.r_lot >= 0)  row[col.r_lot]  = data.reagentLot || '';
    
    if (col.w_pct >= 0)  row[col.w_pct]  = Number(data.wash) || 0;
    if (col.w_exp >= 0)  row[col.w_exp]  = data.washExpiry || '';
    if (col.w_lot >= 0)  row[col.w_lot]  = data.washLot || '';
    
    if (col.q_pct >= 0)  row[col.q_pct]  = Number(data.qc) || 0;
    if (col.q_exp >= 0)  row[col.q_exp]  = data.qcExpiry || '';
    if (col.q_lot >= 0)  row[col.q_lot]  = data.qcLot || '';
    
    if (col.cmt >= 0)    row[col.cmt]    = data.comment || '';
    if (col.dp >= 0)     row[col.dp]     = data.deprotein ? 'ทำ' : 'ไม่ได้ทำ';
    if (col.cd >= 0)     row[col.cd]     = data.condition ? 'ทำ' : 'ไม่ได้ทำ';
    if (col.waste >= 0)  row[col.waste]  = data.waste || 'ไม่ได้ทิ้ง Waste';
    
    return row;
  }

  const wardSearch = String(data.ward || '').trim().toLowerCase();
  
  // Update Records (Upsert)
  const recValues = rsh.getDataRange().getValues();
  let targetRow = -1;
  for (let i = 1; i < recValues.length; i++) {
    if (String(recValues[i][colR.ward]).trim().toLowerCase() === wardSearch) {
      targetRow = i + 1;
      break;
    }
  }

  const rowR = prepareRow(colR);
  if (targetRow > 0) {
    rsh.getRange(targetRow, 1, 1, rowR.length).setValues([rowR]);
  } else {
    rsh.appendRow(rowR);
    targetRow = rsh.getLastRow();
  }
  fmtRow_(rsh, targetRow, colR);

  // Append Logs
  const rowL = prepareRow(colL);
  lsh.appendRow(rowL);
  fmtRow_(lsh, lsh.getLastRow(), colL);

  return JSON.stringify({ success: true, message: 'บันทึกสำเร็จ' });
}

// ─── Boilerplate ────────────────────────────────────────────────────

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Blood Gas Tracker')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const data = body.data || {};
    let res;

    if (action === 'login') res = login(body.username, body.password);
    else if (action === 'getLastRecord') res = getLastRecord(body.ward);
    else if (action === 'getLogs') res = getLogs(body.ward);
    else if (action === 'saveRecord') res = saveRecord(data);
    else if (action === 'getWards') res = getWards();
    else res = JSON.stringify({ success: false, message: 'Invalid Action' });

    return ContentService.createTextOutput(res).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function login(u, p) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET) || initSheets().ush;
  const rows = sh.getDataRange().getValues();
  const search = String(u || '').trim().toLowerCase();
  
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === search) {
      if (String(rows[i][4]).toUpperCase() !== 'TRUE') return JSON.stringify({ success: false, message: 'Disabled' });
      if (String(rows[i][1]) === String(p)) {
        logLogin_(search, String(rows[i][2]));
        return JSON.stringify({ success: true, user: { username: u, fullName: rows[i][2], role: rows[i][3], ward: rows[i][5] || '' } });
      }
    }
  }
  return JSON.stringify({ success: false, message: 'Invalid credentials' });
}

function getWards() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(WARDS_SHEET) || initSheets().wsh;
  const wards = sh.getDataRange().getValues().slice(1).map(r => String(r[0]).trim()).filter(Boolean);
  return JSON.stringify({ success: true, wards });
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
  return JSON.stringify({ success: true, logs });
}

function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const headers = ['Timestamp', 'Ward', 'Worker', 'Reagent (%)', 'Reagent Expiry', 'Wash (%)', 'Wash Expiry', 'QC (%)', 'QC Expiry', 'Comment', 'Deprotein', 'Condition', 'Waste', 'Reagent Lot', 'Wash Lot', 'QC Lot'];
  
  [RECORDS_SHEET, LOGS_SHEET].forEach(n => {
    let sh = ss.getSheetByName(n) || ss.insertSheet(n);
    if (sh.getLastRow() === 0) sh.appendRow(headers);
  });
  
  let ush = ss.getSheetByName(USERS_SHEET) || ss.insertSheet(USERS_SHEET);
  if (ush.getLastRow() === 0) ush.appendRow(USER_HEADERS);
  
  let wsh = ss.getSheetByName(WARDS_SHEET) || ss.insertSheet(WARDS_SHEET);
  if (wsh.getLastRow() === 0) wsh.appendRow(['Ward Name']);
  
  return { rsh: ss.getSheetByName(RECORDS_SHEET), lsh: ss.getSheetByName(LOGS_SHEET), ush, wsh };
}

function isoDate_(v) {
  if (!v) return '';
  try {
    let d = (v instanceof Date) ? v : new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  } catch (e) { return String(v); }
}

function fmtRow_(sh, r, col) {
  if (col.ts >= 0) sh.getRange(r, col.ts + 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  [col.r_exp, col.w_exp, col.q_exp].forEach(c => { if (c >= 0) sh.getRange(r, c + 1).setNumberFormat('dd/MM/yyyy'); });
}

function logLogin_(u, f) {
  const lsh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOGS_SHEET) || initSheets().lsh;
  const col = getColMap_(lsh);
  const row = new Array(Math.max(...Object.values(col)) + 1).fill('');
  if (col.ts >= 0) row[col.ts] = new Date();
  if (col.ward >= 0) row[col.ward] = '(Login)';
  if (col.worker >= 0) row[col.worker] = f;
  if (col.cmt >= 0) row[col.cmt] = 'Login: ' + u;
  lsh.appendRow(row);
}
