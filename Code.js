// =====================================================================
// Blood Gas Reagent Tracker - Code.gs
// =====================================================================

const RECORDS_SHEET = 'Records';
const LOGS_SHEET = 'Logs';
const USERS_SHEET = 'Users';
const WARDS_SHEET = 'Wards';

const USER_HEADERS = ['Username', 'Password', 'FullName', 'Role', 'Active', 'Ward'];
const SESSION_PREFIX = 'bgtracker_session_';
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const DEFAULT_WASTE = 'ไม่ได้ทิ้ง Waste';
const DONE_TH = 'ทำ';
const NOT_DONE_TH = 'ไม่ได้ทำ';
const WASTE_YES_TH = 'ทิ้ง Waste';

function getColMap_(sh) {
  const fallback = {
    ts: 0,
    ward: 1,
    worker: 2,
    r_pct: 3,
    r_exp: 4,
    w_pct: 5,
    w_exp: 6,
    q_pct: 7,
    q_exp: 8,
    cmt: 9,
    dp: 10,
    cd: 11,
    waste: 12,
    r_lot: 13,
    w_lot: 14,
    q_lot: 15,
  };
  if (!sh || sh.getLastRow() < 1) return fallback;

  const headers = sh
    .getRange(1, 1, 1, sh.getLastColumn())
    .getValues()[0]
    .map(v => String(v).trim());
  const idx = name => headers.indexOf(name);
  const mapped = {
    ts: idx('Timestamp'),
    ward: idx('Ward'),
    worker: idx('Worker'),
    r_pct: idx('Reagent (%)'),
    r_exp: idx('Reagent Expiry'),
    w_pct: idx('Wash (%)'),
    w_exp: idx('Wash Expiry'),
    q_pct: idx('QC (%)'),
    q_exp: idx('QC Expiry'),
    cmt: idx('Comment'),
    dp: idx('Deprotein'),
    cd: idx('Condition'),
    waste: idx('Waste'),
    r_lot: idx('Reagent Lot'),
    w_lot: idx('Wash Lot'),
    q_lot: idx('QC Lot'),
  };

  return Object.keys(fallback).reduce((acc, key) => {
    acc[key] = mapped[key] >= 0 ? mapped[key] : fallback[key];
    return acc;
  }, {});
}

function createSession_(user) {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(SESSION_PREFIX + token, JSON.stringify(user), SESSION_TTL_SECONDS);
  return token;
}

function getSessionUser_(sessionToken) {
  if (!sessionToken) return null;
  const raw = CacheService.getScriptCache().get(SESSION_PREFIX + sessionToken);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function requireSession_(sessionToken) {
  const user = getSessionUser_(sessionToken);
  if (!user) throw new Error('Unauthorized');
  return user;
}

function getWardDataBatch(wardName, sessionToken) {
  requireSession_(sessionToken);
  const lastRecordResult = getLastRecord_(wardName);
  const logsResult = getLogs_(wardName);
  const wardsResult = getWards_();

  return {
    success: true,
    record: lastRecordResult.record,
    logs: logsResult.logs,
    wards: wardsResult.wards,
  };
}

function migratePasswordsToHash() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET);
  if (!sh) return console.log('Users sheet not found');

  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const plain = String(data[i][1]).trim();
    if (plain && plain.length < 64) {
      const hashed = hashPassword_(plain);
      sh.getRange(i + 1, 2).setValue(hashed);
      console.log('Hashed user:', data[i][0]);
    }
  }
}

function hashPassword_(p) {
  if (!p) return '';
  const signature = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(p));
  return signature.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function parseAnyNum_(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string'
    ? parseFloat(v.replace(/,/g, '.').replace(/[^0-9.-]/g, '').trim())
    : Number(v);
  if (isNaN(n)) return null;
  if (n > 0 && n <= 1) return Math.round(n * 100);
  return n;
}

