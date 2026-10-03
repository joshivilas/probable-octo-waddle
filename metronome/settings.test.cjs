const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULTS } = require('./engine.js');
const settings = require('./settings.js');

test('all shared settings round trip, including compound meter and a trainer', () => {
    const config = {
        ...DEFAULTS, bpm: 60, meter: '6/8', subdivision: 6, accent: false, volume: 0,
        sound: 'woodblock', countInBars: 2, durationSeconds: 300, trainerEnabled: true,
        trainerStep: 3, trainerBars: 4, trainerTarget: 100
    };
    const hash = settings.toHash(config);
    assert.deepEqual(settings.fromHash(hash), config);
    assert.equal(hash.includes('preset'), false);
    assert.equal(hash.includes('wake'), false);
});

test('partial versioned links use explicit defaults; ordinary anchors do not change settings', () => {
    assert.deepEqual(settings.fromHash('#v=1&bpm=60'), { ...DEFAULTS, bpm: 60 });
    assert.equal(settings.fromHash(''), null);
    assert.equal(settings.fromHash('#content'), null);
});

test('bad or ambiguous links never become valid settings silently', () => {
    for (const hash of [
        '#v=2', '#v=1&bpm=0', '#v=1&bpm=241', '#v=1&bpm=60.5', '#v=1&bpm=Infinity',
        '#v=1&bpm=', '#v=1&bpm=60&bpm=80', '#v=1&v=1', '#v=1&accent=0',
        '#v=1&trainerEnabled=yes', '#v=1&sound=unknown', '#v=1&subdivision=7',
        '#v=1&meter=6%2F8&subdivision=2', '#v=1&__proto__=test', '#v=1&surprise=1',
        '#v=1&trainerEnabled=true&bpm=120&trainerTarget=60'
    ]) assert.throws(() => settings.fromHash(hash), undefined, hash);
});

test('presets preserve names and configuration without storing playback state', () => {
    const presets = [{ name: 'Guitar scales', config: { ...DEFAULTS, bpm: 80 } }];
    assert.deepEqual(settings.decodePresets(settings.encodePresets(presets)), presets);
    assert.deepEqual(settings.decodePresets(null), []);
    assert.equal(settings.presetName('  Practice  '), 'Practice');
});

test('corrupted, duplicate, and invalid preset data is surfaced', () => {
    for (const value of ['', '{', 'null', '[]', '{"version":2,"presets":[]}']) {
        assert.throws(() => settings.decodePresets(value));
    }
    for (const name of ['', '   ', 'a'.repeat(61), null]) assert.throws(() => settings.presetName(name));
    assert.throws(() => settings.encodePresets([
        { name: 'Scales', config: DEFAULTS }, { name: 'scales', config: DEFAULTS }
    ]), /duplicate/);
    assert.throws(() => settings.encodePresets([{ name: 'Bad tempo', config: { ...DEFAULTS, bpm: -1 } }]));
    assert.throws(() => settings.decodePresets('{"version":1,"presets":[{"name":"Missing config"}]}'), /missing settings/);
    assert.throws(() => settings.decodePresets('{"version":1,"presets":[{"name":"Incomplete","config":{"bpm":80}}]}'), /missing settings/);
});

test('tap tempo averages up to six recent intervals', () => {
    const taps = new settings.TapTempo();
    assert.deepEqual(taps.tap(0), { bpm: null, count: 1 });
    assert.deepEqual(taps.tap(500), { bpm: 120, count: 2 });
    assert.deepEqual(taps.tap(1000), { bpm: 120, count: 3 });
    for (let time = 1500; time <= 4000; time += 500) taps.tap(time);
    assert.deepEqual(taps.tap(4500), { bpm: 120, count: 7 });
    taps.reset();
    taps.tap(0);
    assert.equal(taps.tap(2000).bpm, 30);
    taps.reset();
    taps.tap(0);
    assert.equal(taps.tap(250).bpm, 240);
});

test('tap tempo resets after a pause and rejects invalid timing', () => {
    const taps = new settings.TapTempo();
    taps.tap(0);
    taps.tap(500);
    assert.deepEqual(taps.tap(4000), { bpm: null, count: 1 });
    assert.equal(taps.tap(5000).bpm, 60);
    assert.throws(() => taps.tap(5000), /increase/);
    assert.throws(() => taps.tap(NaN), /finite/);
    taps.reset();
    taps.tap(0);
    assert.throws(() => taps.tap(50), /30 and 240/);
    assert.deepEqual(taps.tap(550), { bpm: 120, count: 2 });
});
