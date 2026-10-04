'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULTS, NATURALS, ALL, validateSettings, pitchClass, isBlackKey, noteName, keyName, spokenName,
  midiNoteName, NotePicker, parseMidiMessage, Session,
} = require('./notes.js');

const sequence = values => {
  let index = 0;
  return () => values[index++ % values.length];
};

test('settings default to white keys, sharps, and unlimited rounds, and reject unknown values', () => {
  assert.deepEqual({ ...validateSettings() }, { ...DEFAULTS });
  assert.deepEqual({ ...DEFAULTS }, { noteSet: 'naturals', spelling: 'sharps', roundLength: 0 });
  assert.throws(() => validateSettings({ noteSet: 'chromatic' }), /noteSet/);
  assert.throws(() => validateSettings({ spelling: 'double' }), /spelling/);
  assert.throws(() => validateSettings({ roundLength: 7 }), /roundLength/);
});

test('MIDI notes map to pitch classes and names in every octave', () => {
  assert.equal(pitchClass(60), 0);
  assert.equal(pitchClass(61), 1);
  assert.equal(pitchClass(21), 9);
  assert.equal(pitchClass(108), 0);
  assert.equal(pitchClass(0), 0);
  assert.equal(pitchClass(127), 7);
  assert.throws(() => pitchClass(128));
  assert.throws(() => pitchClass(-1));
  assert.throws(() => pitchClass(60.5));
  assert.equal(midiNoteName(60), 'C4');
  assert.equal(midiNoteName(21), 'A0');
  assert.equal(midiNoteName(70), 'A♯4 / B♭4');
  assert.equal(noteName(1), 'C♯');
  assert.equal(noteName(1, 'flat'), 'D♭');
  assert.equal(noteName(4, 'flat'), 'E');
  assert.equal(keyName(6), 'F♯ / G♭');
  assert.equal(keyName(11), 'B');
  assert.equal(spokenName('E♭'), 'E flat');
  assert.equal(spokenName('C♯ / D♭'), 'C sharp or D flat');
  assert.equal(spokenName('Last key: A♯4 / B♭4'), 'Last key: A sharp 4 or B flat 4');
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter(isBlackKey), [1, 3, 6, 8, 10]);
});

test('every note appears exactly once per cycle, in a varying order', () => {
  for (const [noteSet, size] of [['naturals', 7], ['all', 12]]) {
    const picker = new NotePicker({ noteSet });
    const orders = new Set();
    for (let cycle = 0; cycle < 50; cycle += 1) {
      const notes = Array.from({ length: size }, () => picker.next().pitchClass);
      assert.deepEqual([...notes].sort((a, b) => a - b), noteSet === 'all' ? ALL : NATURALS);
      orders.add(notes.join(','));
    }
    assert.ok(orders.size > 40, `${noteSet} cycles are shuffled differently`);
  }
});

test('repeats are always spaced apart, even across cycles and with a degenerate random source', () => {
  for (const [noteSet, minimumDistance] of [['naturals', 3], ['all', 4]]) {
    for (const random of [Math.random, () => 0, () => 0.999999, sequence([0.1, 0.9, 0.5, 0.3])]) {
      const picker = new NotePicker({ noteSet }, random);
      const lastSeen = new Map();
      for (let i = 0; i < 2000; i += 1) {
        const pc = picker.next().pitchClass;
        if (lastSeen.has(pc)) assert.ok(i - lastSeen.get(pc) >= minimumDistance, `${noteSet}: ${pc} repeated after ${i - lastSeen.get(pc)}`);
        lastSeen.set(pc, i);
      }
    }
  }
});

test('notes are spread evenly over a long practice session', () => {
  const picker = new NotePicker({ noteSet: 'all' });
  const counts = new Map();
  for (let i = 0; i < 1200; i += 1) {
    const { pitchClass: pc } = picker.next();
    counts.set(pc, (counts.get(pc) || 0) + 1);
  }
  assert.deepEqual([...new Set(counts.values())], [100]);
});

