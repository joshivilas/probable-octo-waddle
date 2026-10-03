'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { DEFAULTS, getMeter, validateConfig, Engine } = require('./engine.js');

const close = (actual, expected, message) => {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${message || 'value'}: ${actual} != ${expected}`);
};

class Parameter {
  constructor() {
    this.value = 0;
    this.events = [];
  }
  setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]); }
  linearRampToValueAtTime(value, time) { this.events.push(['linear', value, time]); }
  exponentialRampToValueAtTime(value, time) { this.events.push(['exponential', value, time]); }
}

class Node {
  constructor() {
    this.connections = [];
    this.disconnected = false;
  }
  connect(target) { this.connections.push(target); }
  disconnect() { this.disconnected = true; }
}

class Oscillator extends Node {
  constructor(context) {
    super();
    this.context = context;
    this.frequency = new Parameter();
    this.starts = [];
    this.stops = [];
    this.ended = false;
  }
  start(time) {
    assert.ok(time >= this.context.currentTime - 1e-9, 'audio never starts in the past');
    this.starts.push(time);
  }
  stop(time) {
    this.stops.push(time);
    this.end = time;
  }
}

class AudioContext {
  constructor() {
    this.currentTime = 0;
    this.state = 'running';
    this.destination = {};
    this.oscillators = [];
    this.gains = [];
  }
  createGain() {
    const node = new Node();
    node.gain = new Parameter();
    this.gains.push(node);
    return node;
  }
  createOscillator() {
    const node = new Oscillator(this);
    this.oscillators.push(node);
    return node;
  }
  endNodes() {
    for (const node of this.oscillators) {
      if (!node.ended && node.end <= this.currentTime) {
        node.ended = true;
        if (node.onended) node.onended();
      }
    }
  }
}

class Timers {
  constructor(context) {
    this.context = context;
    this.jobs = new Map();
    this.nextId = 0;
    this.callbacks = [];
  }
  setInterval(callback, milliseconds) {
    const id = ++this.nextId;
    this.jobs.set(id, { callback, interval: milliseconds / 1000,
      next: this.context.currentTime + milliseconds / 1000 });
    this.callbacks.push(callback);
    return id;
  }
  clearInterval(id) { this.jobs.delete(id); }
  advance(seconds) {
    const target = this.context.currentTime + seconds;
    while (true) {
      let selected = null;
      for (const job of this.jobs.values()) {
        if (job.next <= target + 1e-10 && (!selected || job.next < selected.next)) selected = job;
      }
      if (!selected) break;
      this.context.currentTime = selected.next;
      selected.next += selected.interval;
      this.context.endNodes();
      selected.callback();
    }
    this.context.currentTime = target;
    this.context.endNodes();
  }
  jump(seconds) {
    this.context.currentTime += seconds;
    this.context.endNodes();
    for (const [id, job] of [...this.jobs]) {
      if (!this.jobs.has(id)) continue;
      job.next = this.context.currentTime + job.interval;
      job.callback();
    }
  }
}

function setup(overrides = {}) {
  const audio = new AudioContext();
  const timers = new Timers(audio);
  const beats = [];
  const errors = [];
  const finishes = [];
  const engine = new Engine(audio, {
    onBeat: event => beats.push({ ...event, observedAt: audio.currentTime }),
    onError: error => errors.push(error),
    onFinish: () => finishes.push(audio.currentTime),
    ...overrides,
  }, timers);
  return { audio, timers, beats, errors, finishes, engine };
}

test('classic browser script exposes a lexical namespace without CommonJS', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('./engine.js'), 'utf8'), context);
  assert.equal(vm.runInContext('MetronomeCore.DEFAULTS.bpm', context), 120);
  assert.equal(vm.runInContext('typeof MetronomeCore.Engine', context), 'function');
});

test('configuration defaults, copying, unknown keys, and meter semantics', () => {
  assert.deepEqual(validateConfig(), DEFAULTS);
  assert.equal(DEFAULTS.sound, 'woodblock');
  assert.equal(validateConfig({ sound: 'click' }).sound, 'click');
  assert.ok(Object.isFrozen(DEFAULTS));
  const input = { ...DEFAULTS, bpm: 90, futureSetting: 'ignored' };
  const copy = validateConfig(input);
  assert.equal(copy.bpm, 90);
  assert.equal('futureSetting' in copy, false);
  copy.volume = 0;
  assert.equal(input.volume, 60);
  assert.equal(DEFAULTS.volume, 60);
  for (const [meter, beats] of [['2/4', 2], ['3/4', 3], ['4/4', 4], ['5/4', 5]]) {
    assert.deepEqual(getMeter(meter), { beats, unit: 'quarter note' });
  }
  assert.deepEqual(getMeter('6/8'), { beats: 2, unit: 'dotted quarter' });
  assert.throws(() => getMeter('7/8'), /meter/);
  assert.throws(() => getMeter('toString'), /meter/);
  assert.throws(() => getMeter(new String('4/4')), /meter/);
});

test('all numeric bounds reject non-finite, fractional, coerced, or out-of-range values', () => {
  const bounds = {
    bpm: [30, 240], volume: [0, 100], countInBars: [0, 2], durationSeconds: [0, 3600],
    trainerStep: [1, 20], trainerBars: [1, 32], trainerTarget: [30, 240],
  };
  for (const [key, [min, max]] of Object.entries(bounds)) {
    for (const value of [NaN, Infinity, -Infinity, min - 1, max + 1, min + 0.5, '60', null, undefined]) {
      assert.throws(() => validateConfig({ [key]: value }), new RegExp(key), `${key}: ${value}`);
    }
    assert.equal(validateConfig({ [key]: min })[key], min);
    assert.equal(validateConfig({ [key]: max })[key], max);
  }
});

test('configuration rejects invalid booleans, sounds, subdivisions, and trainer targets', () => {
  for (const input of [null, [], 'config', 1]) assert.throws(() => validateConfig(input), /object/);
  for (const key of ['accent', 'trainerEnabled']) {
    for (const value of [0, 1, 'true', null, undefined]) {
      assert.throws(() => validateConfig({ [key]: value }), new RegExp(key));
    }
  }
  for (const sound of ['drum', 'constructor', undefined, new String('click')]) {
    assert.throws(() => validateConfig({ sound }), /sound/);
  }
  for (const meter of ['4/4', '6/8']) {
    for (const subdivision of [0, 5, 7, 1.5, '3', undefined]) {
      assert.throws(() => validateConfig({ meter, subdivision }), /subdivision/);
    }
  }
  assert.throws(() => validateConfig({ meter: '6/8', subdivision: 2 }), /subdivision/);
  assert.throws(() => validateConfig({ meter: '6/8', subdivision: 4 }), /subdivision/);
  assert.throws(() => validateConfig({ subdivision: 6 }), /subdivision/);
  assert.throws(() => validateConfig({ trainerEnabled: true, bpm: 170, trainerTarget: 160 }), /at least bpm/);
  assert.equal(validateConfig({ trainerEnabled: false, bpm: 240, trainerTarget: 30 }).bpm, 240);
  assert.equal(validateConfig({ trainerEnabled: true, trainerTarget: 120 }).trainerTarget, 120);
});

for (const bpm of [30, 240]) {
  for (const meter of ['4/4', '6/8']) {
    for (const subdivision of (meter === '6/8' ? [1, 3, 6] : [1, 2, 3, 4])) {
      test(`audio clock timing: ${bpm} BPM, ${meter}, subdivision ${subdivision}`, () => {
        const { engine, audio, timers, beats, errors } = setup();
        engine.start({ bpm, meter, subdivision });
        assert.equal(beats.length, 0, 'visuals are not dispatched at scheduling time');
        const pulse = 60 / bpm;
        const spacing = pulse / subdivision;
        timers.advance(pulse * getMeter(meter).beats + 0.06);
        assert.ok(audio.oscillators.length > getMeter(meter).beats * subdivision);
        audio.oscillators.forEach((oscillator, index) => {
          close(oscillator.starts[0], 0.05 + index * spacing, 'absolute onset');
          assert.equal(oscillator.starts.length, 1);
          assert.ok(oscillator.stops[0] > oscillator.starts[0]);
        });
        beats.forEach((event, index) => {
          assert.equal(event.subdivisionIndex, index % subdivision);
          assert.equal(event.beatIndex, Math.floor(index / subdivision) % getMeter(meter).beats);
          assert.equal(event.bar, Math.floor(index / subdivision / getMeter(meter).beats) + 1);
          assert.equal(event.beats, getMeter(meter).beats);
          assert.equal(event.bpm, bpm);
          assert.equal(event.countIn, false);
          assert.equal(event.countInBar, 0);
          close(event.elapsed, index * spacing);
          assert.ok(event.observedAt + 1e-9 >= 0.05 + index * spacing);
          assert.ok(event.observedAt < 0.05 + index * spacing + 0.009);
        });
        assert.deepEqual(errors, []);
        engine.stop();
        assert.equal(timers.jobs.size, 0);
      });
    }
  }
}

for (const meter of ['2/4', '3/4', '5/4']) {
  test(`bar numbering in ${meter}`, () => {
    const { engine, timers, beats } = setup();
    engine.start({ bpm: 240, meter });
    const count = getMeter(meter).beats;
    timers.advance(count * 0.25 + 0.06);
    assert.deepEqual(beats.slice(0, count).map(event => event.beatIndex),
      Array.from({ length: count }, (_, index) => index));
    assert.equal(beats[count].bar, 2);
    assert.equal(beats[count].beatIndex, 0);
    engine.stop();
  });
}

for (const countInBars of [0, 1, 2]) {
  test(`${countInBars}-bar count-in is excluded from elapsed, duration, and trainer`, () => {
    const { engine, audio, timers, beats, finishes, errors } = setup();
    engine.start({ bpm: 120, meter: '6/8', subdivision: 3, countInBars,
      durationSeconds: 2, trainerEnabled: true, trainerStep: 10, trainerBars: 1, trainerTarget: 130 });
    const practiceStart = 0.05 + countInBars;
    timers.advance(practiceStart - 0.01);
    close(engine.elapsed, 0);
    timers.advance(0.02);
    close(engine.elapsed, 0.01);
    const countIn = beats.filter(event => event.countIn);
    assert.equal(countIn.length, countInBars * 2 * 3);
    countIn.forEach((event, index) => {
      assert.equal(event.countInBar, Math.floor(index / 6) + 1);
      assert.equal(event.bpm, 120);
      close(event.elapsed, 0);
    });
    const first = beats.find(event => !event.countIn);
    assert.equal(first.bar, 1);
    assert.equal(first.beatIndex, 0);
    assert.equal(first.bpm, 120);
    close(first.elapsed, 0);
    timers.advance(2);
    const nextBar = beats.find(event => !event.countIn && event.bar === 2);
    assert.equal(nextBar.bpm, 130);
    close(nextBar.elapsed, 1);
    assert.equal(engine.running, false);
    close(engine.elapsed, 2);
    assert.equal(finishes.length, 1);
    assert.ok(finishes[0] >= practiceStart + 2 - 1e-9);
    assert.ok(finishes[0] < practiceStart + 2.009);
    audio.oscillators.forEach(node => assert.ok(node.starts[0] < practiceStart + 2));
    assert.deepEqual(errors, []);
  });
}

test('trainer advances only at complete practice-bar intervals and caps exactly at target', () => {
  const { engine, timers, beats, audio } = setup();
  engine.start({ bpm: 120, meter: '2/4', subdivision: 2, countInBars: 2,
    trainerEnabled: true, trainerStep: 7, trainerBars: 2, trainerTarget: 130 });
  assert.throws(() => engine.setBpm(100), /trainer/);
  timers.advance(9);
  const starts = beats.filter(event => !event.countIn && event.beatIndex === 0 && event.subdivisionIndex === 0);
  assert.deepEqual(starts.slice(0, 7).map(event => event.bpm), [120, 120, 127, 127, 130, 130, 130]);
  const expected = [0, 1, 2, 2 + 120 / 127, 2 + 240 / 127];
  starts.slice(0, 5).forEach((event, index) => close(event.elapsed, expected[index]));
  const firstPracticeNode = audio.oscillators[2 * 2 * 2];
  close(firstPracticeNode.starts[0], 2.05);
  close(audio.oscillators[16].starts[0], 4.05);
  close(audio.oscillators[17].starts[0] - audio.oscillators[16].starts[0], 30 / 127);
  engine.stop();
});

test('accents and subdivisions have distinct pitch and level; accent can be disabled', () => {
  for (const accent of [true, false]) {
    const { engine, audio, timers } = setup();
    engine.start({ bpm: 240, subdivision: 2, accent });
    timers.advance(0.3);
    const [first, subdivision, second] = audio.oscillators;
    const pitch = node => node.frequency.events[0][1];
    const strength = node => node.connections[0].gain.events.find(event => event[0] === 'linear')[1];
    assert.ok(strength(subdivision) < strength(second));
    assert.ok(pitch(subdivision) < pitch(second));
    if (accent) {
      assert.ok(strength(first) > strength(second));
      assert.ok(pitch(first) > pitch(second));
    } else {
      assert.equal(strength(first), strength(second));
      assert.equal(pitch(first), pitch(second));
    }
    engine.stop();
  }
});

test('volume updates master gain immediately, including scheduled notes, without muting the visual clock', () => {
  const { engine, audio, timers, beats } = setup();
  engine.start({ volume: 60, bpm: 240 });
  const master = audio.gains[0];
  assert.equal(master.gain.value, 0.6);
  assert.equal(audio.oscillators[0].connections[0].connections[0], master);
  engine.setVolume(0);
  assert.equal(master.gain.value, 0);
  timers.advance(0.31);
  assert.equal(beats.length, 2);
  engine.setVolume(100);
  assert.deepEqual(master.gain.events.at(-1), ['set', 1, audio.currentTime]);
  assert.throws(() => engine.setVolume(-1), /volume/);
  assert.throws(() => engine.setVolume('50'), /volume/);
  engine.stop();
});

test('sound changes apply to newly scheduled oscillators with distinct synthesized timbres', () => {
  const { engine, audio, timers } = setup();
  engine.start({ bpm: 120, accent: false, sound: 'click' });
  engine.setSound('woodblock');
  timers.advance(0.5);
  engine.setSound('beep');
  timers.advance(0.5);
  const [click, woodblock, beep] = audio.oscillators;
  assert.equal(click.type, 'square');
  assert.equal(woodblock.type, 'sine');
  assert.equal(beep.type, 'sine');
  assert.deepEqual([click, woodblock, beep].map(node => node.frequency.events[0][1]), [1500, 800, 1000]);
  [click, woodblock, beep].forEach((node, index) => {
    close(node.stops[0] - node.starts[0], [0.025, 0.065, 0.085][index]);
    assert.equal(node.connections[0].gain.events.at(-1)[1], 0);
  });
  assert.throws(() => engine.setSound('noise'), /sound/);
  engine.stop();
});

test('manual BPM changes leave committed audio intact and change subsequent intervals', () => {
  const { engine, audio, timers, beats } = setup();
  engine.start({ bpm: 120 });
  const original = audio.oscillators[0].starts[0];
  engine.setBpm(240);
  timers.advance(1.1);
  const times = audio.oscillators.map(node => node.starts[0]);
  close(times[0], original);
  close(times[1], 0.55);
  close(times[2], 0.8);
  close(times[3], 1.05);
  assert.equal(beats[0].bpm, 120);
  assert.equal(beats[1].bpm, 240);
  assert.throws(() => engine.setBpm(NaN), /bpm/);
  assert.throws(() => engine.setBpm(241), /bpm/);
  engine.stop();
});

test('manual BPM change during count-in preserves original count-in timing', () => {
  const { engine, audio, timers, beats, finishes, errors } = setup();
  engine.start({ bpm: 120, meter: '2/4', countInBars: 2, durationSeconds: 3 });
  engine.setBpm(240);
  timers.advance(2.6);
  audio.oscillators.slice(0, 5).forEach((node, index) => close(node.starts[0], 0.05 + index * 0.5));
  close(audio.oscillators[5].starts[0], 2.3);
  const countIn = beats.filter(event => event.countIn);
  assert.ok(countIn.every(event => event.bpm === 120));
  assert.deepEqual(countIn.map(event => event.countInBar), [1, 1, 2, 2]);
  const practice = beats.find(event => !event.countIn);
  assert.equal(practice.bpm, 240);
  assert.equal(practice.bar, 1);
  close(practice.elapsed, 0);
  close(engine.elapsed, 0.55);
  timers.advance(2.46);
  assert.equal(engine.running, false);
  close(engine.elapsed, 3);
  assert.equal(finishes.length, 1);
  assert.ok(finishes[0] >= 5.05 - 1e-9 && finishes[0] < 5.059);
  assert.ok(audio.oscillators.every(node => node.starts[0] < 5.05 && node.stops[0] <= 5.05));
  assert.deepEqual(errors, []);
  engine.stop();
  close(engine.elapsed, 3);
});

test('stop cancels audible and future oscillators, gain connections, visuals, and timers', () => {
  const { engine, audio, timers, beats, finishes, errors } = setup();
  engine.start({ bpm: 240, meter: '6/8', subdivision: 6, sound: 'beep' });
  timers.advance(0.056);
  const pending = audio.oscillators.filter(node => !node.ended);
  assert.ok(pending.some(node => node.starts[0] > audio.currentTime));
  assert.ok(pending.some(node => node.starts[0] <= audio.currentTime));
  const staleCallbacks = [...timers.callbacks];
  engine.stop();
  assert.equal(engine.running, false);
  assert.equal(timers.jobs.size, 0);
  pending.forEach(node => {
    close(node.stops.at(-1), 0.056);
    assert.equal(node.disconnected, true);
    assert.equal(node.connections[0].disconnected, true);
    assert.equal(node.onended, null);
  });
  assert.equal(audio.gains[0].disconnected, true);
  const count = beats.length;
  timers.advance(2);
  staleCallbacks.forEach(callback => callback());
  assert.equal(beats.length, count);
  assert.deepEqual(finishes, []);
  assert.deepEqual(errors, []);
  close(engine.elapsed, 0.006);
  engine.stop();
});

test('duration cuts off onset at exact boundary and clips sound tails before delayed finish polling', () => {
  const { engine, audio, timers, beats, finishes, errors } = setup();
  engine.start({ bpm: 240, meter: '6/8', subdivision: 6, durationSeconds: 1, sound: 'beep' });
  timers.advance(1.047);
  const deadline = 1.05;
  assert.ok(audio.oscillators.length > 0);
  audio.oscillators.forEach(node => {
    assert.ok(node.starts[0] < deadline - 1e-9, 'no beat scheduled on or after cutoff');
    assert.ok(node.stops[0] <= deadline, 'sound envelope ends at cutoff');
  });
  close(audio.oscillators.at(-1).stops[0], deadline);
  assert.equal(finishes.length, 0);
  timers.jump(0.2);
  assert.equal(finishes.length, 1);
  close(engine.elapsed, 1);
  assert.equal(engine.running, false);
  const lastCount = beats.length;
  timers.advance(2);
  assert.equal(finishes.length, 1);
  assert.equal(beats.length, lastCount);
  assert.deepEqual(errors, [], 'completed duration wins over a delayed scheduler');
});

test('duration zero runs indefinitely; elapsed freezes on stop and resets for restart', () => {
  const { engine, audio, timers, beats, finishes, errors } = setup();
  engine.stop();
  assert.equal(engine.elapsed, 0);
  engine.start({ bpm: 240 });
  assert.throws(() => engine.start(), /Stop/);
  timers.advance(5);
  assert.equal(engine.running, true);
  close(engine.elapsed, 4.95);
  const staleCallbacks = [...timers.callbacks];
  engine.stop();
  timers.advance(3);
  close(engine.elapsed, 4.95);
  const priorBeats = beats.length;
  const priorNodes = audio.oscillators.length;
  engine.start({ bpm: 30, countInBars: 1 });
  close(engine.elapsed, 0);
  staleCallbacks.forEach(callback => callback());
  assert.equal(audio.oscillators.length, priorNodes + 1);
  timers.advance(0.06);
  assert.equal(beats.length, priorBeats + 1);
  assert.equal(beats.at(-1).beatIndex, 0);
  assert.equal(beats.at(-1).countInBar, 1);
  close(audio.oscillators.at(-1).starts[0], 8.05);
  engine.stop();
  assert.deepEqual(finishes, []);
  assert.deepEqual(errors, []);
});

test('scheduler stall stops instead of scheduling or presenting a backlog', () => {
  const { engine, audio, timers, beats, errors, finishes } = setup();
  engine.start({ bpm: 240, meter: '6/8', subdivision: 6 });
  const scheduled = audio.oscillators.length;
  timers.jump(0.2);
  assert.equal(engine.running, false);
  assert.equal(audio.oscillators.length, scheduled);
  assert.equal(beats.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /stall/);
  assert.equal(timers.jobs.size, 0);
  assert.deepEqual(finishes, []);
});

test('visual timer detects a stall even if it runs before the audio scheduler', () => {
  const { engine, audio, timers, beats, errors } = setup();
  engine.start();
  audio.currentTime = 0.2;
  timers.callbacks[1]();
  assert.equal(engine.running, false);
  assert.equal(beats.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /stall/);
});

test('moderate timer jitter is allowed without losing scheduled timing', () => {
  const { engine, audio, timers, errors } = setup();
  engine.start({ bpm: 240, subdivision: 4 });
  timers.jump(0.075);
  assert.equal(engine.running, true);
  audio.oscillators.forEach((node, index) => close(node.starts[0], 0.05 + index * 0.0625));
  assert.deepEqual(errors, []);
  engine.stop();
});

test('suspended context must be resumed before start; interruption during playback is explicit', () => {
  const { engine, audio, timers, errors } = setup();
  audio.state = 'suspended';
  assert.throws(() => engine.start(), /resume/);
  assert.equal(engine.running, false);
  assert.equal(timers.jobs.size, 0);
  audio.state = 'running';
  engine.start();
  audio.state = 'suspended';
  timers.advance(0.01);
  assert.equal(engine.running, false);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /interrupted/);
  assert.ok(audio.oscillators.every(node => node.disconnected));
});

test('audio creation failure cancels partial setup and permits restart', () => {
  const { engine, audio, timers, errors } = setup();
  const createGain = audio.createGain.bind(audio);
  audio.createGain = () => {
    if (audio.gains.length === 1) throw new Error('gain unavailable');
    return createGain();
  };
  engine.start();
  assert.equal(engine.running, false);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /gain unavailable/);
  assert.ok(audio.gains.every(node => node.disconnected));
  assert.ok(audio.oscillators.every(node => node.disconnected));
  assert.equal(timers.jobs.size, 0);
  audio.createGain = createGain;
  engine.start();
  assert.equal(engine.running, true);
  engine.stop();
});

test('later scheduling errors cancel existing future notes and all timers', () => {
  const { engine, audio, timers, errors } = setup();
  engine.start({ bpm: 240, meter: '6/8', subdivision: 6 });
  audio.createOscillator = () => { throw new Error('oscillator unavailable'); };
  timers.advance(0.06);
  assert.equal(engine.running, false);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /oscillator unavailable/);
  assert.equal(timers.jobs.size, 0);
  assert.ok(audio.oscillators.every(node => node.disconnected));
});

test('volume automation errors stop audio and reach onError', () => {
  const { engine, audio, errors } = setup();
  engine.start();
  audio.gains[0].gain.setValueAtTime = () => { throw new Error('automation unavailable'); };
  engine.setVolume(50);
  assert.equal(engine.running, false);
  assert.match(errors[0].message, /automation unavailable/);
  assert.ok(audio.oscillators.every(node => node.disconnected));
});

test('cleanup errors are reported while remaining resources are still disconnected', () => {
  const { engine, audio, timers, errors } = setup();
  engine.start({ bpm: 240, meter: '6/8', subdivision: 6 });
  audio.oscillators[0].stop = () => { throw new Error('stop failed'); };
  engine.stop();
  assert.equal(engine.running, false);
  assert.equal(timers.jobs.size, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /stop failed/);
  assert.ok(audio.oscillators.every(node => node.disconnected));
  assert.ok(audio.gains.every(node => node.disconnected));
});

test('naturally ended nodes are disconnected and not retained until stop', () => {
  const { engine, audio, timers, errors } = setup();
  engine.start();
  const first = audio.oscillators[0];
  timers.advance(first.stops[0] - audio.currentTime + 0.001);
  assert.equal(first.disconnected, true);
  assert.equal(first.connections[0].disconnected, true);
  assert.equal(first.onended, null);
  engine.stop();
  assert.equal(first.stops.length, 1, 'ended node is no longer tracked');
  assert.deepEqual(errors, []);
});

test('onBeat may stop and restart without dispatching stale events', () => {
  let harness;
  let calls = 0;
  harness = setup({ onBeat: () => {
    calls += 1;
    if (calls === 1) {
      harness.engine.stop();
      harness.engine.start({ bpm: 30 });
    }
  } });
  harness.engine.start({ bpm: 240, meter: '6/8', subdivision: 6 });
  harness.timers.advance(0.12);
  assert.equal(calls, 2);
  assert.equal(harness.engine.running, true);
  assert.deepEqual(harness.errors, []);
  harness.engine.stop();
});

test('callback errors stop and surface through onError', () => {
  const { engine, timers, errors } = setup({ onBeat: () => { throw new Error('visual failed'); } });
  engine.start();
  timers.advance(0.06);
  assert.equal(engine.running, false);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /visual failed/);
});

test('without onError audio failures throw rather than silently disappearing', () => {
  const audio = new AudioContext();
  const timers = new Timers(audio);
  const engine = new Engine(audio, {}, timers);
  audio.createOscillator = () => { throw new Error('audio failed'); };
  assert.throws(() => engine.start(), /audio failed/);
  assert.equal(engine.running, false);
  assert.equal(timers.jobs.size, 0);
});
