// =====================================================================
//  Blood Gas Reagent Tracker  —  Code.gs  (v4.1)
//  Refactored: Security & Performance fixes
// =====================================================================

const RECORDS_SHEET = 'Records';
const LOGS_SHEET    = 'Logs';
const USERS_SHEET   = 'Users';

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

// [M2] Better Mapping using Column Indices
const COL = {
  TS: 0, WARD: 1, WORKER: 2, R_PCT: 3, R_EXP: 4, W_PCT: 5, W_EXP: 6, Q_PCT: 7, Q_EXP: 8, CMT: 9, DP: 10, CD: 11, WASTE: 12,
  R_LOT: 13, W_LOT: 14, Q_LOT: 15
};

const USER_HEADERS = ['Username', 'Password', 'FullName', 'Role', 'Active', 'Ward'];

// ─── Serve HTML ──────────────────────────────────────────────────────
function doGet(e) {
  return HtmlService
    .createHtmlOutputFromFile('index')
    .setTitle('Blood Gas Tracker')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT) // 🛡️ [C1] Refactored: Security fix against Clickjacking
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * [API] doPost(e) — Entry point for Next.js (REST API)
 */
function doPost(e) {
  var response;
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;

    if (action === 'login') {
      response = login(body.username, body.password);
    } else if (action === 'getLastRecord') {
      response = getLastRecord(body.ward);
    } else if (action === 'getLogs') {
      response = getLogs();
    } else if (action === 'saveRecord') {
      response = saveRecord(body.data);
    } else if (action === 'getWards') {
      response = getWards();
    } else {
      response = JSON.stringify({ success: false, message: 'Invalid Action' });
    }
  } catch (err) {
    response = JSON.stringify({ success: false, message: 'Server Error: ' + err.toString() });
  }

  // Handle CORS & JSON Response
  return ContentService.createTextOutput(response)
    .setMimeType(ContentService.MimeType.JSON);
}

// =====================================================================
//  AUTH
// =====================================================================

function login(username, password) {
  if (!username || !password) {
    return JSON.stringify({ success: false, message: 'กรุณากรอก Username และ Password' });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(USERS_SHEET)) initSheets();
  
  var sh   = ss.getSheetByName(USERS_SHEET);
  var rows = sh.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    var uname    = rows[i][0];
    var pwd      = rows[i][1];
    var fullName = rows[i][2];
    var role     = rows[i][3];
    var active   = rows[i][4];
    var ward     = rows[i][5];

    if (String(uname).trim().toLowerCase() === String(username).trim().toLowerCase()) {
      if (String(active).toUpperCase() !== 'TRUE') {
        return JSON.stringify({ success: false, message: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อ Admin' });
      }
      if (String(pwd) === String(password)) {
        logLogin_(String(uname).trim(), String(fullName || uname));
        return JSON.stringify({
          success: true,
          user: {
            username: String(uname).trim(),
            fullName: String(fullName || uname),
            role:     String(role || 'user'),
            ward:     String(ward || '')
          }
        });
      } else {
        return JSON.stringify({ success: false, message: 'Password ไม่ถูกต้อง' });
      }
    }
  }
  return JSON.stringify({ success: false, message: 'ไม่พบ Username นี้ในระบบ' });
}

function getWards() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(RECORDS_SHEET);
  if (!sheet) return JSON.stringify({ success: true, wards: [] });
  
  var data = sheet.getDataRange().getValues();
  var wards = [];
  for (var i = 1; i < data.length; i++) {
    var w = data[i][COL.WARD];
    if (w && wards.indexOf(w) === -1) wards.push(w);
  }
  return JSON.stringify({ success: true, wards: wards });
}

function logLogin_(username, fullName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(LOGS_SHEET)) initSheets();
  var logs = ss.getSheetByName(LOGS_SHEET);
  logs.appendRow([
    new Date(), '(Login)', fullName,
    '', '', '', '', '', '', 'User "' + username + '" logged in', '', '', ''
  ]);
}

// =====================================================================
//  DATA
// =====================================================================

function getLastRecord(ward) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(RECORDS_SHEET);
  if (!sheet) return JSON.stringify({ success: true, record: null });

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][COL.WARD] === ward) {
      return JSON.stringify({ success: true, record: toObj_(data[i]) });
    }
  }
  return JSON.stringify({ success: true, record: null });
}

function getLogs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(LOGS_SHEET);
  if (!sheet) return JSON.stringify({ success: true, logs: [] });

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return JSON.stringify({ success: true, logs: [] });

  // Fetch only the last 20 rows (or fewer if sheet is small)
  var numRows = Math.min(20, lastRow - 1);
  var startRow = lastRow - numRows + 1;
  
  var data = sheet.getRange(startRow, 1, numRows, DATA_HEADERS.length).getValues();
  var logs = [];
  
  // Return in reverse order (newest first)
  for (var i = data.length - 1; i >= 0; i--) {
    logs.push(toObj_(data[i]));
  }
  return JSON.stringify({ success: true, logs: logs });
}

