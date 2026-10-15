const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function backend(options = {}) {
    const tables = { 'Invités': [
        ['ID', 'Nom', 'Mairie', 'Houppa', 'Shabbat', 'Max adultes', 'Max enfants'],
        ['elie-chicha', '=Nom', 'non', 'oui', false, 2, 1],
        ['sans-evenement', 'Sans', 'non', 'non', 'non', 2, 0]
    ] };
    if (options.existing) tables['Réponses'] = [['Date', 'Nom', 'Mairie', 'Houppa', 'Shabbat', 'Message'], ['ancienne date', 'Ancien', 'Non', 'Oui', 'Non', 'ancien message']];
    let locks = 0;
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
        PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'a'.repeat(40) }) },
        SpreadsheetApp: { openById: () => book, flush: () => {} },
        ContentService: { MimeType: { JSON: 'json', JAVASCRIPT: 'js' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
        LockService: { getScriptLock: () => ({ waitLock: () => { locks++; }, releaseLock: () => { locks--; } }) }
    });
    vm.runInContext(fs.readFileSync('apps-script/Code.gs', 'utf8'), context);
    return {
        tables, locks: () => locks,
        post: payload => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(payload) } }).text),
        get: params => JSON.parse(context.doGet({ parameter: params }).text),
        rawGet: params => context.doGet({ parameter: params }).text
    };
}
const requestId = '00000000-0000-4000-8000-000000000001';
const answer = () => ({ invite: 'elie-chicha', requestId, nom: 'Faux nom', events: { houppa: { presence: 'oui', adultes: 2, enfants: 1 }, mairie: { presence: 'oui', adultes: 6, enfants: 5 } }, message: '=FORMULE()' });

test('lookup reads sheet flags, accepts case and refuses unknown IDs', () => {
    const api = backend();
    assert.equal(api.get({ id: ' ELIE-CHICHA ' }).houppa, true);
    assert.equal(api.get({ id: 'elie-chicha' }).shabbat, false);
    assert.equal(api.get({ id: 'inconnu' }).error, 'not_found');
});
test('canonical name, permissions, literal text and receipt, without duplicate writes', () => {
    const api = backend();
    assert.equal(api.get({ action: 'status', id: 'elie-chicha', requestId }).saved, false);
    assert.equal(api.post(answer()).saved, true);
    assert.equal(api.post(answer()).saved, true);
    const rows = api.tables['Réponses'];
    assert.equal(rows.length, 2);
    assert.equal(rows[1][1], "'=Nom");
    assert.equal(rows[1][2], 'Masqué');
    assert.match(rows[1][3], /2 adulte\(s\), 1 enfant\(s\)/);
    assert.equal(rows[1][4], 'Masqué');
    assert.equal(rows[1][5], "'=FORMULE()");
    assert.equal(api.get({ action: 'status', id: 'elie-chicha', requestId }).saved, true);
    assert.equal(api.get({ action: 'status', id: 'sans-evenement', requestId }).saved, false);
    assert.equal(api.locks(), 0);
});
test('existing responses preserved and tracking columns added', () => {
    const api = backend({ existing: true });
    const original = [...api.tables['Réponses'][1]];
    assert.equal(api.post(answer()).ok, true);
    assert.deepEqual(api.tables['Réponses'][1], original);
    assert.equal(api.tables['Réponses'][0][6], 'ID invité');
    assert.equal(api.tables['Réponses'].length, 3);
});
test('invalid counts, absent invites, malformed payload and missing answers cannot write', () => {
    for (const payload of [null, {}, { ...answer(), invite: 'inconnu' }, { ...answer(), invite: 'sans-evenement' }, { ...answer(), events: {} }, { ...answer(), events: { houppa: { presence: 'oui', adultes: 0, enfants: 0 } } }, { ...answer(), message: 'x'.repeat(2001) }]) {
        const api = backend();
        assert.equal(api.post(payload).ok, false);
        assert.equal(api.tables['Réponses'], undefined);
        assert.equal(api.locks(), 0);
    }
});
test('safe callbacks only; GET never writes', () => {
    const api = backend();
    assert.match(api.rawGet({ id: 'elie-chicha', callback: 'wedding_123' }), /^wedding_123\(/);
    assert.doesNotMatch(api.rawGet({ id: 'elie-chicha', callback: 'alert(1)//' }), /alert/);
    assert.equal(api.tables['Réponses'], undefined);
});
test('header errors do not overwrite existing columns; locks released on failure', () => {
    const api = backend({ existing: true });
    api.tables['Réponses'][0][6] = 'Autre donnée';
    assert.equal(api.post(answer()).error, 'occupied_tracking_columns');
    assert.equal(api.tables['Réponses'].length, 2);
    assert.equal(api.locks(), 0);
});
test('absent answer records zero attendance without requiring counts', () => {
    const api = backend();
    const payload = answer();
    payload.events.houppa = { presence: 'non' };
    assert.equal(api.post(payload).ok, true);
    assert.equal(api.tables['Réponses'][1][3], 'Houppa & Soirée : Non');
});

test('family capacity is enforced by server for adults and children', () => {
    for (const [adults, children] of [[3,0],[2,2],[1,-1],[1.5,0]]) {
        const api = backend();
        const payload = answer();
        payload.events.houppa = { presence:'oui', adultes:adults, enfants:children };
        assert.equal(api.post(payload).error, 'invalid_counts');
        assert.equal(api.tables['Réponses'], undefined);
    }
    const api = backend();
    api.tables['Invités'][1][6] = 0;
    assert.equal(api.post(answer()).error, 'invalid_counts');
});
test('missing or invalid capacities fail closed', () => {
    const api = backend();
    api.tables['Invités'][1][5] = '';
    assert.equal(api.get({id:'elie-chicha'}).error, 'invalid_guest_limits');
    assert.equal(api.post(answer()).ok, false);
});
const create = () => ({ action:'create', id:requestId, adminKey:'a'.repeat(40), nom:'Famille Cohen', mairie:false, houppa:true, shabbat:false, maxAdultes:2, maxEnfants:0 });
test('admin creation requires the secret and returns a reusable guest with limits', () => {
    const api = backend();
    assert.equal(api.post({...create(),adminKey:'wrong'}).error, 'unauthorized');
    assert.equal(api.tables['Invités'].length,3);
    assert.equal(api.post(create()).ok,true);
    assert.equal(api.post(create()).ok,true);
    assert.equal(api.tables['Invités'].length,4);
    const guest = api.get({id:requestId});
    assert.equal(guest.nom,'Famille Cohen');
    assert.equal(guest.maxAdultes,2);
    assert.equal(guest.maxEnfants,0);
    assert.equal(guest.houppa,true);
    assert.equal(guest.mairie,false);
    assert.equal(api.locks(),0);
});
test('admin adds capacity headers without overwriting existing columns', () => {
    const api = backend();
    api.tables['Invités'].forEach(row=>row.splice(5));
    assert.equal(api.post(create()).ok,true);
    assert.equal(api.get({id:requestId}).maxAdultes,2);
    assert.equal(api.tables['Invités'][0][5],'Max adultes');
});
test('invalid admin event selection and limits do not create a guest', () => {
    for (const patch of [{maxAdultes:0},{maxEnfants:-1},{houppa:false},{nom:''}]) {
        const api = backend();
        assert.equal(api.post({...create(),...patch}).ok,false);
        assert.equal(api.tables['Invités'].length,3);
    }
});
