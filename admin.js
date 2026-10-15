(function () {
    'use strict';
    var form = document.getElementById('create-form');
    var feedback = document.getElementById('form-feedback');
    var button = document.getElementById('create-button');
    var pending = null;
    var labels = { mairie: 'Mairie', houppa: 'Houppa & soirée', shabbat: 'Chabbat' };
    if (window.localPreview) {
        document.getElementById('demo-notice').hidden = false;
        document.getElementById('key-field').hidden = true;
        document.getElementById('admin-key').disabled = true;
    }
    function values() {
        return { nom: document.getElementById('guest-name').value.trim(),
            mairie: document.getElementById('mairie').checked,
            houppa: document.getElementById('houppa').checked,
            shabbat: document.getElementById('shabbat').checked,
            maxAdultes: Number(document.getElementById('max-adults').value),
            maxEnfants: Number(document.getElementById('max-children').value) };
    }
    form.addEventListener('input', function () {
        var data = values();
        document.getElementById('summary-name').textContent = data.nom || 'Votre famille invitée';
        document.getElementById('summary-events').textContent = Object.keys(labels).filter(function (name) { return data[name]; }).map(function (name) { return labels[name]; }).join(' · ') || 'Aucun événement sélectionné';
        document.getElementById('summary-capacity').textContent = 'Jusqu’à ' + data.maxAdultes + ' adulte(s) · ' + (data.maxEnfants ? data.maxEnfants + ' enfant(s)' : 'sans enfants');
        document.getElementById('result').hidden = true;
        feedback.textContent = '';
    });
    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (button.disabled) return;
        var data = values();
        if (!data.nom || !Object.keys(labels).some(function (name) { return data[name]; })) {
            feedback.textContent = 'Renseignez un nom et choisissez au moins un événement.';
            return;
        }
        if (!Number.isInteger(data.maxAdultes) || data.maxAdultes < 1 || data.maxAdultes > 50 ||
            !Number.isInteger(data.maxEnfants) || data.maxEnfants < 0 || data.maxEnfants > 50) return;
        var fingerprint = JSON.stringify(data);
        if (!pending || pending.fingerprint !== fingerprint) pending = { fingerprint: fingerprint, id: crypto.randomUUID() };
        var payload = Object.assign({ action: 'create', id: pending.id, adminKey: document.getElementById('admin-key').value }, data);
        button.disabled = true;
        feedback.textContent = 'Création de votre invitation…';
        form.querySelectorAll('input').forEach(function (input) { input.disabled = true; });
        try {
            var guest = await window.sheetApi.create(payload);
            var url = new URL(window.localPreview ? './' : 'https://mariage-eden-ilan.com/', location.href);
            url.searchParams.set('invite', guest.id);
            if (window.localPreview) url.searchParams.set('preview', '1');
            document.getElementById('invite-url').value = url.href;
            document.getElementById('view-link').href = url.href;
            document.getElementById('result').hidden = false;
            document.getElementById('copy-feedback').textContent = '';
            feedback.textContent = window.localPreview ? 'Invitation de démonstration créée dans ce navigateur.' : 'Invitation enregistrée. Vous pouvez copier son lien.';
            document.getElementById('result').scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (_) {
            feedback.textContent = 'Création non confirmée. Vérifiez la clé de gestion et le déploiement Apps Script, puis réessayez sans modifier les champs.';
        } finally {
            button.disabled = false;
            form.querySelectorAll('input').forEach(function (input) { input.disabled = false; });
            document.getElementById('admin-key').disabled = window.localPreview;
            payload.adminKey = ''; // La clé reste seulement dans le champ de cette page.
        }
    });
    document.getElementById('copy-button').addEventListener('click', async function () {
        try {
            await navigator.clipboard.writeText(document.getElementById('invite-url').value);
            document.getElementById('copy-feedback').textContent = 'Lien copié.';
        } catch (_) {
            document.getElementById('invite-url').select();
            document.getElementById('copy-feedback').textContent = 'Sélectionnez le lien puis copiez-le.';
        }
    });
})();
