(function () {
    'use strict';
    var form = document.getElementById('rsvp-form');
    var button = form.querySelector('.submit-btn');
    var feedback = document.getElementById('confirm-msg');
    var pending = null;
    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (button.disabled) return;
        feedback.classList.remove('show');
        var invitation = window.currentInvitation;
        if (!invitation || !Object.values(invitation.events).some(Boolean)) return;
        var answers = {};
        Object.keys(invitation.events).forEach(function (name) {
            if (!invitation.events[name]) return;
            answers[name] = {
                presence: form.querySelector('input[name="' + name + '-presence"]:checked').value,
                personnes: Number(document.getElementById(name + '-personnes').value)
            };
        });
        var data = { invite: invitation.id, events: answers, message: document.getElementById('message').value.trim() };
        var fingerprint = JSON.stringify(data);
        // Réessayer la même réponse conserve son ID pour éviter deux lignes.
        if (!pending || pending.fingerprint !== fingerprint) {
            pending = { fingerprint: fingerprint, requestId: crypto.randomUUID() };
        }
        data.requestId = pending.requestId;
        button.disabled = true;
        button.textContent = 'Enregistrement en cours…';
        try {
            await window.sheetApi.submit(data);
            feedback.textContent = 'Merci ! Votre réponse a bien été enregistrée.';
        } catch (_) {
            feedback.textContent = 'Nous ne pouvons pas confirmer l’enregistrement de votre réponse. Réessayez sans modifier les champs, ou contactez Eden ou Ilan.';
        } finally {
            // Conserver les réponses, y compris si la réception est incertaine.
            button.disabled = false;
            button.textContent = 'Confirmer ma présence';
            feedback.classList.add('show');
            feedback.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });
})();
