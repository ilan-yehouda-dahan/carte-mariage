/* =============================================================================
   Enveloppe de Mariage — Logique de l'Animation (Standalone)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    const screen = document.getElementById('envelope');
    const wrap   = document.getElementById('cenv-wrap');
    const seal   = document.getElementById('env-seal');
    const flap   = document.getElementById('cenv-flap');
    const card   = document.getElementById('cenv-card');
    const replay = document.getElementById('btn-replay');

    let sequenceStarted = false;
    let timers = [];

    const clearTimers = () => {
        timers.forEach(clearTimeout);
        timers = [];
    };

    /* --- Séquence d'ouverture complète ------------------------------------ */
    const openEnvelope = () => {
        if (sequenceStarted) return;
        sequenceStarted = true;

        screen.classList.add('cenv-opened');

        // 1. Le sceau s'enfonce brièvement puis saute (pop)
        seal.classList.add('cenv-press');
        timers.push(setTimeout(() => {
            seal.classList.remove('cenv-press');
            seal.classList.add('cenv-pop');
        }, 120));

        // 2. Le rabat supérieur pivote en 3D (départ 250ms, durée 700ms)
        timers.push(setTimeout(() => {
            flap.classList.add('cenv-open');
            // À mi-course de la rotation, il passe derrière la carte
            timers.push(setTimeout(() => flap.classList.add('cenv-behind'), 340));
        }, 250));

        // 3. La carte-invitation glisse hors de la pochette
        timers.push(setTimeout(() => {
            card.classList.add('cenv-sliding');
        }, 650));

        // 4. La carte grandit, s'installe au centre et devient bien lisible
        timers.push(setTimeout(() => {
            card.classList.add('cenv-grow');
        }, 1050));

        // 5. L'enveloppe vide s'incline et s'efface délicatement vers le bas
        timers.push(setTimeout(() => {
            wrap.classList.add('cenv-away');
        }, 1350));
    };

    /* --- Rejouer l'animation depuis le début ------------------------------ */
    const replayEnvelope = () => {
        clearTimers();
        sequenceStarted = false;

        // Réinitialise toutes les classes d'animation
        screen.classList.remove('cenv-opened');
        wrap.classList.remove('cenv-away');
        card.classList.remove('cenv-sliding', 'cenv-grow');
        flap.classList.remove('cenv-open', 'cenv-behind');
        seal.classList.remove('cenv-press', 'cenv-pop');
    };

    // Événements d'ouverture
    seal.addEventListener('click', (e) => {
        e.stopPropagation();
        openEnvelope();
    });

    wrap.addEventListener('click', () => {
        openEnvelope();
    });

    wrap.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openEnvelope();
        }
    });

    // Événement pour rejouer
    if (replay) {
        replay.addEventListener('click', (e) => {
            e.stopPropagation();
            replayEnvelope();
        });
    }

    // Touche Échap pour rejouer / réinitialiser
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sequenceStarted) {
            replayEnvelope();
        }
    });
});
