// =====================================================================
//  Blood Gas Reagent Tracker  —  Code.gs  (v5.5 - STABLE)
//  Consolidated & Standardized for Next.js API
// =====================================================================

const RECORDS_SHEET = 'Records';
const LOGS_SHEET    = 'Logs';
const USERS_SHEET   = 'Users';
const WARDS_SHEET   = 'Wards';

const USER_HEADERS = ['Username', 'Password', 'FullName', 'Role', 'Active', 'Ward'];

// ─── Utility: Dynamic Column Mapping ───────────────────────────────

function getColMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
  const map = {};
  headers.forEach((h, i) => {
    const key = String(h).replace(/[^a-zA-Z0-9]/g, '').toLowerCase(); 
    map[key] = i;
  });
  
  const getIdx = (k, def) => (map[k] !== undefined) ? map[k] : def;

  return {
    ts: getIdx('timestamp', 0),
    ward: getIdx('ward', 1),
    worker: getIdx('worker', 2),
    r_pct: getIdx('reagent', 3),
    r_exp: getIdx('reagentexpiry', 4),
    r_lot: getIdx('reagentlot', 13),
    w_pct: getIdx('wash', 5),
    w_exp: getIdx('washexpiry', 6),
    w_lot: getIdx('washlot', 14),
    q_pct: getIdx('qc', 7),
    q_exp: getIdx('qcexpiry', 8),
    q_lot: getIdx('qclot', 15),
    cmt: getIdx('comment', 9),
    dp: getIdx('deprotein', 10),
    cd: getIdx('condition', 11),
    waste: getIdx('waste', 12)
  };
}

function toObj_(r, col) {
  const parsePct = (v) => {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'string') v = v.replace(/%/g, '').trim();
    let n = Number(v);
    if (isNaN(n)) return 0;
    // If value is a small decimal (like 0.75 from a % formatted cell), convert to 0-100
    if (n > 0 && n < 1.1) return Math.round(n * 100);
    return n;
  };

  return {
    timestamp: r[col.ts] ? (r[col.ts] instanceof Date ? r[col.ts].toISOString() : r[col.ts].toString()) : '',
    ward: r[col.ward] || '', 
    worker: r[col.worker] || '',
    reagent: parsePct(r[col.r_pct]), 
    reagentExpiry: isoDate_(r[col.r_exp]), 
    reagentLot: r[col.r_lot] || '',
    wash: parsePct(r[col.w_pct]), 
    washExpiry: isoDate_(r[col.w_exp]), 
    washLot: r[col.w_lot] || '',
    qc: parsePct(r[col.q_pct]), 
    qcExpiry: isoDate_(r[col.q_exp]), 
    qcLot: r[col.q_lot] || '',
    comment: r[col.cmt] || '',
    deprotein: String(r[col.dp]) === 'ทำ' || String(r[col.dp]).toUpperCase() === 'TRUE',
    condition: String(r[col.cd]) === 'ทำ' || String(r[col.cd]).toUpperCase() === 'TRUE',
    waste: r[col.waste] || 'ไม่ได้ทิ้ง Waste'
  };
}

// ─── Entry Points ──────────────────────────────────────────────────

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Blood Gas Tracker')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function doPost(e) {
  var response;
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    var data = body.data || {};

    if (action === 'login') {
      response = login(body.username, body.password);
    } else if (action === 'getLastRecord') {
      response = getLastRecord(body.ward);
    } else if (action === 'getLogs') {
      response = getLogs(body.ward);
    } else if (action === 'saveRecord') {
      response = saveRecord(data);
    } else if (action === 'getWards') {
      response = getWards();
    } else {
      response = JSON.stringify({ success: false, message: 'Invalid Action: ' + action });
    }
  } catch (err) {
    response = JSON.stringify({ success: false, message: 'Server Error: ' + err.toString() });
  }
  return ContentService.createTextOutput(response).setMimeType(ContentService.MimeType.JSON);
}

