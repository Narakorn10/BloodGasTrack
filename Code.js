// =====================================================================
// Blood Gas Reagent Tracker - Code.gs
// =====================================================================

const RECORDS_SHEET = 'Records';
const LOGS_SHEET = 'Logs';
const USERS_SHEET = 'Users';
const WARDS_SHEET = 'Wards';

const USER_HEADERS = ['Username', 'Password', 'FullName', 'Role', 'Active', 'Ward', 'Company'];
const SESSION_PREFIX = 'bgtracker_session_';
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const DEFAULT_WASTE = 'ไม่ได้ทิ้ง Waste';
const DONE_TH = 'ทำ';
const NOT_DONE_TH = 'ไม่ได้ทำ';
const WASTE_YES_TH = 'ทิ้ง Waste';
const AUDIT_SCHEMA_VERSION = 2;
const BASE_HEADERS = [
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
const PACK_DATE_HEADERS = [
  'Reagent Changed At',
  'Wash Changed At',
  'QC Changed At',
];
const SERVICE_HEADERS = [
  'Service Visit',
  'Service Company',
  'Service Technician',
  'Service Work',
  'Service PM Performed',
  'Service Reagent Changed',
  'Service Wash Changed',
  'Service QC Changed',
];
const LOG_AUDIT_HEADERS = [
  'Log ID',
  'Actor Username',
  'Actor Name',
  'Event Types',
  'Changes JSON',
  'Schema Version',
];

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
    r_changed: -1,
    w_changed: -1,
    q_changed: -1,
    service_visit: -1,
    service_company: -1,
    service_technician: -1,
    service_work: -1,
    service_pm: -1,
    service_reagent_changed: -1,
    service_wash_changed: -1,
    service_qc_changed: -1,
    log_id: -1,
    actor_username: -1,
    actor_name: -1,
    event_types: -1,
    changes_json: -1,
    schema_version: -1,
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
    r_changed: idx('Reagent Changed At'),
    w_changed: idx('Wash Changed At'),
    q_changed: idx('QC Changed At'),
    service_visit: idx('Service Visit'),
    service_company: idx('Service Company'),
    service_technician: idx('Service Technician'),
    service_work: idx('Service Work'),
    service_pm: idx('Service PM Performed'),
    service_reagent_changed: idx('Service Reagent Changed'),
    service_wash_changed: idx('Service Wash Changed'),
    service_qc_changed: idx('Service QC Changed'),
    log_id: idx('Log ID'),
    actor_username: idx('Actor Username'),
    actor_name: idx('Actor Name'),
    event_types: idx('Event Types'),
    changes_json: idx('Changes JSON'),
    schema_version: idx('Schema Version'),
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

function isAdmin_(user) {
  return String(user && user.role || '').trim().toLowerCase() === 'admin';
}

function isTechnician_(user) {
  return String(user && user.role || '').trim().toLowerCase() === 'technician';
}

function assertWardAccess_(user, requestedWard) {
  const ward = String(requestedWard || '').trim();
  if (!ward) throw new Error('Ward is required');
  if (isAdmin_(user)) return ward;

  const assignedWard = String(user && user.ward || '').trim();
  if (!assignedWard || assignedWard.toLowerCase() !== ward.toLowerCase()) {
    throw new Error('Forbidden ward');
  }
  return assignedWard;
}

function getWardDataBatch(wardName, sessionToken) {
  const sessionUser = requireSession_(sessionToken);
  if (isTechnician_(sessionUser)) throw new Error('Technician users cannot view reagent records');
  const ward = assertWardAccess_(sessionUser, wardName);
  const lastRecordResult = getLastRecord_(ward);
  const logsResult = getLogs_({ ward: ward, limit: 20 });
  const wardsResult = getWardsForUser_(sessionUser);

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

function valueAt_(row, index) {
  return index >= 0 && index < row.length ? row[index] : '';
}

function parseJson_(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(String(value));
  } catch (err) {
    return fallback;
  }
}

function parseEventTypes_(value, record) {
  const parsed = parseJson_(value, null);
  if (Array.isArray(parsed)) return parsed.map(String);

  const text = String(value || '').trim();
  if (text) return text.split(',').map(item => item.trim()).filter(Boolean);

  const derived = [];
  const comment = String(record.comment || '');
  if (/เปลี่ยน.+pack/i.test(comment)) derived.push('pack_change');
  if (record.deprotein || record.condition) derived.push('maintenance');
  if (record.waste === WASTE_YES_TH) derived.push('waste');
  if (comment.trim()) derived.push('comment');
  if (derived.length === 0) derived.push('status_update');
  return derived;
}

function toObj_(row, col) {
  if (!row || row.length === 0) return null;
  return {
    timestamp: isoDateTime_(valueAt_(row, col.ts)),
    ward: String(valueAt_(row, col.ward) || ''),
    worker: String(valueAt_(row, col.worker) || ''),
    reagent: parseAnyNum_(valueAt_(row, col.r_pct)),
    reagentExpiry: isoDate_(valueAt_(row, col.r_exp)),
    reagentLot: String(valueAt_(row, col.r_lot) || ''),
    reagentChangedAt: isoDateTime_(valueAt_(row, col.r_changed)),
    wash: parseAnyNum_(valueAt_(row, col.w_pct)),
    washExpiry: isoDate_(valueAt_(row, col.w_exp)),
    washLot: String(valueAt_(row, col.w_lot) || ''),
    washChangedAt: isoDateTime_(valueAt_(row, col.w_changed)),
    qc: parseAnyNum_(valueAt_(row, col.q_pct)),
    qcExpiry: isoDate_(valueAt_(row, col.q_exp)),
    qcLot: String(valueAt_(row, col.q_lot) || ''),
    qcChangedAt: isoDateTime_(valueAt_(row, col.q_changed)),
    serviceVisit: String(valueAt_(row, col.service_visit)).toUpperCase() === 'TRUE',
    serviceCompany: String(valueAt_(row, col.service_company) || ''),
    serviceTechnician: String(valueAt_(row, col.service_technician) || ''),
    serviceWork: String(valueAt_(row, col.service_work) || ''),
    servicePmPerformed: String(valueAt_(row, col.service_pm)).toUpperCase() === 'TRUE',
    serviceReagentChanged: String(valueAt_(row, col.service_reagent_changed)).toUpperCase() === 'TRUE',
    serviceWashChanged: String(valueAt_(row, col.service_wash_changed)).toUpperCase() === 'TRUE',
    serviceQcChanged: String(valueAt_(row, col.service_qc_changed)).toUpperCase() === 'TRUE',
    comment: String(valueAt_(row, col.cmt) || ''),
    deprotein: String(valueAt_(row, col.dp)) === DONE_TH || String(valueAt_(row, col.dp)).toUpperCase() === 'TRUE',
    condition: String(valueAt_(row, col.cd)) === DONE_TH || String(valueAt_(row, col.cd)).toUpperCase() === 'TRUE',
    waste: String(valueAt_(row, col.waste) || DEFAULT_WASTE),
  };
}

function toLogObj_(row, col, rowNumber) {
  const record = toObj_(row, col);
  const schemaVersion = Number(valueAt_(row, col.schema_version)) || 0;
  const eventTypes = parseEventTypes_(valueAt_(row, col.event_types), record);
  return {
    ...record,
    id: String(valueAt_(row, col.log_id) || ('legacy-' + rowNumber)),
    actor: {
      username: String(valueAt_(row, col.actor_username) || ''),
      name: String(valueAt_(row, col.actor_name) || record.worker || ''),
    },
    eventTypes: eventTypes,
    changes: parseJson_(valueAt_(row, col.changes_json), []),
    isLegacy: schemaVersion < AUDIT_SCHEMA_VERSION,
    schemaVersion: schemaVersion,
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
    const authActions = ['saveRecord', 'saveServiceReport', 'getLogs', 'getLastRecord', 'getWardDataBatch', 'getWards'];

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
    else if (action === 'getLogs') result = getLogs(body, body.sessionToken);
    else if (action === 'saveRecord') result = saveRecord(data, body.sessionToken);
    else if (action === 'saveServiceReport') result = saveServiceReport(data, body.sessionToken);
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
      const active = String(rows[i][4] || '').trim().toLowerCase();
      if (['false', '0', 'no', 'inactive'].includes(active)) {
        return { success: false, message: 'User account is inactive' };
      }
      const storedP = String(rows[i][1]);
      if (storedP === searchP || storedP === String(p)) {
        const user = {
          username: u,
          fullName: rows[i][2],
          role: rows[i][3],
          ward: rows[i][5] || '',
          company: rows[i][6] || '',
        };
        return { success: true, user: user, sessionToken: createSession_(user) };
      }
    }
  }

  return { success: false, message: 'Invalid credentials' };
}