function toObj_(row, col) {
  if (!row || row.length === 0) return null;
  return {
    timestamp: row[col.ts] ? (row[col.ts] instanceof Date ? row[col.ts].toISOString() : String(row[col.ts])) : '',
    ward: String(row[col.ward] || ''),
    worker: String(row[col.worker] || ''),
    reagent: parseAnyNum_(row[col.r_pct]),
    reagentExpiry: isoDate_(row[col.r_exp]),
    reagentLot: String(row[col.r_lot] || ''),
    wash: parseAnyNum_(row[col.w_pct]),
    washExpiry: isoDate_(row[col.w_exp]),
    washLot: String(row[col.w_lot] || ''),
    qc: parseAnyNum_(row[col.q_pct]),
    qcExpiry: isoDate_(row[col.q_exp]),
    qcLot: String(row[col.q_lot] || ''),
    comment: String(row[col.cmt] || ''),
    deprotein: String(row[col.dp]) === DONE_TH || String(row[col.dp]).toUpperCase() === 'TRUE',
    condition: String(row[col.cd]) === DONE_TH || String(row[col.cd]).toUpperCase() === 'TRUE',
    waste: String(row[col.waste] || DEFAULT_WASTE),
  };
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Blood Gas Tracker')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const data = body.data || {};
    const authActions = ['saveRecord', 'getLogs', 'getLastRecord', 'getWardDataBatch', 'getWards'];

    if (authActions.includes(action)) {
      if (body.sessionToken) {
        requireSession_(body.sessionToken);
      } else {
        const isAuthorized = checkAuth_(body.username, body.password);
        if (!isAuthorized) return sendJson_({ success: false, message: 'Unauthorized' });
      }
    }

    let result;
    if (action === 'login') result = login(body.username, body.password);
    else if (action === 'getWardDataBatch') result = getWardDataBatch(body.ward, body.sessionToken);
    else if (action === 'getLastRecord') result = getLastRecord(body.ward, body.sessionToken);
    else if (action === 'getLogs') result = getLogs(body.ward, body.sessionToken);
    else if (action === 'saveRecord') result = saveRecord(data, body.sessionToken);
    else if (action === 'getWards') result = getWards(body.sessionToken);
    else result = { success: false, message: 'Invalid Action' };

    return sendJson_(result);
  } catch (err) {
    const message = String(err && err.message ? err.message : err);
    return sendJson_({ success: false, message: message === 'Unauthorized' ? 'Unauthorized' : message });
  }
}

function sendJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function checkAuth_(u, p) {
  if (!u || !p) return false;
  const res = login(u, p);
  return res.success;
}

function login(u, p) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET) || initSheets().ush;
  const rows = sh.getDataRange().getValues();
  const searchU = String(u || '').trim().toLowerCase();
  const searchP = hashPassword_(p);

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === searchU) {
      const storedP = String(rows[i][1]);
      if (storedP === searchP || storedP === String(p)) {
        const user = {
          username: u,
          fullName: rows[i][2],
          role: rows[i][3],
          ward: rows[i][5] || '',
        };
        return { success: true, user: user, sessionToken: createSession_(user) };
      }
    }
  }

  return { success: false, message: 'Invalid credentials' };
}

function getWards(sessionToken) {
  requireSession_(sessionToken);
  return getWards_();
}

function getWards_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(WARDS_SHEET) || initSheets().wsh;
  return {
    success: true,
    wards: sh.getDataRange().getValues().slice(1).map(r => String(r[0]).trim()).filter(Boolean),
  };
}

function getLastRecord(wardName, sessionToken) {
  requireSession_(sessionToken);
  return getLastRecord_(wardName);
}

function getLastRecord_(wardName) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RECORDS_SHEET) || initSheets().rsh;
  const col = getColMap_(sh);
  const search = String(wardName || '').trim().toLowerCase();
  const finder = sh.createTextFinder(wardName).matchCase(false).matchEntireCell(true);
  const matches = finder.findAll();

  if (matches.length > 0) {
    for (let i = matches.length - 1; i >= 0; i--) {
      const rowNum = matches[i].getRow();
      const rowData = sh.getRange(rowNum, 1, 1, sh.getLastColumn()).getValues()[0];
      if (String(rowData[col.ward]).trim().toLowerCase() === search) {
        return {
          success: true,
          record: toObj_(rowData, col),
        };
      }
    }
  }

  return { success: true, record: null };
}

