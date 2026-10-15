/* Les autorisations proviennent de l’onglet Invités et sont revérifiées au POST. */
(function () {
    'use strict';
    var eventNames = ['mairie', 'houppa', 'shabbat'];
    var status = document.getElementById('invitation-status');
    var params = new URLSearchParams(window.location.search);
    var inviteId = (params.get('invite') || params.get('id') || '').trim().toLowerCase();

    // Le nom dans le lien sert uniquement à l’affichage, jamais aux autorisations.
    var displayName = (params.get('nom') || '').trim().slice(0, 200);
    if (inviteId && displayName) {
        document.getElementById('envelope-recipient').textContent = displayName;
        document.getElementById('envelope-addressee').hidden = false;
    }

    function unavailable(message) {
        document.getElementById('envelope-addressee').hidden = true;
        window.currentInvitation = null;
        document.body.classList.remove('invitation-ready');
        status.hidden = false;
        status.textContent = message;
    }

    if (!inviteId) {
        unavailable('Pour découvrir votre programme et répondre, ouvrez le lien personnel envoyé par Eden et Ilan.');
        return;
    }

    window.sheetApi.guest(inviteId)
        .then(function (guest) {
            var capacity = guest && (guest.maxPersonnes === undefined ? guest.maxAdultes + guest.maxEnfants : guest.maxPersonnes);
            if (!guest || typeof guest.nom !== 'string' || !guest.nom.trim() ||
                !eventNames.every(function (name) { return typeof guest[name] === 'boolean'; }) ||
                !Number.isInteger(capacity) || capacity < 1 || capacity > 100) {
                throw new Error('Invitation mal configurée');
            }
            if (window.localPreview) {
                document.getElementById('local-preview-notice').hidden = false;
                var submit = document.querySelector('.submit-btn');
                submit.disabled = true;
                submit.textContent = 'Aperçu — aucun envoi';
            }
            var events = {};
            eventNames.forEach(function (name) {
                var allowed = guest[name] === true;
                events[name] = allowed;
                var select = document.getElementById(name + '-personnes');
                select.replaceChildren();
                for (var count = 1; count <= capacity; count++) select.add(new Option(String(count), String(count)));
                document.getElementById(name).hidden = !allowed;
                var responseSection = document.getElementById('rsvp-' + name);
                responseSection.hidden = !allowed;
                responseSection.querySelectorAll('input, select').forEach(function (input) {
                    input.disabled = !allowed;
                });
                document.querySelector('.nav-item[data-target="' + name + '"]').hidden = !allowed;
            });
            var hasEvents = eventNames.some(function (name) { return events[name]; });
            document.getElementById('programme').hidden = !hasEvents;
            document.getElementById('reponse').hidden = !hasEvents;
            document.querySelector('.cover-enter').hidden = !hasEvents;
            document.getElementById('nom').value = guest.nom;
            document.getElementById('nom').readOnly = true;
            document.getElementById('invitation-greeting').textContent = 'Ces moments, nous souhaitons les partager avec vous.';
            [
                ['envelope-recipient', guest.nom],
                ['card-recipient', 'Pour ' + guest.nom],
                ['cover-recipient', guest.nom + ',']
            ].forEach(function (entry) {
                var recipient = document.getElementById(entry[0]);
                recipient.textContent = entry[1];
                recipient.hidden = false;
            });
            document.getElementById('envelope-addressee').hidden = false;
            document.querySelector('.cover-invite').textContent = 'C’est avec une immense joie et une profonde gratitude envers Hachem que nous vous invitons à partager ces moments précieux à nos côtés.';
            window.currentInvitation = { id: inviteId, events: events };
            status.hidden = hasEvents;
            if (!hasEvents) status.textContent = 'Bonjour ' + guest.nom + '. Aucun événement n’est associé à votre invitation pour le moment. Contactez Eden ou Ilan.';
            document.body.classList.add('invitation-ready');
            if (typeof window.initDockPosition === 'function') window.initDockPosition();
        })
        .catch(function (error) {
            if (error.message === 'not_found') {
                unavailable('Ce lien d’invitation est inconnu. Contactez Eden ou Ilan pour recevoir votre lien personnel.');
                return;
            }
            unavailable('Votre invitation ne peut pas être chargée. Actualisez la page ou contactez Eden ou Ilan si le problème persiste.');
        });
})();