function getWards(sessionToken) {
  const sessionUser = requireSession_(sessionToken);
  return getWardsForUser_(sessionUser);
}

function getWards_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(WARDS_SHEET) || initSheets().wsh;
  return {
    success: true,
    wards: sh.getDataRange().getValues().slice(1).map(r => String(r[0]).trim()).filter(Boolean),
  };
}

function getWardsForUser_(sessionUser) {
  if (!isAdmin_(sessionUser)) {
    const assignedWard = String(sessionUser && sessionUser.ward || '').trim();
    return { success: true, wards: assignedWard ? [assignedWard] : [] };
  }
  return getWards_();
}

function getLastRecord(wardName, sessionToken) {
  const sessionUser = requireSession_(sessionToken);
  if (isTechnician_(sessionUser)) throw new Error('Technician users cannot view reagent records');
  return getLastRecord_(assertWardAccess_(sessionUser, wardName));
}

function getLastRecord_(wardName) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RECORDS_SHEET) || initSheets().rsh;
  ensureHeaders_(sh, BASE_HEADERS.concat(PACK_DATE_HEADERS, SERVICE_HEADERS));
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

function getLogs(params, sessionToken) {
  const sessionUser = requireSession_(sessionToken);
  const options = params || {};
  return getLogs_({
    ...options,
    ward: assertWardAccess_(sessionUser, options.ward),
    actorUsername: isTechnician_(sessionUser) ? String(sessionUser.username || '') : '',
  });
}

