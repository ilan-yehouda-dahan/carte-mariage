(function () {
    'use strict';
    var family = document.body.dataset.family;
    var key = '';
    var session = 0;
    var snapshot = null;
    var pending = null;
    var form = document.getElementById('create-form');
    var feedback = document.getElementById('form-feedback');
    var button = document.getElementById('create-button');
    var labels = { mairie: 'Mairie', houppa: 'Houppa & soirée', shabbat: 'Chabbat' };
    var dates = { mairie: '11 février 2027', houppa: '18 février 2027 à 16 h', shabbat: '19 février 2027' };
    function invitationUrl(guest) {
        var url = new URL(window.localPreview ? '/' : 'https://mariage-eden-ilan.com/', location.href);
        url.searchParams.set('invite', guest.id);
        url.searchParams.set('nom', guest.nom);
        if (window.localPreview) url.searchParams.set('preview', '1');
        return url.href;
    }
    function message(guest, url) {
        var intro = guest.houppa ? 'C’est avec une immense gratitude envers Hachem et le cœur rempli de joie que nous vous invitons à célébrer le mariage d’Eden et Ilan, qui aura lieu, Bé’ezrat Hachem, le jeudi 18 février 2027.' : 'C’est avec une immense gratitude envers Hachem et le cœur rempli de joie que nous vous invitons à partager les célébrations de notre mariage, Bé’ezrat Hachem.';
        return 'Bonjour ' + guest.nom + ' 🤍\n\n' + intro + '\n\n' + Object.keys(labels).filter(function (name) { return guest[name]; }).map(function (name) { return labels[name] + ' — ' + dates[name]; }).join('\n') + '\n\nNous espérons de tout cœur vous avoir à nos côtés pour partager ces moments si précieux !\n\nRetrouvez votre invitation personnelle et tous les détails dans le lien ci-dessous. Vous pourrez également y confirmer votre présence :\n\n💌 ' + url + '\n\nAvec toute notre affection,\nEden & Ilan' + (window.localPreview ? '\n\n[Aperçu local : ce lien fonctionne uniquement dans ce navigateur sur cet ordinateur.]' : '');
    }
    function unanswered(guest) {
        return Object.keys(labels).filter(function (name) { return guest[name] && !(guest.answers && guest.answers[name]); });
    }
    function reminder(guest, url) {
        return 'Bonjour ' + guest.nom + ' 🤍\n\nNous espérons, Bé’ezrat Hachem, avoir la joie de vous retrouver pour les célébrations de notre mariage !\n\nPour nous aider à préparer ces beaux moments, pourriez-vous nous confirmer votre présence et le nombre de personnes pour :\n' + unanswered(guest).map(function (name) { return labels[name] + ' — ' + dates[name]; }).join('\n') + '\n\nVoici votre invitation personnelle pour nous répondre :\n💌 ' + url + '\n\nMerci de tout cœur,\nEden & Ilan' + (window.localPreview ? '\n\n[Aperçu local : ce lien fonctionne uniquement dans ce navigateur sur cet ordinateur.]' : '');
    }
    function share(guest, isReminder) {
        var url = invitationUrl(guest);
        document.getElementById('invite-url').value = url;
        document.getElementById('view-link').href = url;
        var text = isReminder ? reminder(guest, url) : message(guest, url);
        document.getElementById('whatsapp-message').value = text;
        document.getElementById('whatsapp-link').href = 'https://wa.me/?text=' + encodeURIComponent(text);
        document.getElementById('result').hidden = false;
        document.getElementById('copy-feedback').textContent = '';
    }
    function td(row, text) { var cell = document.createElement('td'); cell.textContent = String(text); row.appendChild(cell); return cell; }
    function render(data) {
        snapshot = data;
        var totals = document.getElementById('totals'); totals.replaceChildren();
        Object.keys(labels).forEach(function (name) {
            var total = data.totals[name]; var row = document.createElement('tr');
            [labels[name], total.invited, total.people, total.pending, total.declined].forEach(function (text) { td(row, text); }); totals.appendChild(row);
        });
        renderGuests();
        document.getElementById('legacy-notice').hidden = !data.legacyResponses;
        document.getElementById('dashboard-status').textContent = (window.localPreview ? 'Données de démonstration locales. ' : 'Données Google Sheets actualisées. ') + data.guests.length + ' foyer(s).';
    }
    function normalizeName(value) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim(); }
    function renderGuests() {
        var list = document.getElementById('guest-list'); list.replaceChildren();
        if (!snapshot) { document.getElementById('filter-status').textContent = ''; return; }
        var query = normalizeName(document.getElementById('guest-search').value);
        var onlyPending = document.getElementById('guest-filter').value === 'pending';
        var guests = snapshot.guests.filter(function (guest) {
            return normalizeName(guest.nom).includes(query) && (!onlyPending || unanswered(guest).length > 0);
        });
        guests.forEach(function (guest) {
            var row = document.createElement('tr');
            td(row, guest.nom); td(row, guest.maxPersonnes);
            var replies = Object.keys(labels).filter(function (name) { return guest[name]; }).map(function (name) {
                var answer = guest.answers && guest.answers[name];
                return labels[name] + ' : ' + (!answer ? 'en attente' : answer.presence === 'non' ? 'absent' : answer.personnes + ' personne(s)');
            });
            td(row, replies.join(' · '));
            var actions = document.createElement('div'); actions.className = 'guest-actions';
            function addAction(text, isReminder) {
                var action = document.createElement('button'); action.type = 'button'; action.className = 'share-button' + (isReminder ? ' reminder-button' : ''); action.textContent = text;
                action.addEventListener('click', function () { share(guest, isReminder); document.getElementById('result').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
                actions.appendChild(action);
            }
            addAction('Lien / WhatsApp', false);
            if (unanswered(guest).length) addAction('Préparer une relance', true);
            td(row, '').appendChild(actions); list.appendChild(row);
        });
        document.getElementById('filter-status').textContent = guests.length + ' foyer(s) affiché(s) sur ' + snapshot.guests.length + '. Sans réponse : au moins un événement reste en attente. Les effectifs et le CSV restent complets.';
        document.getElementById('empty-list').hidden = guests.length > 0;
        document.getElementById('empty-list').textContent = snapshot.guests.length ? 'Aucun invité ne correspond à ces filtres.' : 'Aucune invitation pour le moment. Créez votre premier foyer ci-dessus.';
    }
    document.getElementById('guest-search').addEventListener('input', renderGuests);
    document.getElementById('guest-filter').addEventListener('change', renderGuests);
    async function refresh() {
        var currentSession = session;
        var data = await window.sheetApi.dashboard(family, key);
        if (currentSession !== session) throw new Error('closed_session');
        if (data.family !== family) throw new Error('forbidden');
        render(data);
    }
    function close() {
        session++; key = ''; snapshot = null; pending = null;
        history.replaceState(null, '', location.pathname + location.search);
        document.getElementById('login-feedback').textContent = 'Espace fermé. Rouvrez votre lien privé pour retrouver votre gestion.';
        document.getElementById('retry-access').hidden = true;
        document.getElementById('private-space').hidden = true;
        document.getElementById('login-panel').hidden = false;
        document.getElementById('totals').replaceChildren(); document.getElementById('guest-list').replaceChildren();
        document.getElementById('result').hidden = true;
        document.getElementById('invite-url').value = ''; document.getElementById('whatsapp-message').value = '';
        document.getElementById('whatsapp-link').removeAttribute('href'); document.getElementById('view-link').removeAttribute('href');
        feedback.textContent = ''; form.reset();
        document.getElementById('guest-search').value = ''; document.getElementById('guest-filter').value = 'all'; renderGuests();
    }
    async function openPrivateLink() {
        var token = new URLSearchParams(location.hash.slice(1)).get('acces') || '';
        if (token.length < 32 || token.length > 512) return;
        session++;
        var accessSession = session;
        key = token;
        var retry = document.getElementById('retry-access'); retry.disabled = true;
        document.getElementById('login-feedback').textContent = 'Ouverture de votre espace privé…';
        try {
            await refresh();
            document.getElementById('login-panel').hidden = true;
            document.getElementById('private-space').hidden = false;
            document.getElementById('login-feedback').textContent = '';
        } catch (_) {
            if (accessSession !== session) return;
            key = '';
            document.getElementById('login-feedback').textContent = 'Ce lien ne permet pas d’ouvrir votre espace, ou le service est indisponible. Vérifiez que vous utilisez le bon lien privé.';
            retry.hidden = false;
        } finally { if (accessSession === session) retry.disabled = false; }
    }
    document.getElementById('retry-access').addEventListener('click', openPrivateLink);
    window.addEventListener('hashchange', function () {
        if (window.localPreview) return;
        var hash = location.hash;
        close();
        history.replaceState(null, '', location.pathname + location.search + hash);
        openPrivateLink();
    });
    document.getElementById('logout').addEventListener('click', close);
    document.getElementById('refresh').addEventListener('click', async function () {
        this.disabled = true; button.disabled = true; document.getElementById('export').disabled = true;
        try { await refresh(); } catch (_) { snapshot = null; document.getElementById('totals').replaceChildren(); document.getElementById('guest-list').replaceChildren(); document.getElementById('dashboard-status').textContent = 'Actualisation impossible. Les données ne sont pas confirmées ; réessayez.'; }
        finally { this.disabled = false; button.disabled = false; document.getElementById('export').disabled = false; }
    });
    function values() {
        return { nom: document.getElementById('guest-name').value.trim(), mairie: document.getElementById('mairie').checked, houppa: document.getElementById('houppa').checked, shabbat: document.getElementById('shabbat').checked, maxPersonnes: Number(document.getElementById('max-people').value) };
    }
    form.addEventListener('input', function () {
        var data = values();
        document.getElementById('summary-name').textContent = data.nom || 'Votre famille invitée';
        document.getElementById('summary-events').textContent = Object.keys(labels).filter(function (name) { return data[name]; }).map(function (name) { return labels[name]; }).join(' · ') || 'Aucun événement sélectionné';
        document.getElementById('summary-capacity').textContent = data.maxPersonnes + ' personne(s) maximum';
        document.getElementById('result').hidden = true; feedback.textContent = '';
    });
    form.addEventListener('submit', async function (event) {
        event.preventDefault(); if (button.disabled) return;
        var data = values();
        if (!data.nom || !Object.keys(labels).some(function (name) { return data[name]; })) { feedback.textContent = 'Renseignez un nom et choisissez au moins un événement.'; return; }
        if (!Number.isInteger(data.maxPersonnes) || data.maxPersonnes < 1 || data.maxPersonnes > 100) return;
        var fingerprint = JSON.stringify(data);
        if (!pending || pending.fingerprint !== fingerprint) pending = { fingerprint: fingerprint, id: crypto.randomUUID() };
        var payload = Object.assign({ action: 'create', family: family, id: pending.id, adminKey: key }, data);
        button.disabled = true; form.setAttribute('aria-busy', 'true'); feedback.textContent = 'Création de votre invitation…';
        form.querySelectorAll('input').forEach(function (input) { input.disabled = true; });
        // Éviter une déconnexion pendant qu'une opération privée est en cours.
        document.getElementById('logout').disabled = true; document.getElementById('refresh').disabled = true; document.getElementById('export').disabled = true;
        try {
            var guest = await window.sheetApi.create(payload);
            share(guest);
            feedback.textContent = window.localPreview ? 'Invitation de démonstration créée dans ce navigateur.' : 'Invitation enregistrée. Vous pouvez copier son lien ou préparer WhatsApp.';
            try { await refresh(); } catch (_) { snapshot = null; document.getElementById('dashboard-status').textContent = 'Invitation créée ; actualisez les effectifs avant export.'; }
        } catch (_) { feedback.textContent = 'Création non confirmée. Vérifiez votre accès et réessayez sans modifier les champs.'; }
        finally { button.disabled = false; form.removeAttribute('aria-busy'); document.getElementById('logout').disabled = false; document.getElementById('refresh').disabled = false; document.getElementById('export').disabled = false; form.querySelectorAll('input').forEach(function (input) { input.disabled = false; }); payload.adminKey = ''; }
    });
    document.getElementById('copy-button').addEventListener('click', async function () {
        try { await navigator.clipboard.writeText(document.getElementById('invite-url').value); document.getElementById('copy-feedback').textContent = 'Lien copié.'; }
        catch (_) { document.getElementById('invite-url').select(); document.getElementById('copy-feedback').textContent = 'Sélectionnez le lien puis copiez-le.'; }
    });
    document.getElementById('export').addEventListener('click', function () {
        if (!snapshot) { document.getElementById('dashboard-status').textContent = 'Actualisez les données avant de les exporter.'; return; }
        var rows = [['Événement', 'Personnes invitées', 'Personnes confirmées', 'Foyers sans réponse', 'Foyers absents']];
        Object.keys(labels).forEach(function (name) { var t = snapshot.totals[name]; rows.push([labels[name], t.invited, t.people, t.pending, t.declined]); });
        var csv = '\uFEFF' + rows.map(function (row) { return row.map(function (value) { return '"' + String(value).replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n');
        var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); var link = document.createElement('a'); link.href = url; link.download = 'effectifs-' + family + '.csv'; link.click(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
    if (window.localPreview) {
        document.getElementById('demo-notice').hidden = false;
        document.getElementById('logout').hidden = true;
        document.getElementById('login-panel').hidden = true;
        document.getElementById('private-space').hidden = false;
        refresh().catch(function () { document.getElementById('dashboard-status').textContent = 'Impossible de charger les exemples locaux.'; });
    } else {
        openPrivateLink();
    }
})();
