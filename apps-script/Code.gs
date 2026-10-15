// Copier ce fichier dans le projet Apps Script lié au Google Sheets.
var SPREADSHEET_ID = '1rpb6pRC_cQ3_3dYrnFl5WKfFRMgX2KYeFcqdhgQYJxE';
var EVENTS = ['mairie', 'houppa', 'shabbat'];
var RESPONSE_HEADERS = ['Date', 'Nom', 'Mairie', 'Houppa', 'Shabbat', 'Message', 'ID invité', 'ID envoi'];

function spreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function normalize_(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

function guest_(id, sourceRows) {
  if (!id || id.length > 200) throw new Error('invalid_id');
  var sheet = spreadsheet_().getSheetByName('Invités');
  if (!sheet) throw new Error('missing_guests_sheet');
  var rows = sourceRows || sheet.getDataRange().getValues();
  var headers = rows[0].map(normalize_);
  var columns = ['id', 'nom', 'mairie', 'houppa', 'shabbat'].map(function (name) {
    var index = headers.indexOf(name);
    if (index < 0) throw new Error('invalid_guests_headers');
    return index;
  });
  var matches = rows.slice(1).filter(function (row) { return normalize_(row[columns[0]]) === id; });
  if (!matches.length) throw new Error('not_found');
  if (matches.length > 1) throw new Error('duplicate_guest_id');
  var row = matches[0];
  var guest = { id: id, nom: String(row[columns[1]] || '').trim() };
  if (!guest.nom) throw new Error('missing_guest_name');
  EVENTS.forEach(function (name, index) {
    var value = normalize_(row[columns[index + 2]]);
    if (['oui', 'non', 'true', 'false', ''].indexOf(value) < 0) throw new Error('invalid_guest_permission');
    guest[name] = value === 'oui' || value === 'true';
  });
  ['Max adultes', 'Max enfants'].forEach(function (name, index) {
    var column = headers.indexOf(normalize_(name));
    var raw = column < 0 ? '' : row[column];
    var value = Number(raw);
    if (raw === '' || raw == null || !Number.isInteger(value) || value < (index === 0 ? 1 : 0) || value > 50) throw new Error('invalid_guest_limits');
    guest[index === 0 ? 'maxAdultes' : 'maxEnfants'] = value;
  });
  return guest;
}

function output_(data, callback) {
  var json = JSON.stringify(data).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  if (callback && /^wedding_[a-zA-Z0-9_]+$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function validRequest_(value) {
  return typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value);
}

function receipt_(sheet, id, requestId) {
  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 8) return false;
  var headers = sheet.getRange(1, 7, 1, 2).getValues()[0];
  if (headers[0] !== RESPONSE_HEADERS[6] || headers[1] !== RESPONSE_HEADERS[7]) return false;
  return sheet.getRange(2, 7, sheet.getLastRow() - 1, 2).getValues().some(function (row) {
    return String(row[0]) === id && String(row[1]) === requestId;
  });
}

// Lecture uniquement : aucun enregistrement n'est déclenché par un lien GET/JSONP.
function doGet(e) {
  var params = (e && e.parameter) || {};
  try {
    var id = normalize_(params.id);
    var guest = guest_(id);
    if (params.action === 'status') {
      if (!validRequest_(params.requestId)) throw new Error('invalid_request_id');
      return output_({ ok: true, saved: receipt_(spreadsheet_().getSheetByName('Réponses'), id, params.requestId), requestId: params.requestId }, params.callback);
    }
    if (params.action && params.action !== 'guest') throw new Error('invalid_action');
    return output_(guest, params.callback);
  } catch (error) {
    return output_({ ok: false, error: error.message || 'server_error' }, params.callback);
  }
}

function textCell_(value) {
  // Éviter qu'un nom ou message commençant par '=' soit interprété comme formule.
  return /^\s*[=+@-]/.test(value) ? "'" + value : value;
}

function eventLine_(guest, payload, name, label) {
  if (!guest[name]) return 'Masqué';
  var answer = payload.events && payload.events[name];
  if (!answer || ['oui', 'non'].indexOf(answer.presence) < 0) throw new Error('invalid_answer');
  if (answer.presence === 'non') return label + ' : Non';
  if (!Number.isInteger(answer.adultes) || answer.adultes < 1 || answer.adultes > guest.maxAdultes ||
      !Number.isInteger(answer.enfants) || answer.enfants < 0 || answer.enfants > guest.maxEnfants) throw new Error('invalid_counts');
  return label + ' : Oui (' + answer.adultes + ' adulte(s), ' + answer.enfants + ' enfant(s))';
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    var body = e && e.parameter && e.parameter.payload || e && e.postData && e.postData.contents;
    if (!body || body.length > 12000) throw new Error('invalid_payload');
    var payload = JSON.parse(body);
    if (!payload || typeof payload !== 'object') throw new Error('invalid_payload');
    if (payload.action === 'create' || payload.action === 'dashboard') {
      var result = payload.action === 'create' ? createGuest_(payload) : dashboard_(payload);
      return adminOutput_(result, payload);
    }
    if (!validRequest_(payload.requestId)) throw new Error('invalid_request_id');
    var id = normalize_(payload.invite);
    var guest = guest_(id);
    if (!EVENTS.some(function (name) { return guest[name]; })) throw new Error('no_events');
    var message = payload.message == null ? '' : payload.message;
    if (typeof message !== 'string' || message.length > 2000) throw new Error('invalid_message');
    var answers = EVENTS.map(function (name, index) {
      return eventLine_(guest, payload, name, ['Mairie', 'Houppa & Soirée', 'Chabbat'][index]);
    });
    lock.waitLock(10000);
    locked = true;
    var book = spreadsheet_();
    var sheet = book.getSheetByName('Réponses') || book.insertSheet('Réponses');
    if (!sheet.getLastRow()) sheet.appendRow(RESPONSE_HEADERS);
    else {
      var headers = sheet.getRange(1, 1, 1, 8).getValues()[0];
      if (!RESPONSE_HEADERS.slice(0, 6).every(function (name, index) { return headers[index] === name; })) throw new Error('invalid_response_headers');
      if ((headers[6] && headers[6] !== RESPONSE_HEADERS[6]) || (headers[7] && headers[7] !== RESPONSE_HEADERS[7])) throw new Error('occupied_tracking_columns');
      sheet.getRange(1, 7, 1, 2).setValues([RESPONSE_HEADERS.slice(6)]);
    }
    if (!receipt_(sheet, id, payload.requestId)) {
      sheet.appendRow([new Date(), textCell_(guest.nom)].concat(answers, [textCell_(message.trim()), textCell_(id), payload.requestId]));
      SpreadsheetApp.flush();
    }
    return output_({ ok: true, saved: true, requestId: payload.requestId });
  } catch (error) {
    return adminOutput_({ ok: false, error: error.message || 'server_error' }, typeof payload === 'object' && payload || {});
  } finally {
    if (locked) lock.releaseLock();
  }
}

