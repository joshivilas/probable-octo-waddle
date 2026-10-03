(() => {
    const ids = [
        'bpmDisplay', 'bpmUnit', 'tempoInput', 'tempoSlider', 'tempoError', 'decreaseBtn', 'increaseBtn',
        'tapBtn', 'tapStatus', 'startStopBtn', 'resetBtn', 'beatIndicators', 'beatPosition', 'playStatus',
        'elapsed', 'sessionProgress', 'sessionSummary', 'appError', 'rhythmSettings', 'practiceSettings',
        'meter', 'subdivision', 'accent', 'sound', 'volume', 'volumeValue', 'countInBars', 'durationSeconds',
        'trainerEnabled', 'trainerStep', 'trainerBars', 'trainerTarget', 'trainerFields', 'meterHint',
        'keepAwake', 'wakeStatus', 'presetName', 'presetSelect', 'savePreset', 'loadPreset', 'deletePreset',
        'clearPresets', 'presetStatus', 'shareBtn', 'shareStatus', 'shareLink', 'shareFallback'
    ];
    const ui = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
    const showError = message => {
        ui.appError.textContent = message;
        ui.appError.hidden = !message;
    };
    if (typeof MetronomeCore === 'undefined' || typeof MetronomeSettings === 'undefined') {
        showError('The metronome could not load its scripts. Reload the page or check whether browser extensions blocked them.');
        return;
    }
    const core = MetronomeCore;
    const settings = MetronomeSettings;
    let config = { ...core.DEFAULTS };
    let context = null;
    let engine = null;
    let starting = false;
    let countingIn = false;
    let startGeneration = 0;
    let clockId = null;
    let wakeLock = null;
    let wakeGeneration = 0;
    let presets = [];
    let storageReady = true;
    const tapper = new settings.TapTempo();
    const numericFields = {
        bpm: 'tempoInput', countInBars: 'countInBars', durationSeconds: 'durationSeconds',
        trainerStep: 'trainerStep', trainerBars: 'trainerBars', trainerTarget: 'trainerTarget', volume: 'volume'
    };
    const running = () => !!engine?.running;
    const busy = () => starting || running();
    const reason = error => error instanceof Error ? error.message : String(error);
    const timeLabel = seconds => {
        const total = Math.max(0, Math.floor(seconds));
        return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    };

    function clearSharedLink() {
        ui.shareFallback.hidden = true;
        ui.shareLink.value = '';
        ui.shareStatus.textContent = 'Links share settings, not preset names or practice history. Opening a link never starts audio.';
    }

    function readConfig() {
        const next = { ...config };
        for (const [key, id] of Object.entries(numericFields)) {
            const input = ui[id];
            input.removeAttribute('aria-invalid');
            if (!input.value.trim() || !input.checkValidity()) {
                input.setAttribute('aria-invalid', 'true');
                throw new Error(`${key === 'bpm' ? 'BPM' : input.closest('label')?.childNodes[0].textContent.trim() || key}: enter a whole number within the displayed limits.`);
            }
            next[key] = Number(input.value);
        }
        next.meter = ui.meter.value;
        next.subdivision = Number(ui.subdivision.value);
        next.sound = ui.sound.value;
        next.accent = ui.accent.checked;
        next.trainerEnabled = ui.trainerEnabled.checked;
        if (next.trainerEnabled && next.trainerTarget < next.bpm) {
            ui.trainerTarget.setAttribute('aria-invalid', 'true');
            throw new Error('Trainer target must be at least the starting BPM. Lower Set BPM or raise the target.');
        }
        return core.validateConfig(next);
    }

    function rebuildSubdivisions(value = 1) {
        const options = ui.meter.value === '6/8'
            ? [[1, 'Main dotted beats'], [3, 'Eighth notes (3 per beat)'], [6, 'Sixteenth notes (6 per beat)']]
            : [[1, 'Main beats'], [2, 'Eighth notes'], [3, 'Triplets'], [4, 'Sixteenth notes']];
        ui.subdivision.replaceChildren(...options.map(([id, label]) => new Option(label, String(id))));
        ui.subdivision.value = String(value);
    }

    function renderBeats() {
        const meter = core.getMeter(config.meter);
        ui.beatIndicators.replaceChildren(...Array.from({ length: meter.beats }, (_, index) => {
            const item = document.createElement('li');
            item.textContent = String(index + 1);
            if (config.accent && index === 0) item.classList.add('downbeat');
            item.setAttribute('aria-label', `Beat ${index + 1}${config.accent && index === 0 ? ', accented' : ''}`);
            return item;
        }));
        ui.bpmUnit.textContent = `BPM / ${meter.unit}`;
        ui.meterHint.textContent = config.meter === '6/8'
            ? 'Two dotted-quarter beats per bar. Eighth notes divide each numbered beat into three.'
            : 'Each numbered beat is a quarter note.';
    }

    function renderSummary() {
        const subdivision = ui.subdivision.selectedOptions[0]?.textContent || 'Main beats';
        const timer = config.durationSeconds ? `${timeLabel(config.durationSeconds)} timer` : 'No time limit';
        ui.sessionSummary.textContent = `${config.meter} · ${subdivision} · ${timer}${config.trainerEnabled ? ` · Trainer up to ${config.trainerTarget} BPM` : ''}`;
        ui.sessionProgress.hidden = !config.durationSeconds;
        ui.sessionProgress.max = config.durationSeconds || 1;
        ui.trainerFields.hidden = !ui.trainerEnabled.checked;
        ui.volumeValue.textContent = config.volume ? `${config.volume}%` : 'Muted';
    }

    function updateControls() {
        const active = busy();
        const lockTempo = starting || (running() && config.trainerEnabled);
        ui.rhythmSettings.disabled = active;
        ui.practiceSettings.disabled = active;
        ui.tempoInput.disabled = lockTempo;
        ui.tempoSlider.disabled = lockTempo;
        ui.tapBtn.disabled = lockTempo;
        ui.decreaseBtn.disabled = lockTempo || config.bpm <= 30;
        ui.increaseBtn.disabled = lockTempo || config.bpm >= 240;
        ui.startStopBtn.disabled = false;
        ui.startStopBtn.textContent = starting ? 'Cancel' : running() ? 'Stop' : 'Start';
        ui.startStopBtn.classList.toggle('running', active);
        ui.resetBtn.disabled = false;
        ui.loadPreset.disabled = active || !storageReady || ui.presetSelect.value === '';
        ui.deletePreset.disabled = !storageReady || ui.presetSelect.value === '';
        ui.savePreset.disabled = !storageReady;
        ui.presetSelect.disabled = active || !storageReady || !presets.length;
    }

    function renderConfig() {
        ui.meter.value = config.meter;
        rebuildSubdivisions(config.subdivision);
        for (const [key, id] of Object.entries(numericFields)) {
            ui[id].value = String(config[key]);
            ui[id].removeAttribute('aria-invalid');
        }
        ui.accent.checked = config.accent;
        ui.sound.value = config.sound;
        ui.trainerEnabled.checked = config.trainerEnabled;
        ui.tempoSlider.value = String(config.bpm);
        ui.bpmDisplay.textContent = String(config.bpm);
        ui.tempoError.textContent = '';
        renderBeats();
        renderSummary();
        updateControls();
    }

    function applyDraft() {
        try {
            const next = readConfig();
            if (running() && next.bpm !== config.bpm) engine.setBpm(next.bpm);
            if (JSON.stringify(next) !== JSON.stringify(config)) clearSharedLink();
            config = next;
            ui.tempoSlider.value = String(config.bpm);
            if (!running() || (!config.trainerEnabled && !countingIn)) ui.bpmDisplay.textContent = String(config.bpm);
            ui.tempoError.textContent = '';
            showError('');
            if (!running()) renderBeats();
            renderSummary();
            updateControls();
            return true;
        } catch (error) {
            showError(reason(error));
            return false;
        }
    }

    function updateTempo(value) {
        if (ui.tempoInput.disabled) return;
        ui.tempoInput.value = String(value);
        applyDraft();
    }

    function updateClock() {
        const elapsed = engine ? engine.elapsed : 0;
        ui.elapsed.textContent = timeLabel(elapsed);
        ui.sessionProgress.value = Math.min(elapsed, config.durationSeconds || 1);
    }

    async function releaseWakeLock() {
        wakeGeneration++;
        const previous = wakeLock;
        wakeLock = null;
        if (previous && !previous.released) {
            try {
                await previous.release();
            } catch (error) {
                ui.wakeStatus.textContent = `Could not release screen wake lock: ${reason(error)}. Your browser also releases it when this page closes.`;
            }
        }
    }

    async function acquireWakeLock() {
        if (!ui.keepAwake.checked || !busy() || document.visibilityState !== 'visible' || wakeLock) return;
        const generation = ++wakeGeneration;
        try {
            const lock = await navigator.wakeLock.request('screen');
            if (generation !== wakeGeneration || !busy() || !ui.keepAwake.checked || document.visibilityState !== 'visible') {
                await lock.release();
                return;
            }
            wakeLock = lock;
            ui.wakeStatus.textContent = 'Screen wake lock is active while this page stays visible.';
            lock.addEventListener('release', () => {
                if (wakeLock !== lock) return;
                wakeLock = null;
                ui.wakeStatus.textContent = 'The browser released screen wake lock. Keep this tab visible; battery settings may prevent it.';
            });
        } catch (error) {
            if (generation === wakeGeneration) {
                ui.wakeStatus.textContent = `Screen wake lock is unavailable: ${reason(error)}. Keep the device awake manually.`;
            }
        }
    }

    function finish(message) {
        startGeneration++;
        starting = false;
        countingIn = false;
        engine?.stop();
        if (clockId !== null) clearInterval(clockId);
        clockId = null;
        updateClock();
        ui.playStatus.textContent = message;
        ui.beatPosition.textContent = 'Ready for the first beat';
        ui.bpmDisplay.textContent = String(config.bpm);
        [...ui.beatIndicators.children].forEach(item => item.classList.remove('current'));
        tapper.reset();
        ui.tapStatus.textContent = 'Tap at least twice at the main beat, not the subdivision.';
        releaseWakeLock();
        if (!ui.keepAwake.disabled) ui.wakeStatus.textContent = ui.keepAwake.checked ? 'Screen wake lock will be requested on the next Start.' : 'Screen wake lock is off.';
        updateControls();
    }

    function onBeat(event) {
        if (!running()) return;
        countingIn = event.countIn;
        [...ui.beatIndicators.children].forEach((item, index) => item.classList.toggle('current', index === event.beatIndex));
        ui.bpmDisplay.textContent = String(event.bpm);
        ui.beatPosition.textContent = `${event.countIn ? 'Count-in' : `Bar ${event.bar}`} · Beat ${event.beatIndex + 1} of ${event.beats}${config.subdivision > 1 ? ` · Part ${event.subdivisionIndex + 1}/${config.subdivision}` : ''}`;
        // Announce state transitions, not every beat or subdivision.
        const status = event.countIn ? `Count-in ${event.countInBar}/${config.countInBars}` : config.trainerEnabled ? 'Playing · Tempo trainer' : 'Playing';
        if (ui.playStatus.textContent !== status) ui.playStatus.textContent = status;
    }

    async function start() {
        if (busy()) {
            finish('Stopped');
            return;
        }
        if (!applyDraft()) return;
        const generation = ++startGeneration;
        starting = true;
        ui.playStatus.textContent = 'Preparing audio';
        updateControls();
        try {
            const Audio = window.AudioContext || window.webkitAudioContext;
            if (!Audio) throw new Error('Web Audio is not supported by this browser. Try a current browser with audio support.');
            if (!context || context.state === 'closed') {
                context = new Audio();
                context.addEventListener('statechange', () => {
                    if (running() && context.state !== 'running') {
                        finish('Audio interrupted');
                        showError('Audio was interrupted by the browser or device. Return to this tab and press Start to begin again.');
                    }
                });
            }
            await context.resume();
            if (generation !== startGeneration) return;
            if (context.state !== 'running') throw new Error('The browser could not start audio. Check the tab audio permissions and try Start again.');
            engine = new core.Engine(context, {
                onBeat,
                onFinish: () => finish('Session complete'),
                onError: error => {
                    finish('Playback stopped');
                    showError(`Playback stopped. ${reason(error)} Keep the tab visible, then press Start to retry.`);
                }
            });
            countingIn = config.countInBars > 0;
            engine.start(config);
            starting = false;
            tapper.reset();
            ui.tapStatus.textContent = config.trainerEnabled ? 'Tempo is controlled by the trainer until stopped.' : 'Tap at least twice at the main beat.';
            ui.playStatus.textContent = config.countInBars ? 'Count-in' : 'Playing';
            updateClock();
            clockId = setInterval(updateClock, 100);
            updateControls();
            acquireWakeLock();
        } catch (error) {
            if (generation !== startGeneration) return;
            finish('Unable to start');
            showError(reason(error));
        }
    }

    function tapTempo() {
        if (ui.tapBtn.disabled) return;
        try {
            const tap = tapper.tap(performance.now());
            if (tap.bpm !== null) {
                updateTempo(tap.bpm);
                ui.tapStatus.textContent = `${tap.bpm} BPM from ${tap.count} taps.`;
            } else {
                ui.tapStatus.textContent = 'First tap received. Tap again at the next beat.';
            }
        } catch (error) {
            ui.tapStatus.textContent = reason(error);
        }
    }

    function renderPresets(selected = '') {
        const placeholder = new Option(presets.length ? 'Choose a preset' : 'No saved presets', '');
        ui.presetSelect.replaceChildren(placeholder, ...presets.map((item, index) => new Option(item.name, String(index))));
        ui.presetSelect.value = selected;
        updateControls();
    }

    function loadStoredPresets() {
        try {
            presets = settings.decodePresets(localStorage.getItem(settings.STORAGE_KEY));
            storageReady = true;
            ui.clearPresets.hidden = true;
            ui.presetStatus.textContent = `${presets.length} saved preset${presets.length === 1 ? '' : 's'} on this device.`;
        } catch (error) {
            storageReady = false;
            ui.clearPresets.hidden = false;
            ui.presetStatus.textContent = `Saved presets unavailable: ${reason(error)}. Playback and sharing still work.`;
        }
        renderPresets();
    }

    function savePreset() {
        if (!storageReady || !applyDraft()) return;
        try {
            const name = settings.presetName(ui.presetName.value);
            if (presets.some(item => item.name.toLowerCase() === name.toLowerCase())) {
                throw new Error('That name already exists. Use another name, or delete the old preset first.');
            }
            const next = [...presets, { name, config: { ...config } }];
            localStorage.setItem(settings.STORAGE_KEY, settings.encodePresets(next));
            presets = next;
            renderPresets(String(presets.length - 1));
            ui.presetStatus.textContent = `Saved "${name}" in this browser.`;
        } catch (error) {
            ui.presetStatus.textContent = `Preset not saved: ${reason(error)}`;
        }
    }

    async function share() {
        if (!applyDraft()) return;
        const url = new URL(location.href);
        url.hash = settings.toHash(config);
        ui.shareLink.value = url.href;
        ui.shareFallback.hidden = true;
        try {
            if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is not available in this browser.');
            await navigator.clipboard.writeText(url.href);
            ui.shareStatus.textContent = 'Settings link copied. The recipient must press Start to play.';
        } catch (error) {
            ui.shareFallback.hidden = false;
            ui.shareLink.focus();
            ui.shareLink.select();
            ui.shareStatus.textContent = `Could not copy automatically: ${reason(error)} Copy the selected link manually.`;
        }
    }

    function applyLink() {
        try {
            const shared = settings.fromHash(location.hash);
            if (!shared) return;
            if (busy()) finish('Stopped to load shared settings');
            config = shared;
            clearSharedLink();
            renderConfig();
            showError('');
            ui.playStatus.textContent = 'Shared settings loaded';
        } catch (error) {
            showError(`Settings link not loaded: ${reason(error)} Current settings are unchanged.`);
        }
    }

    ui.startStopBtn.addEventListener('click', start);
    ui.resetBtn.addEventListener('click', () => {
        finish('Ready');
        config = { ...core.DEFAULTS };
        clearSharedLink();
        ui.keepAwake.checked = false;
        ui.elapsed.textContent = '00:00';
        ui.sessionProgress.value = 0;
        ui.wakeStatus.textContent = ui.keepAwake.disabled ? 'Screen wake lock is not supported here. Keep the device awake manually.' : 'Screen wake lock is off.';
        renderConfig();
        showError('');
    });
    ui.decreaseBtn.addEventListener('click', () => updateTempo(Math.max(30, config.bpm - 1)));
    ui.increaseBtn.addEventListener('click', () => updateTempo(Math.min(240, config.bpm + 1)));
    ui.tempoSlider.addEventListener('input', () => updateTempo(Number(ui.tempoSlider.value)));
    ui.tempoInput.addEventListener('change', applyDraft);
    ui.tempoInput.addEventListener('input', () => {
        const valid = ui.tempoInput.value !== '' && ui.tempoInput.checkValidity();
        ui.tempoInput.setAttribute('aria-invalid', String(!valid));
        ui.tempoError.textContent = valid ? '' : 'Enter a whole number from 30 to 240. Playback keeps the last valid tempo.';
    });
    ui.tapBtn.addEventListener('click', tapTempo);
    ui.meter.addEventListener('change', () => {
        rebuildSubdivisions();
        applyDraft();
    });
    ['subdivision', 'accent', 'countInBars', 'durationSeconds', 'trainerEnabled', 'trainerStep', 'trainerBars', 'trainerTarget'].forEach(id => {
        ui[id].addEventListener('change', () => {
            ui.trainerFields.hidden = !ui.trainerEnabled.checked;
            applyDraft();
        });
    });
    ui.volume.addEventListener('input', () => {
        const volume = Number(ui.volume.value);
        try {
            if (running()) engine.setVolume(volume);
            clearSharedLink();
            config.volume = volume;
            ui.volumeValue.textContent = volume ? `${volume}%` : 'Muted';
        } catch (error) {
            showError(`Volume could not change: ${reason(error)}`);
        }
    });
    ui.sound.addEventListener('change', () => {
        try {
            if (running()) engine.setSound(ui.sound.value);
            clearSharedLink();
            config.sound = ui.sound.value;
        } catch (error) {
            showError(`Sound could not change: ${reason(error)}`);
        }
    });
    ui.keepAwake.addEventListener('change', () => {
        if (ui.keepAwake.checked) {
            ui.wakeStatus.textContent = busy() ? 'Requesting screen wake lock...' : 'Screen wake lock will be requested on Start.';
            acquireWakeLock();
        } else {
            releaseWakeLock();
            ui.wakeStatus.textContent = 'Screen wake lock is off.';
        }
    });
    if (!navigator.wakeLock?.request || !window.isSecureContext) {
        ui.keepAwake.disabled = true;
        ui.wakeStatus.textContent = 'Screen wake lock is not supported here. Keep the device awake manually.';
    }
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') acquireWakeLock();
    });
    window.addEventListener('pagehide', () => finish('Stopped'));
    window.addEventListener('hashchange', applyLink);
    window.addEventListener('storage', event => {
        if (event.key === settings.STORAGE_KEY || event.key === null) loadStoredPresets();
    });
    document.addEventListener('keydown', event => {
        if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.target instanceof Element && event.target.closest('input, select, textarea, button, summary, a, .controls-panel, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
        const key = event.key.toLowerCase();
        if (event.code === 'Space') {
            event.preventDefault();
            start();
        } else if (key === 't') {
            event.preventDefault();
            tapTempo();
        } else if (['arrowup', 'arrowright', 'arrowdown', 'arrowleft'].includes(key)) {
            event.preventDefault();
            const delta = (key === 'arrowup' || key === 'arrowright' ? 1 : -1) * (event.shiftKey ? 5 : 1);
            updateTempo(Math.max(30, Math.min(240, config.bpm + delta)));
        }
    });
    ui.savePreset.addEventListener('click', savePreset);
    ui.presetSelect.addEventListener('change', updateControls);
    ui.loadPreset.addEventListener('click', () => {
        if (busy() || ui.presetSelect.value === '') return;
        const preset = presets[Number(ui.presetSelect.value)];
        config = { ...preset.config };
        clearSharedLink();
        renderConfig();
        showError('');
        ui.playStatus.textContent = 'Preset loaded';
        ui.presetStatus.textContent = `Loaded "${preset.name}". Press Start when ready.`;
    });
    ui.deletePreset.addEventListener('click', () => {
        if (ui.presetSelect.value === '') return;
        const index = Number(ui.presetSelect.value);
        try {
            const next = presets.filter((_, position) => position !== index);
            localStorage.setItem(settings.STORAGE_KEY, settings.encodePresets(next));
            const name = presets[index].name;
            presets = next;
            renderPresets();
            ui.presetStatus.textContent = `Deleted "${name}".`;
        } catch (error) {
            ui.presetStatus.textContent = `Could not delete preset: ${reason(error)}`;
        }
    });
    ui.clearPresets.addEventListener('click', () => {
        if (!window.confirm('Remove all saved metronome presets from this browser? This cannot be undone.')) return;
        try {
            localStorage.removeItem(settings.STORAGE_KEY);
            loadStoredPresets();
        } catch (error) {
            ui.presetStatus.textContent = `Could not clear saved presets: ${reason(error)}`;
        }
    });
    ui.shareBtn.addEventListener('click', share);
    renderConfig();
    loadStoredPresets();
    applyLink();
    if (window.lucide) window.lucide.createIcons();
})();