function getLogs(wardName, sessionToken) {
  requireSession_(sessionToken);
  return getLogs_(wardName);
}

function getLogs_(wardName) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOGS_SHEET) || initSheets().lsh;
  const col = getColMap_(sh);
  const filter = wardName ? String(wardName).trim().toLowerCase() : null;
  const lastRow = sh.getLastRow();
  const startRow = Math.max(2, lastRow - 50);
  const numRows = lastRow - startRow + 1;

  if (numRows <= 0) return { success: true, logs: [] };

  const data = sh.getRange(startRow, 1, numRows, sh.getLastColumn()).getValues();
  const logs = data
    .reverse()
    .filter(row => !filter || String(row[col.ward]).trim().toLowerCase() === filter)
    .slice(0, 20)
    .map(row => toObj_(row, col));

  return { success: true, logs: logs };
}

function saveRecord(data, sessionToken) {
  const sessionUser = requireSession_(sessionToken);
  return saveRecord_(data, sessionUser);
}

function saveRecord_(data, sessionUser) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rsh = ss.getSheetByName(RECORDS_SHEET) || initSheets().rsh;
  const lsh = ss.getSheetByName(LOGS_SHEET) || initSheets().lsh;
  const colR = getColMap_(rsh);
  const colL = getColMap_(lsh);
  const finder = rsh.createTextFinder(data.ward).matchCase(false).matchEntireCell(true);
  const match = finder.findNext();
  const targetRow = match ? match.getRow() : -1;
  let existingData = {};

  if (targetRow > 1) {
    const rowValues = rsh.getRange(targetRow, 1, 1, rsh.getLastColumn()).getValues()[0];
    existingData = toObj_(rowValues, colR);
  }

  const merged = {
    ...existingData,
    ...data,
    worker: data.worker || sessionUser.fullName || sessionUser.username,
    reagent: parseAnyNum_(data.reagent) ?? existingData.reagent,
    wash: parseAnyNum_(data.wash) ?? existingData.wash,
    qc: parseAnyNum_(data.qc) ?? existingData.qc,
    reagentExpiry: data.reagentExpiry || existingData.reagentExpiry,
    reagentLot: data.reagentLot || existingData.reagentLot,
    washExpiry: data.washExpiry || existingData.washExpiry,
    washLot: data.washLot || existingData.washLot,
    qcExpiry: data.qcExpiry || existingData.qcExpiry,
    qcLot: data.qcLot || existingData.qcLot,
    waste: data.waste || existingData.waste || DEFAULT_WASTE,
  };

  const rowR = prepareRow_(colR, merged);
  if (targetRow > 1) {
    rsh.getRange(targetRow, 1, 1, rowR.length).setValues([rowR]);
  } else {
    rsh.appendRow(rowR);
  }

  lsh.appendRow(prepareRow_(colL, merged));
  buildPackChangeLogs_(merged).forEach(changeLog => {
    lsh.appendRow(prepareRow_(colL, { ...merged, comment: changeLog }));
  });
  return { success: true, message: 'บันทึกสำเร็จ' };
}

