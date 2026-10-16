(function () {
    'use strict';
    var audio = document.getElementById('wedding-music');
    var button = document.getElementById('music-toggle');
    var status = document.getElementById('music-status');
    audio.volume = 0.45;
    function update() {
        var playing = !audio.paused && !audio.ended;
        button.textContent = playing ? '♫ Pause' : '♫ Musique';
        button.setAttribute('aria-label', playing ? 'Mettre la musique en pause' : 'Écouter la musique');
        button.setAttribute('aria-pressed', String(playing));
    }
    function play() {
        status.textContent = '';
        // Appel direct pendant le clic : nécessaire sur les navigateurs mobiles.
        audio.play().catch(function () {
            update();
            status.textContent = 'La musique n’a pas démarré. Touchez Musique pour réessayer.';
        });
    }
    button.addEventListener('click', function () { if (audio.paused) play(); else audio.pause(); });
    document.getElementById('btn-enter').addEventListener('click', play);
    document.querySelector('.cover-enter').addEventListener('click', play);
    audio.addEventListener('play', update);
    audio.addEventListener('pause', update);
    audio.addEventListener('error', function () {
        update();
        status.textContent = 'Musique indisponible pour le moment. Vous pouvez continuer votre invitation.';
    });
    update();
})();