// ─── Actions ────────────────────────────────────────────────────────

function login(username, password) {
  if (!username || !password) return JSON.stringify({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(USERS_SHEET) || initSheets().ush;
  const rows = sh.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    var [uname, pwd, fullName, role, active, ward] = rows[i];
    if (String(uname).trim().toLowerCase() === String(username).trim().toLowerCase()) {
      if (String(active).toUpperCase() !== 'TRUE') return JSON.stringify({ success: false, message: 'บัญชีถูกระงับ' });
      if (String(pwd) === String(password)) {
        logLogin_(String(uname).trim(), String(fullName || uname));
        return JSON.stringify({
          success: true,
          user: { username: uname, fullName: fullName, role: role, ward: ward || '' }
        });
      } else {
        return JSON.stringify({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });
      }
    }
  }
  return JSON.stringify({ success: false, message: 'ไม่พบชื่อผู้ใช้งานนี้' });
}

function getWards() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(WARDS_SHEET) || initSheets().wsh;
  const data = sheet.getDataRange().getValues();
  const wards = data.slice(1).map(r => String(r[0]).trim()).filter(Boolean);
  return JSON.stringify({ success: true, wards: wards.length > 0 ? wards : ["อายุกรรมชาย 2", "NICU"] });
}

function getLastRecord(wardName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(RECORDS_SHEET) || initSheets().rsh;
  const data = sheet.getDataRange().getValues();
  const col = getColMap_(sheet);
  const search = String(wardName || '').trim().toLowerCase();

  // Search from bottom for the most recent record
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][col.ward]).trim().toLowerCase() === search) {
      return JSON.stringify({ success: true, record: toObj_(data[i], col) });
    }
  }
  return JSON.stringify({ success: true, record: null });
}

function getLogs(wardName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(LOGS_SHEET) || initSheets().lsh;
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return JSON.stringify({ success: true, logs: [] });

  const data = sheet.getRange(Math.max(2, lastRow - 99), 1, Math.min(lastRow - 1, 100), sheet.getLastColumn()).getValues();
  const col = getColMap_(sheet);
  const filter = wardName ? String(wardName).trim().toLowerCase() : null;
  const logs = data.reverse()
    .filter(r => !filter || String(r[col.ward]).trim().toLowerCase() === filter)
    .slice(0, 20)
    .map(r => toObj_(r, col));

  return JSON.stringify({ success: true, logs: logs });
}

function saveRecord(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rsh = ss.getSheetByName(RECORDS_SHEET) || initSheets().rsh;
  const lsh = ss.getSheetByName(LOGS_SHEET) || initSheets().lsh;
  
  const colR = getColMap_(rsh);
  const colL = getColMap_(lsh);

  function createRow(col) {
    var row = new Array(Math.max(...Object.values(col)) + 1).fill('');
    row[col.ts]     = new Date();
    row[col.ward]   = data.ward || '';
    row[col.worker] = data.worker || '';
    row[col.r_pct]  = Number(data.reagent) || 0;
    row[col.r_exp]  = data.reagentExpiry || '';
    row[col.w_pct]  = Number(data.wash) || 0;
    row[col.w_exp]  = data.washExpiry || '';
    row[col.q_pct]  = Number(data.qc) || 0;
    row[col.q_exp]  = data.qcExpiry || '';
    row[col.cmt]    = data.comment || '';
    row[col.dp]     = data.deprotein ? 'ทำ' : 'ไม่ได้ทำ';
    row[col.cd]     = data.condition ? 'ทำ' : 'ไม่ได้ทำ';
    row[col.waste]  = data.waste || 'ไม่ได้ทิ้ง Waste';
    row[col.r_lot]  = data.reagentLot || '';
    row[col.w_lot]  = data.washLot || '';
    row[col.q_lot]  = data.qcLot || '';
    return row;
  }

  // Update Records (Upsert)
  const recData = rsh.getDataRange().getValues();
  var targetRow = -1;
  for (var i = 1; i < recData.length; i++) {
    if (String(recData[i][colR.ward]).trim().toLowerCase() === String(data.ward).trim().toLowerCase()) {
      targetRow = i + 1;
      break;
    }
  }

  const rowR = createRow(colR);
  if (targetRow > 0) rsh.getRange(targetRow, 1, 1, rowR.length).setValues([rowR]);
  else { rsh.appendRow(rowR); targetRow = rsh.getLastRow(); }
  fmtRow_(rsh, targetRow, colR);

  // Append to Logs
  const rowL = createRow(colL);
  lsh.appendRow(rowL);
  fmtRow_(lsh, lsh.getLastRow(), colL);

  return JSON.stringify({ success: true, message: 'บันทึกข้อมูลเรียบร้อย' });
}