// Deux clés distinctes : ADMIN_KEY_DAHAN et ADMIN_KEY_CHICHE, propriétés privées du script.
// Elle n'est jamais stockée dans le dépôt ni transmise dans une URL.
function createGuest_(payload) {
  var family = authorize_(payload);
  if (!validRequest_(payload.id)) throw new Error('invalid_id');
  if (typeof payload.nom !== 'string' || !payload.nom.trim() || payload.nom.length > 120) throw new Error('invalid_name');
  if (!Number.isInteger(payload.maxAdultes) || payload.maxAdultes < 1 || payload.maxAdultes > 50 ||
      !Number.isInteger(payload.maxEnfants) || payload.maxEnfants < 0 || payload.maxEnfants > 50) throw new Error('invalid_guest_limits');
  if (!EVENTS.every(function (name) { return typeof payload[name] === 'boolean'; }) ||
      !EVENTS.some(function (name) { return payload[name]; })) throw new Error('invalid_events');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var book = spreadsheet_();
    var sheet = book.getSheetByName('Invités') || book.insertSheet('Invités');
    var required = ['ID', 'Nom', 'Mairie', 'Houppa', 'Shabbat', 'Max adultes', 'Max enfants', 'Famille'];
    if (!sheet.getLastRow()) sheet.appendRow(required);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    required.forEach(function (name) {
      if (headers.map(normalize_).indexOf(normalize_(name)) < 0) {
        headers.push(name);
        sheet.getRange(1, headers.length, 1, 1).setValues([[name]]);
      }
    });
    var idColumn = headers.map(normalize_).indexOf('id');
    var familyColumn = headers.map(normalize_).indexOf('famille');
    var existing = sheet.getDataRange().getValues().slice(1).filter(function (row) { return normalize_(row[idColumn]) === payload.id; });
    if (existing.length) {
      if (existing.length !== 1 || normalize_(existing[0][familyColumn]) !== family) throw new Error('forbidden');
      return { ok: true, guest: guest_(payload.id) };
    }
    var record = { id: payload.id, nom: textCell_(payload.nom.trim()), mairie: payload.mairie ? 'oui' : 'non',
      houppa: payload.houppa ? 'oui' : 'non', shabbat: payload.shabbat ? 'oui' : 'non',
      'max adultes': payload.maxAdultes, 'max enfants': payload.maxEnfants, famille: family };
    sheet.appendRow(headers.map(function (header) {
      return Object.prototype.hasOwnProperty.call(record, normalize_(header)) ? record[normalize_(header)] : '';
    }));
    SpreadsheetApp.flush();
    return { ok: true, guest: guest_(payload.id) };
  } finally {
    lock.releaseLock();
  }
}

