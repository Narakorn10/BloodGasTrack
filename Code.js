// =====================================================================
//  Blood Gas Reagent Tracker  —  Code.gs  (v5.5 - STABLE)
//  Consolidated & Standardized for Next.js API
// =====================================================================

const RECORDS_SHEET = 'Records';
const LOGS_SHEET    = 'Logs';
const USERS_SHEET   = 'Users';
const WARDS_SHEET   = 'Wards';

const DATA_HEADERS = [
  'Timestamp',       // 0
  'Ward',            // 1
  'Worker',          // 2
  'Reagent (%)',     // 3
  'Reagent Expiry',  // 4
  'Wash (%)',        // 5
  'Wash Expiry',     // 6
  'QC (%)',          // 7
  'QC Expiry',       // 8
  'Comment',         // 9
  'Deprotein',       // 10
  'Condition',       // 11
  'Waste',           // 12
  'Reagent Lot',     // 13
  'Wash Lot',        // 14
  'QC Lot',          // 15
];

const COL = {
  TS: 0, WARD: 1, WORKER: 2, R_PCT: 3, R_EXP: 4, W_PCT: 5, W_EXP: 6, Q_PCT: 7, Q_EXP: 8, CMT: 9, DP: 10, CD: 11, WASTE: 12,
  R_LOT: 13, W_LOT: 14, Q_LOT: 15
};

const USER_HEADERS = ['Username', 'Password', 'FullName', 'Role', 'Active', 'Ward'];

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
    var data = body.data || {}; // Contains all form fields or criteria

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
  const search = String(wardName || '').trim().toLowerCase();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][COL.WARD]).trim().toLowerCase() === search) {
      return JSON.stringify({ success: true, record: toObj_(data[i]) });
    }
  }
  return JSON.stringify({ success: true, record: null });
}

function getLogs(wardName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(LOGS_SHEET) || initSheets().lsh;
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return JSON.stringify({ success: true, logs: [] });

  const data = sheet.getRange(Math.max(2, lastRow - 99), 1, Math.min(lastRow - 1, 100), DATA_HEADERS.length).getValues();
  const filter = wardName ? String(wardName).trim().toLowerCase() : null;
  const logs = data.reverse()
    .filter(r => !filter || String(r[COL.WARD]).trim().toLowerCase() === filter)
    .slice(0, 20)
    .map(toObj_);

  return JSON.stringify({ success: true, logs: logs });
}

function saveRecord(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rsh = ss.getSheetByName(RECORDS_SHEET) || initSheets().rsh;
  const lsh = ss.getSheetByName(LOGS_SHEET) || initSheets().lsh;

  var row = new Array(DATA_HEADERS.length).fill('');
  row[COL.TS]     = new Date();
  row[COL.WARD]   = data.ward || '';
  row[COL.WORKER] = data.worker || '';
  row[COL.R_PCT]  = Number(data.reagent) || 0;
  row[COL.R_EXP]  = data.reagentExpiry || '';
  row[COL.W_PCT]  = Number(data.wash) || 0;
  row[COL.W_EXP]  = data.washExpiry || '';
  row[COL.Q_PCT]  = Number(data.qc) || 0;
  row[COL.Q_EXP]  = data.qcExpiry || '';
  row[COL.CMT]    = data.comment || '';
  row[COL.DP]     = data.deprotein ? 'ทำ' : 'ไม่ได้ทำ';
  row[COL.CD]     = data.condition ? 'ทำ' : 'ไม่ได้ทำ';
  row[COL.WASTE]  = data.waste || 'ไม่ได้ทิ้ง Waste';
  row[COL.R_LOT]  = data.reagentLot || '';
  row[COL.W_LOT]  = data.washLot || '';
  row[COL.Q_LOT]  = data.qcLot || '';

  // Upsert in Records
  const recData = rsh.getDataRange().getValues();
  var targetRow = -1;
  for (var i = 1; i < recData.length; i++) {
    if (String(recData[i][COL.WARD]).trim().toLowerCase() === String(data.ward).trim().toLowerCase()) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow > 0) rsh.getRange(targetRow, 1, 1, row.length).setValues([row]);
  else { rsh.appendRow(row); targetRow = rsh.getLastRow(); }
  fmtRow_(rsh, targetRow);

  // Append in Logs
  lsh.appendRow(row);
  fmtRow_(lsh, lsh.getLastRow());

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

  // Data Sheets
  [RECORDS_SHEET, LOGS_SHEET].forEach(name => {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.getRange(1, 1, 1, DATA_HEADERS.length).setValues([DATA_HEADERS])
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

function toObj_(r) {
  return {
    timestamp: r[COL.TS] ? r[COL.TS].toString() : '',
    ward: r[COL.WARD] || '', worker: r[COL.WORKER] || '',
    reagent: Number(r[COL.R_PCT]) || 0, reagentExpiry: isoDate_(r[COL.R_EXP]), reagentLot: r[COL.R_LOT] || '',
    wash: Number(r[COL.W_PCT]) || 0, washExpiry: isoDate_(r[COL.W_EXP]), washLot: r[COL.W_LOT] || '',
    qc: Number(r[COL.Q_PCT]) || 0, qcExpiry: isoDate_(r[COL.Q_EXP]), qcLot: r[COL.Q_LOT] || '',
    comment: r[COL.CMT] || '',
    deprotein: String(r[COL.DP]) === 'ทำ' || String(r[COL.DP]).toUpperCase() === 'TRUE',
    condition: String(r[COL.CD]) === 'ทำ' || String(r[COL.CD]).toUpperCase() === 'TRUE',
    waste: r[COL.WASTE] || 'ไม่ได้ทิ้ง Waste'
  };
}

function isoDate_(v) {
  if (!v) return '';
  try {
    var d = (v instanceof Date) ? v : new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  } catch (e) { return String(v); }
}

function fmtRow_(sh, rowNum) {
  sh.getRange(rowNum, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  [5, 7, 9].forEach(c => sh.getRange(rowNum, c).setNumberFormat('dd/MM/yyyy'));
}

function logLogin_(u, f) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lsh = ss.getSheetByName(LOGS_SHEET) || initSheets().lsh;
  lsh.appendRow([new Date(), '(Login)', f, '', '', '', '', '', '', 'User logged in: ' + u, '', '', '']);
}