test('black-key prompts follow the spelling setting, and mixed spelling alternates fairly', () => {
  const blackKeys = settings => {
    const picker = new NotePicker({ noteSet: 'all', ...settings });
    return Array.from({ length: 240 }, () => picker.next()).filter(prompt => isBlackKey(prompt.pitchClass));
  };
  assert.ok(blackKeys({ spelling: 'sharps' }).every(prompt => prompt.name.endsWith('♯')));
  assert.ok(blackKeys({ spelling: 'flats' }).every(prompt => prompt.name.endsWith('♭')));

  const mixed = blackKeys({ spelling: 'mixed' });
  for (const pc of [1, 3, 6, 8, 10]) {
    const names = mixed.filter(prompt => prompt.pitchClass === pc).map(prompt => prompt.name);
    assert.equal(names.length, 20);
    assert.equal(names.filter(name => name.endsWith('♯')).length, 10, `${pc} balanced`);
    for (let i = 0; i < names.length; i += 2) assert.notEqual(names[i], names[i + 1], 'each pair uses both names');
  }
  const flat = mixed.find(prompt => prompt.pitchClass === 1 && prompt.name === 'D♭');
  assert.equal(flat.spoken, 'D flat');
  assert.ok(new NotePicker({ noteSet: 'naturals', spelling: 'mixed' }).next().name.length === 1);
});

test('only note-on and note-off messages are recognised', () => {
  assert.deepEqual(parseMidiMessage([0x90, 60, 100]), { type: 'noteon', note: 60, velocity: 100, channel: 1 });
  assert.deepEqual(parseMidiMessage(new Uint8Array([0x93, 61, 5])), { type: 'noteon', note: 61, velocity: 5, channel: 4 });
  assert.equal(parseMidiMessage([0x90, 60, 0]).type, 'noteoff');
  assert.equal(parseMidiMessage([0x80, 60, 64]).type, 'noteoff');
  assert.equal(parseMidiMessage([0xb0, 64, 127]), null);
  assert.equal(parseMidiMessage([0xf8]), null);
  assert.equal(parseMidiMessage([0xfe]), null);
  assert.equal(parseMidiMessage(null), null);
});

test('a session scores correct, wrong, and skipped answers in any octave', () => {
  const session = new Session({ noteSet: 'naturals' }, Math.random);
  const first = session.start(1000);
  assert.ok(NATURALS.includes(first.pitchClass));
  assert.equal(session.state, 'prompting');

  const wrongNote = 60 + NATURALS.find(pc => pc !== first.pitchClass);
  assert.equal(session.answer(wrongNote, 1200).result, 'wrong');
  assert.equal(session.streak, 0);
  const correct = session.answer(84 + first.pitchClass, 2500);
  assert.deepEqual(correct, { result: 'correct', pitchClass: first.pitchClass, elapsed: 1500, firstTry: false });
  assert.equal(session.state, 'advancing');
  assert.equal(session.answer(60 + first.pitchClass, 2600).result, 'ignored');

  const second = session.next(3000);
  assert.notEqual(second.pitchClass, first.pitchClass);
  assert.equal(session.answer(36 + second.pitchClass, 3500).firstTry, true);
  session.next(4000);
  assert.equal(session.answer(session.prompt.pitchClass + 48, 4500).result, 'correct');
  session.next(5000);

  const skipped = session.skip(6000);
  assert.ok(skipped.name);
  assert.equal(session.state, 'prompting');

  assert.deepEqual(session.stats(), {
    correct: 3, wrong: 1, skipped: 1, attempts: 4, completed: 4, firstTry: 2,
    streak: 0, bestStreak: 3, accuracy: 0.75, averageMs: 2500 / 3, roundLength: 0,
  });
});

test('fixed-length rounds finish after the chosen number of notes, and stop ignores input', () => {
  const session = new Session({ noteSet: 'all', roundLength: 10 }, Math.random);
  session.start(0);
  for (let i = 0; i < 9; i += 1) {
    assert.equal(session.answer(session.prompt.pitchClass + 60, i * 10 + 5).result, 'correct');
    assert.ok(session.next(i * 10 + 10));
  }
  assert.equal(session.skip(100) && session.state, 'finished');
  assert.equal(session.prompt, null);
  assert.equal(session.stats().completed, 10);
  assert.equal(session.answer(60, 200).result, 'ignored');
  assert.equal(session.skip(200), null);

  const stopped = new Session();
  stopped.start(0);
  stopped.stop();
  assert.equal(stopped.state, 'idle');
  assert.equal(stopped.answer(60, 10).result, 'ignored');
  assert.deepEqual(stopped.stats().accuracy, null);
  assert.deepEqual(stopped.stats().averageMs, null);
});
