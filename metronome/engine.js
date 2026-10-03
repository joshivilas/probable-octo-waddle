/* Classic-script global; also exported below for dependency-free Node tests. */
const MetronomeCore = (() => {
  'use strict';

  const DEFAULTS = Object.freeze({
    bpm: 120,
    meter: '4/4',
    subdivision: 1,
    accent: true,
    volume: 60,
    sound: 'woodblock',
    countInBars: 0,
    durationSeconds: 0,
    trainerEnabled: false,
    trainerStep: 2,
    trainerBars: 8,
    trainerTarget: 160,
  });
  const METERS = Object.freeze({
    '2/4': 2, '3/4': 3, '4/4': 4, '5/4': 5, '6/8': 2,
  });
  const SOUNDS = Object.freeze({
    click: { type: 'square', frequency: 1500, duration: 0.025 },
    woodblock: { type: 'sine', frequency: 800, duration: 0.065 },
    beep: { type: 'sine', frequency: 1000, duration: 0.085 },
  });
  const LOOKAHEAD = 0.1;
  const START_LEAD = 0.05;
  const EPSILON = 1e-9;

  function integer(value, name, min, max) {
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error(`${name} must be a whole number from ${min} to ${max}.`);
    }
    return value;
  }

  function getMeter(meter) {
    if (typeof meter !== 'string' || !Object.prototype.hasOwnProperty.call(METERS, meter)) {
      throw new Error('meter must be 2/4, 3/4, 4/4, 5/4, or 6/8.');
    }
    return {
      beats: METERS[meter],
      unit: meter === '6/8' ? 'dotted quarter' : 'quarter note',
    };
  }

  function soundDefinition(sound) {
    if (typeof sound !== 'string' || !Object.prototype.hasOwnProperty.call(SOUNDS, sound)) {
      throw new Error('sound must be click, woodblock, or beep.');
    }
    return SOUNDS[sound];
  }

  // Omitted keys use DEFAULTS; supplied invalid values (including undefined) throw.
  // Unknown keys are ignored and neither the input nor DEFAULTS is mutated.
  function validateConfig(config = {}) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new Error('config must be an object.');
    }
    const result = {};
    for (const key of Object.keys(DEFAULTS)) {
      result[key] = Object.prototype.hasOwnProperty.call(config, key)
        ? config[key] : DEFAULTS[key];
    }
    integer(result.bpm, 'bpm', 30, 240);
    integer(result.volume, 'volume', 0, 100);
    integer(result.countInBars, 'countInBars', 0, 2);
    integer(result.durationSeconds, 'durationSeconds', 0, 3600);
    integer(result.trainerStep, 'trainerStep', 1, 20);
    integer(result.trainerBars, 'trainerBars', 1, 32);
    integer(result.trainerTarget, 'trainerTarget', 30, 240);
    getMeter(result.meter);
    soundDefinition(result.sound);
    const subdivisions = result.meter === '6/8' ? [1, 3, 6] : [1, 2, 3, 4];
    if (!subdivisions.includes(result.subdivision)) {
      throw new Error(`subdivision for ${result.meter} must be ${subdivisions.join(', ')}.`);
    }
    for (const key of ['accent', 'trainerEnabled']) {
      if (typeof result[key] !== 'boolean') {
        throw new Error(`${key} must be a boolean.`);
      }
    }
    if (result.trainerEnabled && result.trainerTarget < result.bpm) {
      throw new Error('trainerTarget must be at least bpm when the trainer is enabled.');
    }
    return result;
  }

  class Engine {
    // Optional third argument: {setInterval(fn, milliseconds), clearInterval(id)}.
    // Timers only wake the scheduler/visuals; audioContext.currentTime is the clock.
    constructor(audioContext, callbacks = {}, environment = globalThis) {
      if (!audioContext || typeof audioContext.createOscillator !== 'function') {
        throw new Error('A Web Audio AudioContext is required.');
      }
      this._audio = audioContext;
      this._callbacks = {};
      for (const name of ['onBeat', 'onFinish', 'onError']) {
        if (callbacks[name] !== undefined && typeof callbacks[name] !== 'function') {
          throw new Error(`${name} must be a function.`);
        }
        this._callbacks[name] = callbacks[name];
      }
      this._setInterval = environment.setInterval.bind(environment);
      this._clearInterval = environment.clearInterval.bind(environment);
      this._config = { ...DEFAULTS };
      this._running = false;
      this._elapsed = 0;
      this._active = new Set();
      this._visuals = [];
      this._schedulerTimer = null;
      this._visualTimer = null;
      this._master = null;
      this._generation = 0;
    }

    get running() {
      return this._running;
    }

    get elapsed() {
      if (!this._running) return this._elapsed;
      const elapsed = Math.max(0, this._audio.currentTime - this._practiceStart);
      return this._config.durationSeconds
        ? Math.min(elapsed, this._config.durationSeconds) : elapsed;
    }

    start(config = {}) {
      if (this._running) throw new Error('Stop the metronome before starting it again.');
      const validated = validateConfig(config);
      if (this._audio.state !== 'running') {
        throw new Error('AudioContext must be running; resume it before starting.');
      }
      this._config = validated;
      this._beats = getMeter(validated.meter).beats;
      this._bpm = validated.bpm;
      this._beatIndex = 0;
      this._subdivisionIndex = 0;
      this._bar = 1;
      this._countInBar = validated.countInBars ? 1 : 0;
      this._nextTime = this._audio.currentTime + START_LEAD;
      this._practiceStart = this._nextTime
        + validated.countInBars * this._beats * 60 / validated.bpm;
      this._deadline = validated.durationSeconds
        ? this._practiceStart + validated.durationSeconds : Infinity;
      this._lastSchedule = this._audio.currentTime;
      this._elapsed = 0;
      this._running = true;
      const generation = ++this._generation;
      try {
        this._master = this._audio.createGain();
        this._master.gain.setValueAtTime(validated.volume / 100, this._audio.currentTime);
        this._master.connect(this._audio.destination);
        this._schedulerTimer = this._setInterval(() => {
          if (generation === this._generation) this._schedule();
        }, 25);
        this._visualTimer = this._setInterval(() => {
          if (generation === this._generation) this._present();
        }, 8);
      } catch (error) {
        this._fail(error);
        return;
      }
      this._schedule();
    }

    stop() {
      const error = this._halt();
      if (error) this._report(error);
    }

    setBpm(bpm) {
      integer(bpm, 'bpm', 30, 240);
      if (this._running && this._config.trainerEnabled) {
        throw new Error('Stop the tempo trainer before changing bpm manually.');
      }
      // Already scheduled notes retain their time. New intervals use the new BPM.
      // Count-in stays at the original BPM and practice start stays predictable.
      this._config.bpm = bpm;
      if (!this._countInBar) this._bpm = bpm;
    }

    setVolume(volume) {
      integer(volume, 'volume', 0, 100);
      this._config.volume = volume;
      if (this._master) {
        try {
          this._master.gain.setValueAtTime(volume / 100, this._audio.currentTime);
        } catch (error) {
          this._fail(error);
        }
      }
    }

    setSound(sound) {
      soundDefinition(sound);
      this._config.sound = sound;
    }

    _schedule() {
      if (!this._running) return;
      try {
        const now = this._audio.currentTime;
        if (this._audio.state !== 'running') {
          throw new Error('Audio playback was interrupted. Resume audio and restart the metronome.');
        }
        if (now >= this._deadline) {
          this._finish();
          return;
        }
        if (now - this._lastSchedule > LOOKAHEAD + EPSILON
          || this._nextTime < now - EPSILON) {
          throw new Error('Metronome timing was interrupted by a scheduler stall. Please restart.');
        }
        this._lastSchedule = now;
        while (this._nextTime < now + LOOKAHEAD) {
          if (this._nextTime >= this._deadline - EPSILON) break;
          this._sound(this._nextTime);
          this._visuals.push({
            time: this._nextTime,
            event: {
              beatIndex: this._beatIndex,
              subdivisionIndex: this._subdivisionIndex,
              beats: this._beats,
              bar: this._bar,
              countIn: this._countInBar > 0,
              countInBar: this._countInBar,
              bpm: this._bpm,
              elapsed: Math.max(0, this._nextTime - this._practiceStart),
            },
          });
          this._advance();
        }
      } catch (error) {
        this._fail(error);
      }
    }

    _advance() {
      this._nextTime += 60 / this._bpm / this._config.subdivision;
      this._subdivisionIndex += 1;
      if (this._subdivisionIndex < this._config.subdivision) return;
      this._subdivisionIndex = 0;
      this._beatIndex += 1;
      if (this._beatIndex < this._beats) return;
      this._beatIndex = 0;
      if (this._countInBar) {
        if (this._countInBar < this._config.countInBars) {
          this._countInBar += 1;
        } else {
          this._countInBar = 0;
          this._bpm = this._config.bpm;
          // Eliminate accumulation error at the count-in/practice boundary.
          this._nextTime = this._practiceStart;
        }
      } else {
        const completedBars = this._bar++;
        if (this._config.trainerEnabled && completedBars % this._config.trainerBars === 0) {
          this._bpm = Math.min(this._config.trainerTarget, this._bpm + this._config.trainerStep);
        }
      }
    }

    _sound(time) {
      const definition = soundDefinition(this._config.sound);
      const subdivision = this._subdivisionIndex > 0;
      const accented = !subdivision && this._beatIndex === 0 && this._config.accent;
      const strength = subdivision ? 0.2 : accented ? 0.65 : 0.45;
      const frequency = definition.frequency * (subdivision ? 0.75 : accented ? 1.5 : 1);
      const end = Math.min(time + definition.duration, this._deadline);
      const record = { oscillator: this._audio.createOscillator(), gain: null, started: false };
      this._active.add(record);
      record.gain = this._audio.createGain();
      record.oscillator.type = definition.type;
      record.oscillator.frequency.setValueAtTime(frequency, time);
      record.oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.65, end);
      record.gain.gain.setValueAtTime(0, time);
      record.gain.gain.linearRampToValueAtTime(strength, Math.min(time + 0.002, (time + end) / 2));
      record.gain.gain.exponentialRampToValueAtTime(0.0001, end);
      record.gain.gain.setValueAtTime(0, end);
      record.oscillator.connect(record.gain);
      record.gain.connect(this._master);
      record.oscillator.onended = () => {
        const error = this._release(record, false);
        if (error) this._fail(error);
      };
      record.oscillator.start(time);
      record.started = true;
      record.oscillator.stop(end);
    }

    _present() {
      if (!this._running) return;
      try {
        if (this._audio.state !== 'running') {
          throw new Error('Audio playback was interrupted. Resume audio and restart the metronome.');
        }
        const now = this._audio.currentTime;
        // Never replay a backlog of visual beats after a background-tab stall.
        if (now < this._deadline && now - this._lastSchedule > LOOKAHEAD + EPSILON) {
          throw new Error('Metronome timing was interrupted by a scheduler stall. Please restart.');
        }
        if (now >= this._deadline) {
          this._finish();
          return;
        }
        const generation = this._generation;
        while (this._visuals.length && this._visuals[0].time <= now) {
          const { event } = this._visuals.shift();
          if (this._callbacks.onBeat) this._callbacks.onBeat(event);
          if (!this._running || generation !== this._generation) return;
        }
      } catch (error) {
        this._fail(error);
      }
    }

    _finish() {
      const error = this._halt();
      if (error) this._report(error);
      else if (this._callbacks.onFinish) this._callbacks.onFinish();
    }

    _release(record, cancel) {
      this._active.delete(record);
      record.oscillator.onended = null;
      let failure = null;
      if (cancel && record.started) {
        try {
          record.oscillator.stop(this._audio.currentTime);
        } catch (error) {
          failure = error;
        }
      }
      for (const node of [record.oscillator, record.gain]) {
        if (!node) continue;
        try {
          node.disconnect();
        } catch (error) {
          failure = failure || error;
        }
      }
      return failure;
    }

    _halt() {
      this._elapsed = this.elapsed;
      this._running = false;
      this._generation += 1;
      let failure = null;
      for (const timer of [this._schedulerTimer, this._visualTimer]) {
        if (timer === null) continue;
        try {
          this._clearInterval(timer);
        } catch (error) {
          failure = failure || error;
        }
      }
      this._schedulerTimer = null;
      this._visualTimer = null;
      this._visuals = [];
      for (const record of this._active) {
        const error = this._release(record, true);
        failure = failure || error;
      }
      if (this._master) {
        try {
          this._master.disconnect();
        } catch (error) {
          failure = failure || error;
        }
        this._master = null;
      }
      return failure;
    }

    _fail(error) {
      const cleanupError = this._halt();
      this._report(cleanupError
        ? new Error(`${error.message}; audio cleanup failed: ${cleanupError.message}`)
        : error);
    }

    _report(error) {
      if (this._callbacks.onError) this._callbacks.onError(error);
      else throw error;
    }
  }

  return Object.freeze({ DEFAULTS, getMeter, validateConfig, Engine });
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MetronomeCore;
}