function encodeCursor_(rowNumber) {
  return Utilities.base64EncodeWebSafe(String(rowNumber));
}

function decodeCursor_(cursor, fallback) {
  if (!cursor) return fallback;
  try {
    const decoded = Utilities.newBlob(Utilities.base64DecodeWebSafe(String(cursor))).getDataAsString();
    const rowNumber = parseInt(decoded, 10);
    return isNaN(rowNumber) ? fallback : rowNumber;
  } catch (err) {
    return fallback;
  }
}

function matchesLogFilters_(log, options) {
  if (String(log.ward || '').trim().toLowerCase() !== String(options.ward || '').trim().toLowerCase()) {
    return false;
  }

  const timestamp = log.timestamp ? new Date(log.timestamp).getTime() : 0;
  if (options.dateFrom) {
    const from = new Date(String(options.dateFrom) + 'T00:00:00').getTime();
    if (!isNaN(from) && timestamp < from) return false;
  }
  if (options.dateTo) {
    const to = new Date(String(options.dateTo) + 'T23:59:59.999').getTime();
    if (!isNaN(to) && timestamp > to) return false;
  }

  const requestedTypes = Array.isArray(options.eventTypes)
    ? options.eventTypes.map(String)
    : String(options.eventTypes || '').split(',').map(item => item.trim()).filter(Boolean);
  if (requestedTypes.length > 0 && !requestedTypes.some(type => log.eventTypes.includes(type))) {
    return false;
  }
  if ((options.onlyWithComment === true || String(options.onlyWithComment) === 'true') && !String(log.comment || '').trim()) {
    return false;
  }
  if (options.actorUsername && String(log.actor && log.actor.username || '').trim().toLowerCase() !== String(options.actorUsername).trim().toLowerCase()) {
    return false;
  }

  const query = String(options.query || '').trim().toLowerCase();
  if (query) {
    const searchable = [
      log.worker,
      log.actor && log.actor.name,
      log.actor && log.actor.username,
      log.reagentLot,
      log.washLot,
      log.qcLot,
      log.serviceCompany,
      log.serviceTechnician,
      log.serviceWork,
      log.comment,
    ].join(' ').toLowerCase();
    if (searchable.indexOf(query) === -1) return false;
  }
  return true;
}

