/* Les GET sont en JSONP (lecture seule), pour suivre les redirections Apps Script
   depuis GitHub Pages sans dépendre des en-têtes CORS. */
(function () {
    'use strict';
    var endpoint = 'https://script.google.com/macros/s/AKfycbzrHvIXBmpMvPRLxpapbqnqaEv0wRVhQPVbLrZf0Edf0keF8_RJRTOdfMW3-N_93vf-wg/exec';
    function read(params) {
        return new Promise(function (resolve, reject) {
            var callback = 'wedding_' + crypto.randomUUID().replace(/-/g, '');
            var url = new URL(endpoint);
            Object.keys(params).forEach(function (key) { url.searchParams.set(key, params[key]); });
            url.searchParams.set('callback', callback);
            var script = document.createElement('script');
            script.referrerPolicy = 'no-referrer';
            var timer = setTimeout(function () { finish(new Error('timeout')); }, 20000);
            function finish(error, data) {
                clearTimeout(timer);
                script.remove();
                delete window[callback];
                if (error) reject(error); else resolve(data);
            }
            window[callback] = function (data) {
                if (data && data.error) finish(new Error(data.error));
                else finish(null, data);
            };
            script.onerror = function () { finish(new Error('network_error')); };
            script.src = url.href;
            document.head.appendChild(script);
        });
    }
    function publicGuest(guest) {
        var result = {};
        ['id', 'nom', 'mairie', 'houppa', 'shabbat', 'maxAdultes', 'maxEnfants'].forEach(function (key) { result[key] = guest[key]; });
        return result;
    }
    function adminRequest(payload) {
        if (window.localPreview) return previewAdmin(payload);
        return new Promise(function (resolve, reject) {
            var rpcId = crypto.randomUUID();
            var frame = document.createElement('iframe');
            frame.name = 'admin_' + rpcId;
            frame.hidden = true;
            var form = document.createElement('form');
            form.method = 'POST'; form.action = endpoint; form.target = frame.name; form.hidden = true;
            var input = document.createElement('textarea'); input.name = 'payload';
            input.value = JSON.stringify(Object.assign({}, payload, { rpcId: rpcId, replyOrigin: location.origin }));
            form.appendChild(input);
            var timer = setTimeout(function () { finish(new Error('timeout')); }, 45000);
            function finish(error, result) {
                clearTimeout(timer); window.removeEventListener('message', receive);
                input.value = ''; form.remove(); frame.remove();
                if (error) reject(error); else resolve(result);
            }
            function receive(event) {
                var google = event.origin === 'https://script.google.com' || event.origin === 'https://script.googleusercontent.com' ||
                    /^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/.test(event.origin);
                var data = event.data;
                if (!google || !data || data.source !== 'wedding-admin' || data.rpcId !== rpcId) return;
                if (!data.data || data.data.ok !== true) finish(new Error(data.data && data.data.error || 'server_error'));
                else finish(null, data.data);
            }
            window.addEventListener('message', receive);
            document.body.append(frame, form);
            try { form.submit(); } catch (error) { finish(error); }
        });
    }
    async function previewAdmin(payload) {
        if (!['dahan', 'chiche'].includes(payload.family)) throw new Error('unauthorized');
        var saved = JSON.parse(localStorage.getItem('wedding-preview-guests') || '{}');
        if (payload.action === 'create') {
            if (Object.hasOwn(saved, payload.id) && saved[payload.id].family !== payload.family) throw new Error('forbidden');
            var guest = publicGuest(payload);
            guest.family = payload.family;
            saved[payload.id] = guest;
            localStorage.setItem('wedding-preview-guests', JSON.stringify(saved));
            return { ok: true, guest: publicGuest(guest) };
        }
        var guests = Object.values(saved).filter(function (guest) { return guest.family === payload.family; });
        var totals = {};
        ['mairie', 'houppa', 'shabbat'].forEach(function (name) {
            totals[name] = { invitedAdults: 0, invitedChildren: 0, adults: 0, children: 0, pending: 0, declined: 0 };
            guests.forEach(function (guest) {
                if (!guest[name]) return;
                totals[name].invitedAdults += guest.maxAdultes;
                totals[name].invitedChildren += guest.maxEnfants;
                var answer = guest.answers && guest.answers[name];
                if (!answer) { totals[name].pending++; return; }
                totals[name].adults += answer.adultes;
                totals[name].children += answer.enfants;
                if (answer.presence === 'non') totals[name].declined++;
            });
        });
        return { ok: true, family: payload.family, guests: guests, totals: totals, legacyResponses: false };
    }
    window.localPreview = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) &&
        new URLSearchParams(location.search).get('preview') === '1';
    window.sheetApi = {
        guest: function (id) {
            if (!window.localPreview) return read({ action: 'guest', id: id });
            var saved = JSON.parse(localStorage.getItem('wedding-preview-guests') || '{}');
            if (Object.hasOwn(saved, id)) return Promise.resolve(publicGuest(saved[id]));
            return fetch('guests.json', { cache: 'no-store' }).then(function (response) {
                if (!response.ok) throw new Error('preview_error');
                return response.json();
            }).then(function (guests) {
                if (!Object.hasOwn(guests, id)) throw new Error('not_found');
                return guests[id];
            });
        },
        dashboard: function (family, adminKey) { return adminRequest({ action: 'dashboard', family: family, adminKey: adminKey }); },
        create: async function (payload) {
            var result = await adminRequest(payload);
            return result.guest;
        },
        submit: async function (payload) {
            if (window.localPreview) throw new Error('preview_no_submit');
            // Une réponse opaque au POST ne prouve rien : lire ensuite le reçu.
            // Même si le POST échoue côté navigateur, le serveur peut avoir écrit.
            try {
                await fetch(endpoint, {
                    method: 'POST', mode: 'no-cors', credentials: 'omit',
                    signal: AbortSignal.timeout(20000),
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(payload)
                });
            } catch (_) { /* Vérifier le reçu avant de déclarer un échec. */ }
            for (var attempt = 0; attempt < 3; attempt++) {
                if (attempt) await new Promise(function (resolve) { setTimeout(resolve, 1500); });
                var status = await read({ action: 'status', id: payload.invite, requestId: payload.requestId });
                if (status && status.ok === true && status.saved === true && status.requestId === payload.requestId) return;
            }
            throw new Error('unconfirmed');
        }
    };
})();
