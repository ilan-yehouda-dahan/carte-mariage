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

function guest_(id) {
  if (!id || id.length > 200) throw new Error('invalid_id');
  var sheet = spreadsheet_().getSheetByName('Invités');
  if (!sheet) throw new Error('missing_guests_sheet');
  var rows = sheet.getDataRange().getValues();
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
  if (!Number.isInteger(answer.adultes) || answer.adultes < 1 || answer.adultes > 6 ||
      !Number.isInteger(answer.enfants) || answer.enfants < 0 || answer.enfants > 5) throw new Error('invalid_counts');
  return label + ' : Oui (' + answer.adultes + ' adulte(s), ' + answer.enfants + ' enfant(s))';
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    var body = e && e.postData && e.postData.contents;
    if (!body || body.length > 12000) throw new Error('invalid_payload');
    var payload = JSON.parse(body);
    if (!payload || typeof payload !== 'object') throw new Error('invalid_payload');
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
    return output_({ ok: false, error: error.message || 'server_error' });
  } finally {
    if (locked) lock.releaseLock();
  }
}
