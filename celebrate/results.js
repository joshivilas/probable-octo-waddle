const CelebrationResults = (() => {
    function decodeNames(hash) {
        if (!hash || hash === '#') throw new Error('No names were found. Ask the sender for the full celebration link, including everything after #.');
        let names;
        try {
            names = JSON.parse(atob(decodeURIComponent(hash.replace(/^#/, ''))));
        } catch (error) {
            throw new Error('This link could not be read. It may have been cut off or changed. Ask the sender to copy the full link again.', { cause: error });
        }
        if (!Array.isArray(names) || !names.length || names.some(name => typeof name !== 'string' || !name.trim())) {
            throw new Error('This link does not contain a valid list of names. Ask the sender to create a new celebration.');
        }
        return names;
    }

    function createEffects({ canvas, audio, theme, onStatus, onActiveChange, environment = globalThis }) {
        const colors = {
            winners: ['#994b33', '#dfad58', '#598579', '#e79a81'],
            retro: ['#ccf1d5', '#d7b6ff', '#9ccaff', '#ffe8a3'],
            elegant: ['#e8ce9e', '#fff4db', '#7da7a5', '#c5d7d6']
        }[theme];
        let frame = null;
        let soundTimer = null;
        let soundActive = false;
        let soundRevision = 0;
        let context = null;
        let width = 0;
        let height = 0;
        const notify = () => onActiveChange(frame !== null || soundActive);

        function resize() {
            width = environment.innerWidth;
            height = environment.innerHeight;
            const scale = Math.min(environment.devicePixelRatio || 1, 2);
            canvas.width = Math.round(width * scale);
            canvas.height = Math.round(height * scale);
            if (context) context.setTransform(scale, 0, 0, scale, 0, 0);
        }

        function stopConfetti() {
            if (frame !== null) environment.cancelAnimationFrame(frame);
            frame = null;
            if (context) context.clearRect(0, 0, width, height);
            notify();
        }

        function stopSound() {
            soundRevision++;
            if (soundTimer !== null) environment.clearTimeout(soundTimer);
            soundTimer = null;
            soundActive = false;
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
            }
            notify();
        }

        function stop() {
            stopConfetti();
            stopSound();
        }

        function soundFailed(error) {
            stopSound();
            onStatus(`Sound could not play${error?.message ? `: ${error.message}` : '.'} Names are still visible. Check your browser's audio permissions or turn sound off.`);
        }

        function playSound() {
            if (!audio) return;
            soundActive = true;
            const revision = soundRevision;
            audio.volume = 0.5;
            try {
                const playback = audio.play();
                soundTimer = environment.setTimeout(stopSound, 7000);
                Promise.resolve(playback).catch(error => {
                    if (revision === soundRevision) soundFailed(error);
                });
            } catch (error) {
                soundFailed(error);
            }
        }

        function startConfetti() {
            context = canvas.getContext('2d');
            if (!context) {
                onStatus('Animated confetti is unavailable in this browser. The names can still be viewed.');
                return;
            }
            resize();
            const particles = Array.from({ length: theme === 'elegant' ? 60 : 90 }, () => ({
                x: Math.random() * width, y: -Math.random() * height,
                speed: 100 + Math.random() * 150, drift: (Math.random() - 0.5) * 70,
                size: 4 + Math.random() * 5, angle: Math.random() * Math.PI,
                spin: (Math.random() - 0.5) * 3, color: colors[Math.floor(Math.random() * colors.length)]
            }));
            const started = environment.performance.now();
            let previous = started;
            function draw(now) {
                if (now - started >= 5000) {
                    stopConfetti();
                    return;
                }
                const delta = Math.min((now - previous) / 1000, 0.05);
                previous = now;
                context.clearRect(0, 0, width, height);
                context.globalAlpha = Math.min(1, (5000 - (now - started)) / 800);
                for (const particle of particles) {
                    particle.y += particle.speed * delta;
                    particle.x += particle.drift * delta;
                    particle.angle += particle.spin * delta;
                    context.save();
                    context.translate(particle.x, particle.y);
                    context.rotate(theme === 'retro' ? 0 : particle.angle);
                    context.fillStyle = particle.color;
                    if (theme === 'winners') {
                        context.beginPath();
                        context.arc(0, 0, particle.size / 2, 0, Math.PI * 2);
                        context.fill();
                    } else {
                        context.fillRect(0, 0, particle.size, theme === 'retro' ? particle.size : particle.size / 2);
                    }
                    context.restore();
                }
                frame = environment.requestAnimationFrame(draw);
            }
            frame = environment.requestAnimationFrame(draw);
        }

        function start({ motion, sound }) {
            stop();
            onStatus('');
            if (motion) startConfetti();
            else onStatus('Motion effects are off to match your device preference.');
            if (sound) playSound();
            notify();
        }

        if (audio) {
            audio.addEventListener('ended', stopSound);
            audio.addEventListener('error', () => {
                if (soundActive) soundFailed(audio.error);
            });
        }
        return { start, stop, stopSound, stopConfetti, resize };
    }

    return { decodeNames, createEffects };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = CelebrationResults;

if (typeof document !== 'undefined') {
    const ui = Object.fromEntries([
        'main', 'skipToCelebration', 'content', 'loadingMessage', 'linkProblem', 'problemMessage',
        'recipientCount', 'revealHint', 'celebrationActions', 'celebrateBtn', 'stopEffectsBtn',
        'soundEnabled', 'cheerSound', 'confetti', 'effectStatus', 'resultStatus'
    ].map(id => [id, document.getElementById(id)]));
    const theme = document.body.dataset.celebration;
    const list = document.querySelector('[data-name-list]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const initialButtonText = ui.celebrateBtn.textContent;
    let names = [];
    let revealed = false;
    const effects = CelebrationResults.createEffects({
        canvas: ui.confetti, audio: ui.cheerSound, theme,
        onStatus: message => { ui.effectStatus.textContent = message; },
        onActiveChange: active => {
            if (!active && document.activeElement === ui.stopEffectsBtn) ui.celebrateBtn.focus({ preventScroll: true });
            ui.stopEffectsBtn.hidden = !active;
        }
    });

    function reveal() {
        if (revealed) return;
        const fragment = document.createDocumentFragment();
        for (const name of names) {
            const row = document.createElement('li');
            const symbol = document.createElement('span');
            symbol.className = 'name-symbol';
            symbol.setAttribute('aria-hidden', 'true');
            symbol.textContent = theme === 'retro' ? '+' : '\u2726';
            const text = document.createElement('span');
            text.className = 'recipient-name';
            text.textContent = name;
            row.append(symbol, text);
            fragment.append(row);
        }
        list.replaceChildren(fragment);
        ui.recipientCount.textContent = `${names.length} ${names.length === 1 ? 'name' : 'names'}`;
        ui.content.hidden = false;
        if (ui.revealHint) ui.revealHint.hidden = true;
        ui.celebrateBtn.textContent = theme === 'retro' ? 'Play again' : 'Celebrate again';
        ui.resultStatus.textContent = `${names.length} ${names.length === 1 ? 'name' : 'names'} revealed.`;
        revealed = true;
    }

    function loadLink() {
        effects.stop();
        names = [];
        revealed = false;
        list.replaceChildren();
        ui.loadingMessage.hidden = true;
        ui.content.hidden = true;
        ui.celebrationActions.hidden = true;
        ui.linkProblem.hidden = true;
        ui.effectStatus.textContent = '';
        ui.resultStatus.textContent = '';
        ui.celebrateBtn.textContent = initialButtonText;
        if (ui.revealHint) ui.revealHint.hidden = true;
        try {
            names = CelebrationResults.decodeNames(location.hash);
        } catch (error) {
            ui.problemMessage.textContent = error.message;
            ui.linkProblem.hidden = false;
            ui.resultStatus.textContent = error.message;
            return;
        }
        ui.celebrationActions.hidden = false;
        if (theme === 'winners') {
            reveal();
            if (!document.hidden) effects.start({ motion: !reducedMotion.matches, sound: false });
        } else {
            ui.revealHint.hidden = false;
        }
    }

    ui.celebrateBtn.addEventListener('click', () => {
        reveal();
        effects.start({ motion: !reducedMotion.matches, sound: Boolean(ui.soundEnabled?.checked) });
    });
    ui.stopEffectsBtn.addEventListener('click', () => {
        effects.stop();
        ui.effectStatus.textContent = 'Effects stopped. The celebration stays here.';
    });
    ui.soundEnabled?.addEventListener('change', () => {
        if (!ui.soundEnabled.checked) {
            effects.stopSound();
            ui.effectStatus.textContent = 'Sound is off.';
        } else {
            ui.effectStatus.textContent = 'Sound will play the next time you celebrate.';
        }
    });
    ui.skipToCelebration.addEventListener('click', () => ui.main.focus());
    ui.skipToCelebration.disabled = false;
    reducedMotion.addEventListener('change', event => {
        if (event.matches) {
            effects.stopConfetti();
            if (revealed) ui.effectStatus.textContent = 'Motion effects are off to match your device preference.';
        }
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) effects.stop();
    });
    window.addEventListener('pagehide', effects.stop);
    window.addEventListener('resize', effects.resize);
    window.addEventListener('hashchange', loadLink);
    loadLink();
}
