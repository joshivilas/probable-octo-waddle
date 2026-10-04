(() => {
  'use strict';

  const ADVANCE_DELAY_MS = 700;
  const FLASH_MS = 450;
  const REVEAL_MS = 1200;
  const $ = id => document.getElementById(id);
  const els = {
    deviceStatus: $('deviceStatus'), deviceText: $('deviceText'), connectBtn: $('connectBtn'), deviceList: $('deviceList'), fileNotice: $('fileNotice'),
    noteFace: $('noteFace'), noteVisual: $('noteVisual'), noteSpoken: $('noteSpoken'), resultBadge: $('resultBadge'), noteHint: $('noteHint'),
    notePanel: document.querySelector('.note-panel'), soundCues: $('soundCues'),
    feedback: $('feedback'), announcer: $('announcer'), lastPlayed: $('lastPlayed'), piano: $('piano'),
    startBtn: $('startBtn'), skipBtn: $('skipBtn'),
    statCorrect: $('statCorrect'), statAccuracy: $('statAccuracy'), statStreak: $('statStreak'), statTime: $('statTime'), statBest: $('statBest'),
    settings: $('exerciseSettings'), noteSet: $('noteSet'), spelling: $('spelling'), roundLength: $('roundLength'), settingsHint: $('settingsHint'),
    appError: $('appError'),
  };

  if (typeof PianoNotes === 'undefined') {
    els.appError.textContent = 'The note trainer could not load. Refresh the page to try again.';
    els.appError.hidden = false;
    return;
  }

  const { Session, keyName, spokenName, midiNoteName, parseMidiMessage, validateSettings } = PianoNotes;
  const STORAGE_KEY = 'pow.pianoNotes.settings.v1';
  const keys = new Map([...els.piano.querySelectorAll('.key')].map(key => [Number(key.dataset.pc), key]));
  const flashTimers = new Map();
  let session = null;
  let advanceTimer = 0;
  let badgeTimer = 0;
  let midiAccess = null;
  let audioContext = null;

  const now = () => performance.now();
  const running = () => Boolean(session) && (session.state === 'prompting' || session.state === 'advancing');

  function setText(element, visual, spoken = spokenName(visual)) {
    element.replaceChildren();
    const shown = document.createElement('span');
    shown.setAttribute('aria-hidden', 'true');
    shown.textContent = visual;
    const read = document.createElement('span');
    read.className = 'sr-only';
    read.textContent = spoken;
    element.append(shown, read);
  }

  function setFeedback(visual, tone = 'neutral', spoken) {
    setText(els.feedback, visual, spoken);
    els.feedback.dataset.tone = tone;
  }

  function showNote(visual, spoken, result = '') {
    els.noteVisual.textContent = visual;
    els.noteSpoken.textContent = spoken;
    if (result) els.noteFace.dataset.result = result;
    else delete els.noteFace.dataset.result;
  }

  function flash(pc, className, duration = FLASH_MS) {
    const key = keys.get(pc);
    if (!key) return;
    clearTimeout(flashTimers.get(key));
    key.classList.remove('played', 'correct', 'wrong', 'reveal');
    void key.offsetWidth;
    key.classList.add(className);
    flashTimers.set(key, setTimeout(() => key.classList.remove(className), duration));
  }

  function clearFlashes() {
    keys.forEach(key => {
      clearTimeout(flashTimers.get(key));
      key.classList.remove('played', 'correct', 'wrong', 'reveal');
    });
  }

  /* Audio may only start after a user gesture, so this runs from Start and the sound toggle. */
  function unlockAudio() {
    if (!els.soundCues.checked || typeof PianoCues === 'undefined') return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      if (!audioContext) audioContext = new AudioContextClass();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    } catch {
      audioContext = null;
    }
  }

  function playCue(name) {
    if (!els.soundCues.checked || !audioContext) return;
    try {
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      PianoCues.playCue(audioContext, name);
    } catch {
      /* A failed cue must never interrupt the exercise. */
    }
  }

  function showResult(result) {
    clearTimeout(badgeTimer);
    const badge = els.resultBadge;
    badge.hidden = true;
    els.notePanel.classList.remove('flash-correct', 'flash-wrong');
    if (!result) return;
    void els.notePanel.offsetWidth;
    badge.dataset.result = result;
    badge.textContent = result === 'correct' ? '✓' : '✗';
    badge.hidden = false;
    els.notePanel.classList.add(`flash-${result}`);
    if (result === 'wrong') badgeTimer = setTimeout(() => { badge.hidden = true; }, 900);
  }

  function formatSeconds(ms) {
    return ms === null ? '–' : `${(ms / 1000).toFixed(1)}s`;
  }

  function renderStats() {
    const stats = session ? session.stats() : null;
    if (!stats) {
      els.statCorrect.textContent = '0';
      els.statAccuracy.textContent = '–';
      els.statStreak.textContent = '0';
      els.statTime.textContent = '–';
      els.statBest.textContent = 'Best streak: 0';
      return;
    }
    els.statCorrect.textContent = stats.roundLength ? `${stats.correct}/${stats.roundLength}` : String(stats.correct);
    els.statAccuracy.textContent = stats.accuracy === null ? '–' : `${Math.round(stats.accuracy * 100)}%`;
    els.statStreak.textContent = String(stats.streak);
    els.statTime.textContent = formatSeconds(stats.averageMs);
    const progress = stats.roundLength ? ` · Note ${Math.min(stats.completed + 1, stats.roundLength)} of ${stats.roundLength}` : '';
    const skipped = stats.skipped ? ` · Skipped: ${stats.skipped}` : '';
    els.statBest.textContent = `Best streak: ${stats.bestStreak}${skipped}${running() ? progress : ''}`;
  }

  function renderControls() {
    const active = running();
    els.startBtn.textContent = active ? 'Stop' : session && session.state === 'finished' ? 'Start again' : 'Start';
    els.startBtn.classList.toggle('running', active);
    els.skipBtn.disabled = !session || session.state !== 'prompting';
    els.settings.disabled = active;
    els.spelling.disabled = active || els.noteSet.value !== 'all';
  }

  function readSettings() {
    return { noteSet: els.noteSet.value, spelling: els.spelling.value, roundLength: Number(els.roundLength.value) };
  }

  /* Restores each saved choice independently so one bad value cannot discard the rest. */
  function loadSettings() {
    let saved;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch {
      return;
    }
    if (!saved || typeof saved !== 'object') return;
    const fields = [['noteSet', els.noteSet], ['spelling', els.spelling], ['roundLength', els.roundLength]];
    fields.forEach(([field, select]) => {
      try {
        validateSettings({ [field]: saved[field] });
        select.value = String(saved[field]);
      } catch {
        /* Keep the default for invalid or missing values. */
      }
    });
    if (typeof saved.soundCues === 'boolean') els.soundCues.checked = saved.soundCues;
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readSettings(), soundCues: els.soundCues.checked }));
    } catch {
      /* Storage can be unavailable (private mode, file pages); settings still work for this visit. */
    }
  }

  function describeNoteSet() {
    if (els.noteSet.value !== 'all') return 'White keys · 7 notes · Any octave';
    const names = { sharps: 'Sharps', flats: 'Flats', mixed: 'Sharps & flats' };
    return `All 12 notes · ${names[els.spelling.value]} · Any octave`;
  }

  function syncSettingsUi() {
    const description = describeNoteSet();
    setText(els.noteHint, description, description.replace(/ · /g, ', ').replace(/&/g, 'and'));
    els.settingsHint.textContent = els.noteSet.value === 'all'
      ? 'All 12 notes include the black keys. Choose how they are named.'
      : 'Start with the seven white keys. Add black keys once C to B feels easy.';
    renderControls();
  }

  function presentPrompt(prompt) {
    showResult(null);
    showNote(prompt.name, prompt.spoken);
    els.announcer.textContent = `Play ${prompt.spoken}.`;
  }

  function start() {
    clearTimeout(advanceTimer);
    clearFlashes();
    session = new Session(readSettings());
    presentPrompt(session.start(now()));
    setFeedback('Find this note on your keyboard.');
    renderStats();
    renderControls();
  }

  function stop() {
    clearTimeout(advanceTimer);
    showResult(null);
    if (session) session.stop();
    showNote('–', 'No note yet');
    els.announcer.textContent = '';
    setFeedback('Stopped. Press Start for a new round.');
    renderStats();
    renderControls();
  }

  function finish() {
    const stats = session.stats();
    const accuracy = stats.accuracy === null ? '' : ` · ${Math.round(stats.accuracy * 100)}% accuracy`;
    const time = stats.averageMs === null ? '' : ` · ${formatSeconds(stats.averageMs)} average`;
    showNote('✓', 'Round complete', 'done');
    showResult(null);
    els.announcer.textContent = '';
    setFeedback(`Round complete! ${stats.correct} found, ${stats.firstTry} on the first try${accuracy}${time}.`, 'done');
    renderStats();
    renderControls();
    els.startBtn.focus({ preventScroll: true });
  }

  function advance() {
    const prompt = session.next(now());
    clearFlashes();
    if (!prompt) {
      finish();
      return;
    }
    presentPrompt(prompt);
    renderStats();
    renderControls();
  }

  function handleNote(midiNote, source) {
    const pc = midiNote % 12;
    const label = source === 'screen' ? keyName(pc) : midiNoteName(midiNote);
    setText(els.lastPlayed, `Last key: ${label}${source === 'screen' ? ' (on-screen)' : ''}`);

    if (!session || session.state !== 'prompting') {
      if (!session || session.state !== 'advancing') flash(pc, 'played');
      return;
    }

    const target = session.prompt;
    const outcome = session.answer(midiNote, now());
    if (outcome.result === 'correct') {
      clearFlashes();
      flash(pc, 'correct', ADVANCE_DELAY_MS);
      showNote(target.name, target.spoken, 'correct');
      showResult('correct');
      playCue('correct');
      setFeedback(`Correct! That was ${target.name}.`, 'correct');
      advanceTimer = setTimeout(advance, ADVANCE_DELAY_MS);
    } else if (outcome.result === 'wrong') {
      flash(pc, 'wrong');
      showNote(target.name, target.spoken, '');
      void els.noteFace.offsetWidth;
      els.noteFace.dataset.result = 'wrong';
      showResult('wrong');
      playCue('wrong');
      setFeedback(`That was ${keyName(pc)}. Try again.`, 'wrong');
    }
    renderStats();
    renderControls();
  }

  function skip() {
    if (!session || session.state !== 'prompting') return;
    const skipped = session.skip(now());
    clearFlashes();
    flash(skipped.pitchClass, 'reveal', REVEAL_MS);
    setFeedback(`Skipped. ${skipped.name} is the highlighted key.`);
    if (session.state === 'finished') finish();
    else {
      presentPrompt(session.prompt);
      renderStats();
      renderControls();
    }
  }

  /* ---------- Web MIDI ---------- */

  function setDeviceState(state, text) {
    els.deviceStatus.dataset.state = state;
    els.deviceText.textContent = text;
  }

  function onMidiMessage(event) {
    const message = parseMidiMessage(event.data);
    if (message && message.type === 'noteon') handleNote(message.note, 'midi');
  }

  function renderDeviceList(inputs) {
    els.deviceList.replaceChildren();
    if (!inputs.length) {
      const empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = 'No MIDI keyboards found yet.';
      els.deviceList.append(empty);
      return;
    }
    inputs.forEach(input => {
      const item = document.createElement('li');
      const maker = input.manufacturer && !String(input.name).includes(input.manufacturer) ? ` (${input.manufacturer})` : '';
      item.textContent = `${input.name || 'MIDI input'}${maker}`;
      els.deviceList.append(item);
    });
  }

  function refreshDevices() {
    if (!midiAccess) return;
    const inputs = [];
    midiAccess.inputs.forEach(input => {
      if (input.state === 'connected') {
        input.onmidimessage = onMidiMessage;
        inputs.push(input);
      } else {
        input.onmidimessage = null;
      }
    });
    renderDeviceList(inputs);
    els.connectBtn.hidden = true;
    if (!inputs.length) {
      setDeviceState('waiting', 'No keyboard detected. Plug one in to continue.');
    } else if (inputs.length === 1) {
      setDeviceState('connected', `Connected: ${inputs[0].name || 'MIDI keyboard'}`);
    } else {
      setDeviceState('connected', `${inputs.length} MIDI inputs connected`);
    }
  }

  async function connectMidi() {
    if (typeof navigator.requestMIDIAccess !== 'function') {
      setDeviceState('unsupported', window.isSecureContext
        ? 'This browser does not support MIDI keyboards. Try Chrome, Edge, or Firefox, or use the on-screen keys.'
        : 'MIDI keyboards need a secure (https) page. Use the on-screen keys for now.');
      els.connectBtn.hidden = true;
      return;
    }
    els.connectBtn.disabled = true;
    setDeviceState('pending', 'Waiting for MIDI permission…');
    try {
      midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      midiAccess.onstatechange = refreshDevices;
      refreshDevices();
    } catch (error) {
      setDeviceState('blocked', 'MIDI access was blocked. Allow MIDI devices in this browser\'s site settings, or open the page in Chrome or Edge.');
      els.connectBtn.textContent = 'Try again';
      els.connectBtn.disabled = false;
    }
  }

  async function autoConnect() {
    els.fileNotice.hidden = location.protocol !== 'file:';
    if (typeof navigator.requestMIDIAccess !== 'function') {
      connectMidi();
      return;
    }
    els.connectBtn.disabled = false;
    try {
      const permission = await navigator.permissions.query({ name: 'midi' });
      if (permission.state === 'granted') connectMidi();
    } catch {
      /* Some browsers cannot query MIDI permission; the Connect button still works. */
    }
  }

  /* ---------- Events ---------- */

  els.startBtn.addEventListener('click', () => {
    unlockAudio();
    if (running()) stop();
    else start();
  });
  els.soundCues.addEventListener('change', () => {
    unlockAudio();
    saveSettings();
  });
  els.skipBtn.addEventListener('click', skip);
  els.connectBtn.addEventListener('click', connectMidi);
  els.piano.addEventListener('click', event => {
    const key = event.target.closest('.key');
    if (key) handleNote(60 + Number(key.dataset.pc), 'screen');
  });
  [els.noteSet, els.spelling, els.roundLength].forEach(select => select.addEventListener('change', () => {
    syncSettingsUi();
    saveSettings();
  }));
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    if (event.target.closest('input, select, textarea, button, summary, a, [contenteditable="true"]')) return;
    if (event.code === 'Space') {
      event.preventDefault();
      els.startBtn.click();
    } else if (event.key === 'n' || event.key === 'N') {
      skip();
    }
  });

  loadSettings();
  syncSettingsUi();
  renderStats();
  renderControls();
  els.startBtn.disabled = false;
  autoConnect();
})();