function authorize_(payload) {
  var family = normalize_(payload.family);
  if (['dahan', 'chiche'].indexOf(family) < 0) throw new Error('unauthorized');
  var properties = PropertiesService.getScriptProperties();
  var expected = properties.getProperty('ADMIN_KEY_' + family.toUpperCase());
  var other = properties.getProperty('ADMIN_KEY_' + (family === 'dahan' ? 'CHICHE' : 'DAHAN'));
  if (!expected || expected.length < 32 || expected === other || typeof payload.adminKey !== 'string' || payload.adminKey !== expected) throw new Error('unauthorized');
  return family;
}

// Les réponses privées ne passent jamais par JSONP ou par des paramètres d'URL.
// Le formulaire POST embarqué renvoie sa réponse au seul domaine autorisé.
function adminOutput_(data, payload) {
  if (!payload.replyOrigin) return output_(data); // Appels serveur / tests.
  var origin = payload.replyOrigin;
  var allowed = origin === 'https://mariage-eden-ilan.com' || /^http:\/\/(localhost|127\.0\.0\.1):[0-9]+$/.test(origin);
  if (!allowed || !validRequest_(payload.rpcId)) return output_({ ok: false, error: 'invalid_origin' });
  var envelope = JSON.stringify({ source: 'wedding-admin', rpcId: payload.rpcId, data: data })
    .replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return HtmlService.createHtmlOutput('<!doctype html><html><body><script>window.top.postMessage(' + envelope + ',' + JSON.stringify(origin) + ');</script></body></html>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function parseAnswer_(value) {
  var text = String(value || '');
  if (/ : Non$/.test(text)) return { presence: 'non', adultes: 0, enfants: 0 };
  var match = text.match(/ : Oui \((\d+) adulte\(s\), (\d+) enfant\(s\)\)$/);
  return match ? { presence: 'oui', adultes: Number(match[1]), enfants: Number(match[2]) } : null;
}

function dashboard_(payload) {
  var family = authorize_(payload);
  var book = spreadsheet_();
  var sheet = book.getSheetByName('Invités');
  var totals = {};
  EVENTS.forEach(function (name) { totals[name] = { invitedAdults: 0, invitedChildren: 0, adults: 0, children: 0, pending: 0, declined: 0 }; });
  if (!sheet || sheet.getLastRow() < 2) return { ok: true, family: family, guests: [], totals: totals, legacyResponses: false };
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0].map(normalize_);
  var familyColumn = headers.indexOf('famille');
  var idColumn = headers.indexOf('id');
  if (familyColumn < 0 || idColumn < 0) throw new Error('missing_family_column');
  var guests = rows.slice(1).filter(function (row) { return normalize_(row[familyColumn]) === family; }).map(function (row) {
    var guest = guest_(normalize_(row[idColumn]), rows);
    guest.answers = {};
    return guest;
  });
  var byId = Object.create(null);
  guests.forEach(function (guest) { byId[guest.id] = guest; });
  var responseSheet = book.getSheetByName('Réponses');
  var legacy = false;
  if (responseSheet && responseSheet.getLastRow() > 1) {
    var responses = responseSheet.getDataRange().getValues();
    var responseHeaders = responses[0];
    if (!RESPONSE_HEADERS.slice(0, 6).every(function (name, index) { return responseHeaders[index] === name; })) throw new Error('invalid_response_headers');
    var tracked = responseHeaders[6] === RESPONSE_HEADERS[6] && responseHeaders[7] === RESPONSE_HEADERS[7];
    var latest = Object.create(null);
    responses.slice(1).forEach(function (row) {
      if (!tracked || !row[6]) { legacy = true; return; }
      var guest = byId[normalize_(row[6])];
      if (!guest) return;
      var timestamp = new Date(row[0]).getTime();
      if (!isFinite(timestamp)) throw new Error('invalid_response_date');
      if (latest[guest.id] !== undefined && timestamp < latest[guest.id]) return;
      latest[guest.id] = timestamp;
      // La réponse la plus récente compte, même si les lignes ont été triées.
      EVENTS.forEach(function (name, index) { guest.answers[name] = parseAnswer_(row[index + 2]); });
    });
  }
  guests.forEach(function (guest) {
    EVENTS.forEach(function (name) {
      if (!guest[name]) { delete guest.answers[name]; return; }
      var total = totals[name];
      total.invitedAdults += guest.maxAdultes;
      total.invitedChildren += guest.maxEnfants;
      var answer = guest.answers[name];
      if (!answer) { total.pending++; return; }
      if (answer.adultes > guest.maxAdultes || answer.enfants > guest.maxEnfants) throw new Error('response_exceeds_capacity');
      if (answer.presence === 'non') total.declined++;
      total.adults += answer.adultes;
      total.children += answer.enfants;
    });
  });
  return { ok: true, family: family, guests: guests, totals: totals, legacyResponses: legacy };
}