function getLogs_(options) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOGS_SHEET) || initSheets().lsh;
  ensureHeaders_(sh, BASE_HEADERS.concat(PACK_DATE_HEADERS, SERVICE_HEADERS, LOG_AUDIT_HEADERS));
  const col = getColMap_(sh);
  const lastRow = sh.getLastRow();
  const limit = Math.min(50, Math.max(1, parseInt(options.limit, 10) || 20));
  let scanRow = Math.min(lastRow, decodeCursor_(options.cursor, lastRow));
  const matches = [];
  const chunkSize = 200;

  if (scanRow < 2) {
    return { success: true, logs: [], nextCursor: null, hasMore: false };
  }

  while (scanRow >= 2 && matches.length <= limit) {
    const startRow = Math.max(2, scanRow - chunkSize + 1);
    const rows = sh.getRange(startRow, 1, scanRow - startRow + 1, sh.getLastColumn()).getValues();

    for (let index = rows.length - 1; index >= 0; index--) {
      const rowNumber = startRow + index;
      const log = toLogObj_(rows[index], col, rowNumber);
      if (matchesLogFilters_(log, options)) {
        matches.push({ log: log, rowNumber: rowNumber });
        if (matches.length > limit) break;
      }
    }
    scanRow = startRow - 1;
  }

  const hasMore = matches.length > limit;
  const nextCursor = hasMore ? encodeCursor_(matches[limit].rowNumber) : null;
  return {
    success: true,
    logs: matches.slice(0, limit).map(item => item.log),
    nextCursor: nextCursor,
    hasMore: hasMore,
  };
}

function saveServiceReport(data, sessionToken) {
  const sessionUser = requireSession_(sessionToken);
  if (!isTechnician_(sessionUser)) throw new Error('Only technician users can submit service reports');

  const ward = assertWardAccess_(sessionUser, data && data.ward);
  const work = String(data && data.serviceWork || '').trim();
  if (!work) throw new Error('Service work is required');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheets = initSheets();
    const lsh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOGS_SHEET) || sheets.lsh;
    ensureHeaders_(lsh, BASE_HEADERS.concat(PACK_DATE_HEADERS, SERVICE_HEADERS, LOG_AUDIT_HEADERS));
    const col = getColMap_(lsh);
    const timestamp = new Date().toISOString();
    const serviceEntry = {
      timestamp: timestamp,
      ward: ward,
      worker: String(sessionUser.fullName || sessionUser.username || ''),
      reagent: null,
      reagentExpiry: '',
      reagentLot: '',
      wash: null,
      washExpiry: '',
      washLot: '',
      qc: null,
      qcExpiry: '',
      qcLot: '',
      comment: String(data && data.comment || '').trim(),
      deprotein: false,
      condition: false,
      waste: DEFAULT_WASTE,
      serviceVisit: true,
      serviceCompany: String(sessionUser.company || '').trim(),
      serviceTechnician: String(sessionUser.fullName || sessionUser.username || '').trim(),
      serviceWork: work,
      servicePmPerformed: !!(data && data.servicePmPerformed),
      serviceReagentChanged: !!(data && data.serviceReagentChanged),
      serviceWashChanged: !!(data && data.serviceWashChanged),
      serviceQcChanged: !!(data && data.serviceQcChanged),
    };
    const changes = [
      'serviceCompany', 'serviceTechnician', 'serviceWork', 'servicePmPerformed',
      'serviceReagentChanged', 'serviceWashChanged', 'serviceQcChanged',
    ].map(field => ({ field: field, before: '', after: serviceEntry[field] }));
    if (serviceEntry.comment) changes.push({ field: 'comment', before: '', after: serviceEntry.comment });
    const logEntry = {
      ...serviceEntry,
      logId: Utilities.getUuid(),
      actorUsername: String(sessionUser.username || ''),
      actorName: String(sessionUser.fullName || sessionUser.username || ''),
      eventTypes: serviceEntry.comment ? ['service_visit', 'comment'] : ['service_visit'],
      changes: changes,
      schemaVersion: AUDIT_SCHEMA_VERSION,
    };
    lsh.appendRow(prepareRow_(col, logEntry));
    return { success: true, message: 'บันทึกรายงานงานช่างสำเร็จ', logId: logEntry.logId };
  } finally {
    lock.releaseLock();
  }
}

