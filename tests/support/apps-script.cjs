const vm = require('node:vm');
const fs = require('node:fs');
function backend(options = {}) {
    const tables = { 'Invités': [
        ['ID', 'Nom', 'Mairie', 'Houppa', 'Shabbat', 'Max adultes', 'Max enfants', 'Famille'],
        ['elie-chicha', '=Nom', 'non', 'oui', false, 2, 1, 'dahan'],
        ['sans-evenement', 'Sans', 'non', 'non', 'non', 2, 0, 'chiche']
    ] };
    if (options.existing) tables['Réponses'] = [['Date', 'Nom', 'Mairie', 'Houppa', 'Shabbat', 'Message'], ['ancienne date', 'Ancien', 'Non', 'Oui', 'Non', 'ancien message']];
    let locks = 0;
    let uiHtml = '';
    let generated = 0;
    const properties = options.properties || { ADMIN_KEY_DAHAN: 'a'.repeat(40), ADMIN_KEY_CHICHE: 'b'.repeat(40) };
    function sheet(name) {
        return {
            getDataRange: () => ({ getValues: () => tables[name] }),
            getLastRow: () => tables[name].length,
            getLastColumn: () => Math.max(0, ...tables[name].map(row => row.length)),
            getRange: (r, c, nr, nc) => ({
                getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => tables[name][r - 1 + i]?.[c - 1 + j] ?? '')),
                setValues: values => values.forEach((row, i) => row.forEach((value, j) => { tables[name][r - 1 + i][c - 1 + j] = value; }))
            }),
            appendRow: row => tables[name].push(row)
        };
    }
    const book = {
        getSheetByName: name => tables[name] ? sheet(name) : null,
        insertSheet: name => { tables[name] = []; return sheet(name); }
    };
    const context = vm.createContext({
        PropertiesService: { getScriptProperties: () => ({ getProperty: name => properties[name] || null, setProperty: (name,value) => { properties[name]=value; } }) },
        Utilities: { getUuid: () => '00000000-0000-4000-8000-' + String(++generated).padStart(12,'0') },
        SpreadsheetApp: { openById: () => book, flush: () => {}, getUi: () => ({ showModalDialog: output => { uiHtml=output.text; } }) },
        HtmlService: { XFrameOptionsMode: { ALLOWALL: 'all' }, createHtmlOutput: text => ({ text, setXFrameOptionsMode() { return this; }, setWidth() { return this; }, setHeight() { return this; } }) },
        ContentService: { MimeType: { JSON: 'json', JAVASCRIPT: 'js' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
        LockService: { getScriptLock: () => ({ waitLock: () => { locks++; }, releaseLock: () => { locks--; } }) }
    });
    vm.runInContext(fs.readFileSync('apps-script/Code.gs', 'utf8'), context);
    return {
        showLinks: () => { context.afficherLiensPrives(); return uiHtml; }, properties,
        tables, locks: () => locks,
        rawPostForm: payload => context.doPost({ parameter: { payload: JSON.stringify(payload) } }).text,
        post: payload => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(payload) } }).text),
        get: params => JSON.parse(context.doGet({ parameter: params }).text),
        rawGet: params => context.doGet({ parameter: params }).text
    };
}

module.exports = { backend };