// ─── System ─────────────────────────────────────────────────────────

function setupSystem() {
  initSheets();
  SpreadsheetApp.getUi().alert('🚀 ระบบ Blood Gas Tracker พร้อมใช้งานแล้ว!');
}

function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const colors = { header: '#0a4d68', user: '#1e3a5f', ward: '#088395' };

  const headers = [
    'Timestamp', 'Ward', 'Worker', 'Reagent (%)', 'Reagent Expiry', 'Wash (%)', 'Wash Expiry', 
    'QC (%)', 'QC Expiry', 'Comment', 'Deprotein', 'Condition', 'Waste', 
    'Reagent Lot', 'Wash Lot', 'QC Lot'
  ];

  // Data Sheets
  [RECORDS_SHEET, LOGS_SHEET].forEach(name => {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground(colors.header).setFontColor('#ffffff').setHorizontalAlignment('center');
    sh.setFrozenRows(1);
  });

  // Wards Sheet
  var wsh = ss.getSheetByName(WARDS_SHEET) || ss.insertSheet(WARDS_SHEET);
  if (wsh.getLastRow() === 0) {
    wsh.getRange(1, 1).setValue('Ward Name').setFontWeight('bold').setBackground(colors.ward).setFontColor('#ffffff');
    wsh.appendRow(['อายุกรรมชาย 2']); wsh.appendRow(['NICU']); wsh.appendRow(['ICU(MED)']);
  }

  // Users Sheet
  var ush = ss.getSheetByName(USERS_SHEET) || ss.insertSheet(USERS_SHEET);
  if (ush.getLastRow() === 0) {
    ush.getRange(1, 1, 1, USER_HEADERS.length).setValues([USER_HEADERS])
      .setFontWeight('bold').setBackground(colors.user).setFontColor('#ffffff');
    ush.appendRow(['admin', 'admin1234', 'ผู้ดูแลระบบ', 'admin', 'TRUE', '']);
  }

  return { rsh: ss.getSheetByName(RECORDS_SHEET), lsh: ss.getSheetByName(LOGS_SHEET), ush: ush, wsh: wsh };
}

function isoDate_(v) {
  if (!v) return '';
  try {
    var d = (v instanceof Date) ? v : new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  } catch (e) { return String(v); }
}

function fmtRow_(sh, rowNum, col) {
  if (col.ts >= 0) sh.getRange(rowNum, col.ts + 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  [col.r_exp, col.w_exp, col.q_exp].forEach(c => {
    if (c >= 0) sh.getRange(rowNum, c + 1).setNumberFormat('dd/MM/yyyy');
  });
}

function logLogin_(u, f) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lsh = ss.getSheetByName(LOGS_SHEET) || initSheets().lsh;
  const col = getColMap_(lsh);
  var row = new Array(Math.max(...Object.values(col)) + 1).fill('');
  row[col.ts] = new Date();
  row[col.ward] = '(Login)';
  row[col.worker] = f;
  row[col.cmt] = 'User logged in: ' + u;
  lsh.appendRow(row);
}