function saveRecord(data, sessionToken) {
  const sessionUser = requireSession_(sessionToken);
  if (isTechnician_(sessionUser)) throw new Error('Technician users can only submit service reports');
  return saveRecord_({
    ...data,
    ward: assertWardAccess_(sessionUser, data && data.ward),
  }, sessionUser);
}

function saveRecord_(data, sessionUser) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = initSheets();
    const rsh = ss.getSheetByName(RECORDS_SHEET) || sheets.rsh;
    const lsh = ss.getSheetByName(LOGS_SHEET) || sheets.lsh;
    ensureHeaders_(rsh, BASE_HEADERS.concat(PACK_DATE_HEADERS, SERVICE_HEADERS));
    ensureHeaders_(lsh, BASE_HEADERS.concat(PACK_DATE_HEADERS, SERVICE_HEADERS, LOG_AUDIT_HEADERS));
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

    const now = new Date();
    const timestamp = now.toISOString();
    const merged = {
      ...existingData,
      ...data,
      timestamp: timestamp,
      worker: sessionUser.fullName || sessionUser.username,
      reagent: parseAnyNum_(data.reagent) ?? existingData.reagent,
      wash: parseAnyNum_(data.wash) ?? existingData.wash,
      qc: parseAnyNum_(data.qc) ?? existingData.qc,
      reagentExpiry: data.reagentExpiry || existingData.reagentExpiry,
      reagentLot: data.reagentLot || existingData.reagentLot,
      reagentChangedAt: data.reagentPackChanged ? timestamp : (existingData.reagentChangedAt || ''),
      washExpiry: data.washExpiry || existingData.washExpiry,
      washLot: data.washLot || existingData.washLot,
      washChangedAt: data.washPackChanged ? timestamp : (existingData.washChangedAt || ''),
      qcExpiry: data.qcExpiry || existingData.qcExpiry,
      qcLot: data.qcLot || existingData.qcLot,
      qcChangedAt: data.qcPackChanged ? timestamp : (existingData.qcChangedAt || ''),
      serviceVisit: !!data.serviceVisit,
      serviceCompany: data.serviceVisit ? String(data.serviceCompany || '').trim() : '',
      serviceTechnician: data.serviceVisit ? String(data.serviceTechnician || '').trim() : '',
      serviceWork: data.serviceVisit ? String(data.serviceWork || '').trim() : '',
      servicePmPerformed: !!data.serviceVisit && !!data.servicePmPerformed,
      comment: String(data.comment || '').trim(),
      deprotein: !!data.deprotein,
      condition: !!data.condition,
      waste: data.waste || DEFAULT_WASTE,
    };
    const changes = buildAuditChanges_(existingData, merged, data);
    const eventTypes = buildEventTypes_(existingData, merged, data);
    const logEntry = {
      ...merged,
      logId: Utilities.getUuid(),
      actorUsername: String(sessionUser.username || ''),
      actorName: String(sessionUser.fullName || sessionUser.username || ''),
      eventTypes: eventTypes,
      changes: changes,
      schemaVersion: AUDIT_SCHEMA_VERSION,
    };

    const rowR = prepareRow_(colR, merged);
    if (targetRow > 1) {
      rsh.getRange(targetRow, 1, 1, rowR.length).setValues([rowR]);
    } else {
      rsh.appendRow(rowR);
    }
    lsh.appendRow(prepareRow_(colL, logEntry));

    return { success: true, message: 'บันทึกสำเร็จ', logId: logEntry.logId };
  } finally {
    lock.releaseLock();
  }
}

