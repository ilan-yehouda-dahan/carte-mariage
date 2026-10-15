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
    window.localPreview = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) &&
        new URLSearchParams(location.search).get('preview') === '1';
    window.sheetApi = {
        guest: function (id) {
            if (!window.localPreview) return read({ action: 'guest', id: id });
            return fetch('guests.json', { cache: 'no-store' }).then(function (response) {
                if (!response.ok) throw new Error('preview_error');
                return response.json();
            }).then(function (guests) {
                if (!Object.hasOwn(guests, id)) throw new Error('not_found');
                return guests[id];
            });
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
