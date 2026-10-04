/* Classic-script global; also exported below for dependency-free Node tests. */
const PianoNotes = (() => {
  'use strict';

  const SHARP_NAMES = Object.freeze(['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']);
  const FLAT_NAMES = Object.freeze(['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']);
  const NATURALS = Object.freeze([0, 2, 4, 5, 7, 9, 11]);
  const ALL = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const NOTE_SETS = Object.freeze(['naturals', 'all']);
  const SPELLINGS = Object.freeze(['sharps', 'flats', 'mixed']);
  const ROUND_LENGTHS = Object.freeze([0, 10, 20, 50]);
  const DEFAULTS = Object.freeze({ noteSet: 'naturals', spelling: 'sharps', roundLength: 0 });

  function validateSettings(settings = {}) {
    const merged = { ...DEFAULTS, ...settings };
    if (!NOTE_SETS.includes(merged.noteSet)) throw new Error('noteSet must be naturals or all.');
    if (!SPELLINGS.includes(merged.spelling)) throw new Error('spelling must be sharps, flats, or mixed.');
    if (!ROUND_LENGTHS.includes(merged.roundLength)) throw new Error('roundLength must be 0, 10, 20, or 50.');
    return Object.freeze(merged);
  }

  function pitchClass(midiNote) {
    if (!Number.isInteger(midiNote) || midiNote < 0 || midiNote > 127) {
      throw new Error('MIDI note must be a whole number from 0 to 127.');
    }
    return midiNote % 12;
  }

  function isBlackKey(pc) {
    return !NATURALS.includes(pc);
  }

  function noteName(pc, accidental = 'sharp') {
    if (!Number.isInteger(pc) || pc < 0 || pc > 11) throw new Error('Pitch class must be 0 to 11.');
    return (accidental === 'flat' ? FLAT_NAMES : SHARP_NAMES)[pc];
  }

  /* Black keys show both spellings so a played key is never "wrong" by name alone. */
  function keyName(pc) {
    return isBlackKey(pc) ? `${SHARP_NAMES[pc]} / ${FLAT_NAMES[pc]}` : SHARP_NAMES[pc];
  }

  function spokenName(name) {
    return name.replace(/♯/g, ' sharp').replace(/♭/g, ' flat').replace(/(sharp|flat)(-?\d)/g, '$1 $2').replace(/ \/ /g, ' or ');
  }

  function midiNoteName(midiNote) {
    const pc = pitchClass(midiNote);
    const octave = Math.floor(midiNote / 12) - 1;
    return isBlackKey(pc)
      ? `${SHARP_NAMES[pc]}${octave} / ${FLAT_NAMES[pc]}${octave}`
      : `${SHARP_NAMES[pc]}${octave}`;
  }

  function pickIndex(length, random) {
    const value = random();
    return Math.min(length - 1, Math.max(0, Math.floor(value * length)));
  }

  function shuffle(items, random) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = pickIndex(i + 1, random);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /*
   * Shuffle-bag picker: every note appears once per cycle, and the last few notes
   * of one cycle cannot open the next, so repeats are always spaced apart.
   * Independent random picks feel streaky (C, E, C, E...) even though they are fair.
   */
  class NotePicker {
    constructor(settings, random = Math.random) {
      const config = validateSettings(settings);
      this.spelling = config.spelling;
      this.pool = config.noteSet === 'all' ? ALL : NATURALS;
      this.gap = Math.max(1, Math.round(this.pool.length / 4));
      this.random = random;
      this.bag = [];
      this.recent = [];
      this.spellingBags = new Map();
    }

    refill() {
      const bag = shuffle(this.pool, this.random);
      for (let i = 0; i < this.gap; i += 1) {
        if (!this.recent.includes(bag[i])) continue;
        const later = [];
        for (let j = this.gap; j < bag.length; j += 1) {
          if (!this.recent.includes(bag[j])) later.push(j);
        }
        const j = later[pickIndex(later.length, this.random)];
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      this.bag = bag;
    }

    accidentalFor(pc) {
      if (this.spelling === 'flats') return 'flat';
      if (this.spelling === 'sharps' || !isBlackKey(pc)) return 'sharp';
      let bag = this.spellingBags.get(pc);
      if (!bag || !bag.length) {
        bag = shuffle(['sharp', 'flat'], this.random);
        this.spellingBags.set(pc, bag);
      }
      return bag.shift();
    }

    next() {
      if (!this.bag.length) this.refill();
      const pc = this.bag.shift();
      this.recent.push(pc);
      if (this.recent.length > this.gap) this.recent.shift();
      const name = noteName(pc, this.accidentalFor(pc));
      return Object.freeze({ pitchClass: pc, name, spoken: spokenName(name) });
    }
  }

  /* Returns note-on/off events only; other MIDI traffic (clock, pedals, etc.) is ignored. */
  function parseMidiMessage(data) {
    if (!data || data.length < 3) return null;
    const status = data[0] & 0xf0;
    const channel = (data[0] & 0x0f) + 1;
    const note = data[1];
    const velocity = data[2];
    if (status === 0x90 && velocity > 0) return { type: 'noteon', note, velocity, channel };
    if (status === 0x80 || (status === 0x90 && velocity === 0)) return { type: 'noteoff', note, velocity, channel };
    return null;
  }

  class Session {
    constructor(settings, random = Math.random) {
      this.settings = validateSettings(settings);
      this.random = random;
      this.reset();
    }

    reset() {
      this.picker = new NotePicker(this.settings, this.random);
      this.state = 'idle';
      this.prompt = null;
      this.correct = 0;
      this.wrong = 0;
      this.skipped = 0;
      this.firstTry = 0;
      this.streak = 0;
      this.bestStreak = 0;
      this.totalTime = 0;
      this.promptedAt = 0;
      this.missedCurrent = false;
    }

    get attempts() { return this.correct + this.wrong; }
    get completed() { return this.correct + this.skipped; }

    start(now) {
      this.reset();
      return this.next(now);
    }

    next(now) {
      const limit = this.settings.roundLength;
      if (limit && this.completed >= limit) {
        this.state = 'finished';
        this.prompt = null;
        return null;
      }
      this.prompt = this.picker.next();
      this.promptedAt = now;
      this.missedCurrent = false;
      this.state = 'prompting';
      return this.prompt;
    }

    answer(midiNote, now) {
      if (this.state !== 'prompting') return { result: 'ignored' };
      const pc = pitchClass(midiNote);
      if (pc === this.prompt.pitchClass) {
        const elapsed = Math.max(0, now - this.promptedAt);
        const firstTry = !this.missedCurrent;
        this.correct += 1;
        this.streak += 1;
        this.bestStreak = Math.max(this.bestStreak, this.streak);
        this.totalTime += elapsed;
        if (firstTry) this.firstTry += 1;
        this.state = 'advancing';
        return { result: 'correct', pitchClass: pc, elapsed, firstTry };
      }
      this.wrong += 1;
      this.streak = 0;
      this.missedCurrent = true;
      return { result: 'wrong', pitchClass: pc };
    }

    skip(now) {
      if (this.state !== 'prompting') return null;
      const skipped = this.prompt;
      this.skipped += 1;
      this.streak = 0;
      this.next(now);
      return skipped;
    }

    stop() {
      this.state = 'idle';
      this.prompt = null;
    }

    stats() {
      return {
        correct: this.correct,
        wrong: this.wrong,
        skipped: this.skipped,
        attempts: this.attempts,
        completed: this.completed,
        firstTry: this.firstTry,
        streak: this.streak,
        bestStreak: this.bestStreak,
        accuracy: this.attempts ? this.correct / this.attempts : null,
        averageMs: this.correct ? this.totalTime / this.correct : null,
        roundLength: this.settings.roundLength,
      };
    }
  }

  return {
    DEFAULTS, NATURALS, ALL, SHARP_NAMES, FLAT_NAMES, ROUND_LENGTHS,
    validateSettings, pitchClass, isBlackKey, noteName, keyName, spokenName, midiNoteName,
    NotePicker, parseMidiMessage, Session,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PianoNotes;
}