function prepareRow_(col, recordData) {
  const availableColumns = Object.values(col).filter(index => index >= 0);
  const row = new Array(Math.max(...availableColumns) + 1).fill('');
  if (col.ts >= 0) row[col.ts] = recordData.timestamp ? new Date(recordData.timestamp) : new Date();
  if (col.ward >= 0) row[col.ward] = recordData.ward || '';
  if (col.worker >= 0) row[col.worker] = recordData.worker || '';
  if (col.r_pct >= 0) row[col.r_pct] = recordData.reagent ?? '';
  if (col.r_exp >= 0) row[col.r_exp] = recordData.reagentExpiry || '';
  if (col.r_lot >= 0) row[col.r_lot] = recordData.reagentLot || '';
  if (col.r_changed >= 0) row[col.r_changed] = recordData.reagentChangedAt ? new Date(recordData.reagentChangedAt) : '';
  if (col.w_pct >= 0) row[col.w_pct] = recordData.wash ?? '';
  if (col.w_exp >= 0) row[col.w_exp] = recordData.washExpiry || '';
  if (col.w_lot >= 0) row[col.w_lot] = recordData.washLot || '';
  if (col.w_changed >= 0) row[col.w_changed] = recordData.washChangedAt ? new Date(recordData.washChangedAt) : '';
  if (col.q_pct >= 0) row[col.q_pct] = recordData.qc ?? '';
  if (col.q_exp >= 0) row[col.q_exp] = recordData.qcExpiry || '';
  if (col.q_lot >= 0) row[col.q_lot] = recordData.qcLot || '';
  if (col.q_changed >= 0) row[col.q_changed] = recordData.qcChangedAt ? new Date(recordData.qcChangedAt) : '';
  if (col.service_visit >= 0) row[col.service_visit] = !!recordData.serviceVisit;
  if (col.service_company >= 0) row[col.service_company] = recordData.serviceCompany || '';
  if (col.service_technician >= 0) row[col.service_technician] = recordData.serviceTechnician || '';
  if (col.service_work >= 0) row[col.service_work] = recordData.serviceWork || '';
  if (col.service_pm >= 0) row[col.service_pm] = !!recordData.servicePmPerformed;
  if (col.service_reagent_changed >= 0) row[col.service_reagent_changed] = !!recordData.serviceReagentChanged;
  if (col.service_wash_changed >= 0) row[col.service_wash_changed] = !!recordData.serviceWashChanged;
  if (col.service_qc_changed >= 0) row[col.service_qc_changed] = !!recordData.serviceQcChanged;
  if (col.cmt >= 0) row[col.cmt] = recordData.comment || '';
  if (col.dp >= 0) row[col.dp] = recordData.deprotein ? DONE_TH : NOT_DONE_TH;
  if (col.cd >= 0) row[col.cd] = recordData.condition ? DONE_TH : NOT_DONE_TH;
  if (col.waste >= 0) row[col.waste] = recordData.waste || DEFAULT_WASTE;
  if (col.log_id >= 0) row[col.log_id] = recordData.logId || '';
  if (col.actor_username >= 0) row[col.actor_username] = recordData.actorUsername || '';
  if (col.actor_name >= 0) row[col.actor_name] = recordData.actorName || '';
  if (col.event_types >= 0) row[col.event_types] = JSON.stringify(recordData.eventTypes || []);
  if (col.changes_json >= 0) row[col.changes_json] = JSON.stringify(recordData.changes || []);
  if (col.schema_version >= 0) row[col.schema_version] = recordData.schemaVersion || '';
  return row;
}

function sameAuditValue_(before, after) {
  if ((before === null || before === undefined || before === '') &&
      (after === null || after === undefined || after === '')) {
    return true;
  }
  return String(before) === String(after);
}