function prepareRow_(col, recordData) {
  const row = new Array(Math.max(...Object.values(col)) + 1).fill('');
  if (col.ts >= 0) row[col.ts] = new Date();
  if (col.ward >= 0) row[col.ward] = recordData.ward || '';
  if (col.worker >= 0) row[col.worker] = recordData.worker || '';
  if (col.r_pct >= 0) row[col.r_pct] = recordData.reagent ?? '';
  if (col.r_exp >= 0) row[col.r_exp] = recordData.reagentExpiry || '';
  if (col.r_lot >= 0) row[col.r_lot] = recordData.reagentLot || '';
  if (col.w_pct >= 0) row[col.w_pct] = recordData.wash ?? '';
  if (col.w_exp >= 0) row[col.w_exp] = recordData.washExpiry || '';
  if (col.w_lot >= 0) row[col.w_lot] = recordData.washLot || '';
  if (col.q_pct >= 0) row[col.q_pct] = recordData.qc ?? '';
  if (col.q_exp >= 0) row[col.q_exp] = recordData.qcExpiry || '';
  if (col.q_lot >= 0) row[col.q_lot] = recordData.qcLot || '';
  if (col.cmt >= 0) row[col.cmt] = recordData.comment || '';
  if (col.dp >= 0) row[col.dp] = recordData.deprotein ? DONE_TH : NOT_DONE_TH;
  if (col.cd >= 0) row[col.cd] = recordData.condition ? DONE_TH : NOT_DONE_TH;
  if (col.waste >= 0) row[col.waste] = recordData.waste || DEFAULT_WASTE;
  return row;
}

function buildPackChangeLogs_(recordData) {
  const specs = [
    { label: 'Reagent', changedKey: 'reagentPackChanged', valueKey: 'reagent', expiryKey: 'reagentExpiry', lotKey: 'reagentLot' },
    { label: 'Wash', changedKey: 'washPackChanged', valueKey: 'wash', expiryKey: 'washExpiry', lotKey: 'washLot' },
    { label: 'QC', changedKey: 'qcPackChanged', valueKey: 'qc', expiryKey: 'qcExpiry', lotKey: 'qcLot' },
  ];

  return specs
    .filter(spec => !!recordData[spec.changedKey])
    .map(spec => {
      const parts = ['เปลี่ยน ' + spec.label + ' pack ใหม่'];
      if (recordData[spec.valueKey] !== null && recordData[spec.valueKey] !== undefined && recordData[spec.valueKey] !== '') {
        parts.push('คงเหลือ ' + formatLogValue_(recordData[spec.valueKey], '%'));
      }
      if (recordData[spec.expiryKey]) {
        parts.push('EXP ' + formatLogValue_(recordData[spec.expiryKey]));
      }
      if (recordData[spec.lotKey]) {
        parts.push('Lot ' + formatLogValue_(recordData[spec.lotKey]));
      }
      const userComment = String(recordData.comment || '').trim();
      if (userComment) {
        parts.push('หมายเหตุ: ' + userComment);
      }
      return parts.join(' | ');
    });
}

function formatLogValue_(value, suffix) {
  if (value === null || value === undefined || value === '') return '-';
  return String(value).trim() + (suffix || '');
}

function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const headers = [
    'Timestamp',
    'Ward',
    'Worker',
    'Reagent (%)',
    'Reagent Expiry',
    'Wash (%)',
    'Wash Expiry',
    'QC (%)',
    'QC Expiry',
    'Comment',
    'Deprotein',
    'Condition',
    'Waste',
    'Reagent Lot',
    'Wash Lot',
    'QC Lot',
  ];

  [RECORDS_SHEET, LOGS_SHEET].forEach(name => {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) sh.appendRow(headers);
  });

  const ush = ss.getSheetByName(USERS_SHEET) || ss.insertSheet(USERS_SHEET);
  if (ush.getLastRow() === 0) ush.appendRow(USER_HEADERS);

  const wsh = ss.getSheetByName(WARDS_SHEET) || ss.insertSheet(WARDS_SHEET);
  if (wsh.getLastRow() === 0) wsh.appendRow(['Ward']);

  return {
    rsh: ss.getSheetByName(RECORDS_SHEET),
    lsh: ss.getSheetByName(LOGS_SHEET),
    ush: ush,
    wsh: wsh,
  };
}

function isoDate_(v) {
  if (!v) return '';
  try {
    const d = v instanceof Date ? v : new Date(v);
    if (isNaN(d.getTime())) {
      const s = String(v);
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.split('T')[0];
      return s;
    }
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
  } catch (err) {
    return String(v);
  }
}
