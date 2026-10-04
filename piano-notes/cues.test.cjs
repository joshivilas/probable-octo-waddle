'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CUES, PEAK, playCue } = require('./cues.js');

class Parameter {
  constructor() { this.events = []; }
  setValueAtTime(value, time) { this.events.push(['set', value, time]); }
  exponentialRampToValueAtTime(value, time) { this.events.push(['exp', value, time]); }
}

class FakeNode {
  constructor() { this.connections = []; this.disconnected = false; }
  connect(target) { this.connections.push(target); }
  disconnect() { this.disconnected = true; }
}

class FakeContext {
  constructor(currentTime = 2) {
    this.currentTime = currentTime;
    this.destination = new FakeNode();
    this.gains = [];
  }
  createOscillator() {
    const node = new FakeNode();
    node.frequency = new Parameter();
    node.start = time => { node.startedAt = time; };
    node.stop = time => { node.stoppedAt = time; };
    return node;
  }
  createGain() {
    const node = new FakeNode();
    node.gain = new Parameter();
    this.gains.push(node);
    return node;
  }
}

test('the correct cue is a short rising two-tone chime routed to the speakers', () => {
  const context = new FakeContext(2);
  const oscillators = playCue(context, 'correct');
  assert.equal(oscillators.length, 2);
  const [low, high] = oscillators;
  assert.equal(low.frequency.events[0][1], 880);
  assert.equal(high.frequency.events[0][1], 1318.51);
  assert.ok(high.startedAt > low.startedAt);
  assert.ok(low.startedAt >= context.currentTime);
  for (const [index, oscillator] of oscillators.entries()) {
    const gain = context.gains[index];
    assert.deepEqual(oscillator.connections, [gain]);
    assert.deepEqual(gain.connections, [context.destination]);
    assert.ok(oscillator.stoppedAt - oscillator.startedAt < 0.3);
    const levels = gain.gain.events.map(event => event[1]);
    assert.equal(Math.max(...levels), PEAK);
    assert.ok(levels[levels.length - 1] < 0.001, 'fades to silence');
    oscillator.onended();
    assert.ok(oscillator.disconnected && gain.disconnected);
  }
});

test('the wrong cue is a single lower tone that glides down', () => {
  const context = new FakeContext(0);
  const [tone] = playCue(context, 'wrong');
  assert.equal(CUES.wrong.length, 1);
  const [start, glide] = tone.frequency.events;
  assert.equal(start[1], 247);
  assert.deepEqual(glide.slice(0, 2), ['exp', 165]);
  assert.ok(tone.stoppedAt - tone.startedAt < 0.3);
});

test('unknown cues are rejected', () => {
  assert.throws(() => playCue(new FakeContext(), 'applause'), /correct or wrong/);
});