function saveRecord(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(RECORDS_SHEET) || !ss.getSheetByName(LOGS_SHEET)) initSheets();
  
  var rec  = ss.getSheetByName(RECORDS_SHEET);
  var logs = ss.getSheetByName(LOGS_SHEET);

  var row = new Array(DATA_HEADERS.length).fill('');
  row[COL.TS]     = new Date();
  row[COL.WARD]   = data.ward || '';
  row[COL.WORKER] = data.worker || '';
  row[COL.R_PCT]  = parseFloat(data.reagent) || 0;
  row[COL.R_EXP]  = data.reagentExpiry || '';
  row[COL.W_PCT]  = parseFloat(data.wash) || 0;
  row[COL.W_EXP]  = data.washExpiry || '';
  row[COL.Q_PCT]  = parseFloat(data.qc) || 0;
  row[COL.Q_EXP]  = data.qcExpiry || '';
  row[COL.CMT]    = data.comment || '';
  row[COL.DP]     = data.deprotein ? 'ทำ' : 'ไม่ได้ทำ';
  row[COL.CD]     = data.condition ? 'ทำ' : 'ไม่ได้ทำ';
  row[COL.WASTE]  = data.waste || 'ไม่ได้ทิ้ง Waste';
  row[COL.R_LOT]  = data.reagentLot || '';
  row[COL.W_LOT]  = data.washLot || '';
  row[COL.Q_LOT]  = data.qcLot || '';

  // upsert ใน Records
  var recData = rec.getDataRange().getValues();
  var ri = -1;
  for (var i = 1; i < recData.length; i++) {
    if (recData[i][COL.WARD] === data.ward) {
      ri = i + 1;
      break;
    }
  }
  if (ri > 0) {
    rec.getRange(ri, 1, 1, row.length).setValues([row]);
  } else {
    rec.appendRow(row);
    ri = rec.getLastRow();
  }
  fmtRow_(rec, ri);

  // append ใน Logs
  logs.appendRow(row);
  fmtRow_(logs, logs.getLastRow());

  return JSON.stringify({ success: true, message: 'บันทึกสำเร็จ' });
}

// =====================================================================
//  INIT SHEETS
// =====================================================================

function initSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  const HEADER_COLOR = '#0a4d68';
  const USER_HEADER_COLOR = '#1e3a5f';

  // Records + Logs
  var dataSheets = [RECORDS_SHEET, LOGS_SHEET];
  for (var d = 0; d < dataSheets.length; d++) {
    var name = dataSheets[d];
    var sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    
    if (!sh.getRange('A1').getValue()) {
      sh.getRange(1, 1, 1, DATA_HEADERS.length)
        .setValues([DATA_HEADERS])
        .setFontWeight('bold')
        .setBackground(HEADER_COLOR)
        .setFontColor('#ffffff');
      sh.setFrozenRows(1);
      sh.setColumnWidth(1, 165);
      sh.setColumnWidth(10, 260);
    }
  }

  // Users
  var ush = ss.getSheetByName(USERS_SHEET);
  if (!ush) {
    ush = ss.insertSheet(USERS_SHEET);
    ush.getRange(1, 1, 1, USER_HEADERS.length)
      .setValues([USER_HEADERS])
      .setFontWeight('bold')
      .setBackground(USER_HEADER_COLOR)
      .setFontColor('#ffffff');
    ush.setFrozenRows(1);
    ush.appendRow(['admin',   'admin1234', 'ผู้ดูแลระบบ',   'admin', 'TRUE']);
    ush.appendRow(['nurse01', 'nurse1234', 'พยาบาล หอ 2',  'user',  'TRUE']);
    ush.appendRow(['nurse02', 'nurse5678', 'พยาบาล NICU',  'user',  'TRUE']);
    ush.setColumnWidths(1, USER_HEADERS.length, 150);
  }
}

// =====================================================================
//  HELPERS
// =====================================================================

function toObj_(r) {
  return {
    timestamp:     r[COL.TS] ? r[COL.TS].toString() : '',
    ward:          r[COL.WARD]   || '',
    worker:        r[COL.WORKER] || '',
    reagent:       Number(r[COL.R_PCT]) || 0,
    reagentExpiry: isoDate_(r[COL.R_EXP]),
    wash:          Number(r[COL.W_PCT]) || 0,
    washExpiry:    isoDate_(r[COL.W_EXP]),
    qc:            Number(r[COL.Q_PCT]) || 0,
    qcExpiry:      isoDate_(r[COL.Q_EXP]),
    comment:       r[COL.CMT]    || '',
    deprotein:     String(r[COL.DP]) === 'ทำ' || String(r[COL.DP]).toUpperCase() === 'TRUE',
    condition:     String(r[COL.CD]) === 'ทำ' || String(r[COL.CD]).toUpperCase() === 'TRUE',
    waste:         r[COL.WASTE]  || 'ไม่ได้ทิ้ง Waste',
    reagentLot:    r[COL.R_LOT]  || '',
    washLot:       r[COL.W_LOT]  || '',
    qcLot:         r[COL.Q_LOT]  || ''
  };
}

function isoDate_(v) {
  if (!v) return '';
  try {
    var d = (v instanceof Date) ? v : new Date(v);
    if (isNaN(d.getTime())) return String(v);
    var y  = d.getFullYear();
    var m  = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
  } catch (e) {
    return v ? String(v) : '';
  }
}

function fmtRow_(sh, rowNum) {
  sh.getRange(rowNum, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  sh.getRange(rowNum, 5).setNumberFormat('dd/MM/yyyy');
  sh.getRange(rowNum, 7).setNumberFormat('dd/MM/yyyy');
  sh.getRange(rowNum, 9).setNumberFormat('dd/MM/yyyy');
}