function buildAuditChanges_(before, after, submitted) {
  const fields = [
    'reagent', 'reagentLot', 'reagentExpiry', 'reagentChangedAt',
    'wash', 'washLot', 'washExpiry', 'washChangedAt',
    'qc', 'qcLot', 'qcExpiry', 'qcChangedAt',
    'deprotein', 'condition', 'waste',
  ];
  if (submitted.serviceVisit) {
    fields.push('serviceVisit', 'serviceCompany', 'serviceTechnician', 'serviceWork', 'servicePmPerformed');
  }
  const changes = fields
    .filter(field => !sameAuditValue_(before[field], after[field]))
    .map(field => ({ field: field, before: before[field] ?? '', after: after[field] ?? '' }));

  if (String(after.comment || '').trim()) {
    changes.push({ field: 'comment', before: '', after: after.comment });
  }
  if (submitted.deprotein && !changes.some(change => change.field === 'deprotein')) {
    changes.push({ field: 'deprotein', before: before.deprotein ?? false, after: true });
  }
  if (submitted.condition && !changes.some(change => change.field === 'condition')) {
    changes.push({ field: 'condition', before: before.condition ?? false, after: true });
  }
  return changes;
}

function buildEventTypes_(before, after, submitted) {
  const eventTypes = [];
  if (submitted.reagentPackChanged || submitted.washPackChanged || submitted.qcPackChanged) {
    eventTypes.push('pack_change');
  }
  if (
    !sameAuditValue_(before.reagent, after.reagent) ||
    !sameAuditValue_(before.wash, after.wash) ||
    !sameAuditValue_(before.qc, after.qc) ||
    !sameAuditValue_(before.reagentLot, after.reagentLot) ||
    !sameAuditValue_(before.washLot, after.washLot) ||
    !sameAuditValue_(before.qcLot, after.qcLot) ||
    !sameAuditValue_(before.reagentExpiry, after.reagentExpiry) ||
    !sameAuditValue_(before.washExpiry, after.washExpiry) ||
    !sameAuditValue_(before.qcExpiry, after.qcExpiry)
  ) {
    eventTypes.push('status_update');
  }
  if (submitted.deprotein || submitted.condition) eventTypes.push('maintenance');
  if (submitted.serviceVisit) eventTypes.push('service_visit');
  if (submitted.waste === WASTE_YES_TH) eventTypes.push('waste');
  if (String(after.comment || '').trim()) eventTypes.push('comment');
  if (eventTypes.length === 0) eventTypes.push('status_update');
  return eventTypes;
}

function ensureHeaders_(sheet, requiredHeaders) {
  if (!sheet) return;
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(requiredHeaders);
    return;
  }

  const existing = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(value => String(value).trim());
  const missing = requiredHeaders.filter(header => existing.indexOf(header) === -1);
  if (missing.length > 0) {
    sheet.getRange(1, sheet.getLastColumn() + 1, 1, missing.length).setValues([missing]);
  }
}

function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rsh = ss.getSheetByName(RECORDS_SHEET) || ss.insertSheet(RECORDS_SHEET);
  const lsh = ss.getSheetByName(LOGS_SHEET) || ss.insertSheet(LOGS_SHEET);
  ensureHeaders_(rsh, BASE_HEADERS.concat(PACK_DATE_HEADERS, SERVICE_HEADERS));
  ensureHeaders_(lsh, BASE_HEADERS.concat(PACK_DATE_HEADERS, SERVICE_HEADERS, LOG_AUDIT_HEADERS));

  const ush = ss.getSheetByName(USERS_SHEET) || ss.insertSheet(USERS_SHEET);
  if (ush.getLastRow() === 0) ush.appendRow(USER_HEADERS);

  const wsh = ss.getSheetByName(WARDS_SHEET) || ss.insertSheet(WARDS_SHEET);
  if (wsh.getLastRow() === 0) wsh.appendRow(['Ward']);

  return {
    rsh: rsh,
    lsh: lsh,
    ush: ush,
    wsh: wsh,
  };
}

function isoDateTime_(value) {
  if (!value) return '';
  try {
    const date = value instanceof Date ? value : new Date(value);
    return isNaN(date.getTime()) ? String(value) : date.toISOString();
  } catch (err) {
    return String(value);
  }
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
