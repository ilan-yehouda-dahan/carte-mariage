/* Personnalisation d'affichage : les liens peuvent être partagés.
   La validation des réponses doit aussi être effectuée côté Google Apps Script. */
(function () {
    'use strict';
    var eventNames = ['mairie', 'houppa', 'shabbat'];
    var status = document.getElementById('invitation-status');
    var inviteId = new URLSearchParams(window.location.search).get('invite');

    function unavailable(message) {
        window.currentInvitation = null;
        document.body.classList.remove('invitation-ready');
        status.hidden = false;
        status.textContent = message;
    }

    if (!inviteId) {
        unavailable('Pour découvrir votre programme et répondre, ouvrez le lien personnel envoyé par Eden et Ilan.');
        return;
    }

    fetch('guests.json', { cache: 'no-store' })
        .then(function (response) {
            if (!response.ok) throw new Error('Impossible de charger les invités');
            return response.json();
        })
        .then(function (guests) {
            if (!Object.prototype.hasOwnProperty.call(guests, inviteId)) {
                unavailable('Ce lien d’invitation est inconnu. Contactez Eden ou Ilan pour recevoir votre lien personnel.');
                return;
            }
            var guest = guests[inviteId];
            if (!guest || typeof guest.nom !== 'string' || !guest.nom.trim() ||
                !eventNames.every(function (name) { return typeof guest[name] === 'boolean'; })) {
                throw new Error('Invitation mal configurée');
            }
            var events = {};
            eventNames.forEach(function (name) {
                var allowed = guest[name] === true;
                events[name] = allowed;
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
            document.getElementById('invitation-greeting').textContent = 'Bienvenue ' + guest.nom;
            window.currentInvitation = { id: inviteId, events: events };
            status.hidden = hasEvents;
            if (!hasEvents) status.textContent = 'Bonjour ' + guest.nom + '. Aucun événement n’est associé à votre invitation pour le moment. Contactez Eden ou Ilan.';
            document.body.classList.add('invitation-ready');
            if (typeof window.initDockPosition === 'function') window.initDockPosition();
        })
        .catch(function () {
            unavailable('Votre invitation ne peut pas être chargée. Actualisez la page ou contactez Eden ou Ilan si le problème persiste.');
        });
})();
