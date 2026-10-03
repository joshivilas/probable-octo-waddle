const { test } = require('node:test');
const assert = require('node:assert/strict');
const { decodeNames, createEffects } = require('./results.js');
const { buildLink, styles } = require('./winner.js');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

test('new links preserve Unicode, duplicates, whitespace, and literal markup in every style', () => {
    const names = ['Alex', '\u091c\u0940\u0924', '\ud83c\udfc6', 'Zo\u00eb', 'Alex', ' Line\nTwo ', '<img src=x onerror=alert(1)>'];
    for (const style of Object.keys(styles)) {
        const url = new URL(buildLink(names, style, 'https://example.com/celebrate/Celebrate-winner.html'));
        assert.deepEqual(decodeNames(url.hash), names);
    }
});

test('original Latin-1 Base64 JSON links remain compatible, with or without URI escaping', () => {
    const names = ['Andr\u00e9', 'Zo\u00eb', '\u00ff\u00ff', 'Sam', 'Sam'];
    const original = btoa(JSON.stringify(names));
    assert.deepEqual(decodeNames(`#${encodeURIComponent(original)}`), names);
    assert.deepEqual(decodeNames(`#${original}`), names);
});

test('missing, truncated, invalid encoding, and invalid list shapes report actionable errors', () => {
    for (const hash of ['', '#', null, undefined]) assert.throws(() => decodeNames(hash), /full celebration link/);
    for (const hash of ['#%not-valid', '#!!!', `#${btoa('["Alex"')}`, '#main']) {
        assert.throws(() => decodeNames(hash), /copy the full link again/);
    }
    for (const names of [[], {}, null, 'Alex', [1], [''], ['  '], ['Alex', null]]) {
        assert.throws(() => decodeNames(`#${btoa(JSON.stringify(names))}`), /valid list of names/);
    }
});

test('long lists and long names are not truncated by decoding', () => {
    const names = Array.from({ length: 250 }, (_, index) => `${index} ${'VeryLongName'.repeat(30)}`);
    assert.deepEqual(decodeNames(new URL(buildLink(names, 'winners.html', 'https://example.com/')).hash), names);
});

test('each destination wires the shared presentation without autoplay or inline handlers', () => {
    for (const style of Object.keys(styles)) {
        const html = readFileSync(join(__dirname, style), 'utf8');
        assert.match(html, /name="viewport" content="width=device-width, initial-scale=1.0"/);
        assert.match(html, /<script defer src="results.js"><\/script>/);
        assert.match(html, /href="results.css"/);
        assert.match(html, /data-name-list/);
        assert.match(html, /id="content"[^>]* hidden/);
        assert.doesNotMatch(html, /\bautoplay\b|\bonclick=/);
        if (style !== 'winners.html') assert.match(html, /<audio[^>]*preload="none"/);
        else assert.doesNotMatch(html, /<audio/);
    }
});

function fixture(theme = 'retro', { playback = () => Promise.resolve(), canvasAvailable = true } = {}) {
    let now = 0;
    let id = 0;
    const frames = new Map();
    const timers = new Map();
    const active = [];
    const messages = [];
    const events = new Map();
    const context = Object.fromEntries(['setTransform', 'clearRect', 'save', 'restore', 'translate', 'rotate', 'beginPath', 'arc', 'fill', 'fillRect'].map(name => [name, () => {}]));
    const canvas = { width: 0, height: 0, getContext: () => canvasAvailable ? context : null };
    const audio = {
        currentTime: 0, paused: true, plays: 0, volume: 1,
        pause() { this.paused = true; },
        play() { this.plays++; this.paused = false; return playback(); },
        addEventListener(name, callback) { events.set(name, callback); }
    };
    const environment = {
        innerWidth: 1280, innerHeight: 800, devicePixelRatio: 3,
        performance: { now: () => now },
        requestAnimationFrame(callback) { frames.set(++id, callback); return id; },
        cancelAnimationFrame(key) { frames.delete(key); },
        setTimeout(callback, delay) { timers.set(++id, { callback, time: now + delay }); return id; },
        clearTimeout(key) { timers.delete(key); }
    };
    const effects = createEffects({
        canvas, audio, theme, environment,
        onStatus: message => messages.push(message),
        onActiveChange: value => active.push(value)
    });
    function advance(ms) {
        now += ms;
        for (const [key, timer] of [...timers]) {
            if (timer.time <= now) { timers.delete(key); timer.callback(); }
        }
        for (const [key, callback] of [...frames]) { frames.delete(key); callback(now); }
    }
    return { effects, frames, timers, audio, canvas, environment, messages, active, events, advance };
}

test('each theme ends confetti at five seconds and audio at seven seconds', () => {
    for (const theme of ['winners', 'retro', 'elegant']) {
        const f = fixture(theme);
        f.effects.start({ motion: true, sound: true });
        assert.equal(f.frames.size, 1);
        assert.equal(f.timers.size, 1);
        assert.equal(f.active.at(-1), true);
        f.advance(4999);
        assert.equal(f.frames.size, 1);
        f.advance(1);
        assert.equal(f.frames.size, 0);
        assert.equal(f.audio.paused, false);
        f.advance(1999);
        assert.equal(f.audio.paused, false);
        f.advance(1);
        assert.equal(f.audio.paused, true);
        assert.equal(f.timers.size, 0);
        assert.equal(f.active.at(-1), false);
    }
});

test('replay replaces timers and frames; stop cancels everything and resets audio', () => {
    const f = fixture();
    f.effects.start({ motion: true, sound: true });
    f.advance(3000);
    for (let i = 0; i < 10; i++) f.effects.start({ motion: true, sound: true });
    assert.equal(f.frames.size, 1);
    assert.equal(f.timers.size, 1);
    f.advance(4000);
    assert.equal(f.audio.paused, false, 'old audio timeout must not stop a replay');
    f.audio.currentTime = 4;
    f.effects.stop();
    assert.equal(f.frames.size, 0);
    assert.equal(f.timers.size, 0);
    assert.equal(f.audio.currentTime, 0);
    assert.equal(f.audio.paused, true);
    assert.equal(f.active.at(-1), false);
});

test('reduced motion and silent celebration need no animation or audio work', () => {
    const f = fixture();
    f.effects.start({ motion: false, sound: false });
    assert.equal(f.frames.size, 0);
    assert.equal(f.timers.size, 0);
    assert.equal(f.audio.plays, 0);
    assert.equal(f.active.at(-1), false);
    assert.match(f.messages.at(-1), /device preference/);
});

test('sound toggle and reduced-motion changes can stop their effects independently', () => {
    const f = fixture();
    f.effects.start({ motion: true, sound: true });
    f.effects.stopSound();
    assert.equal(f.audio.paused, true);
    assert.equal(f.timers.size, 0);
    assert.equal(f.frames.size, 1);
    f.effects.start({ motion: true, sound: true });
    f.effects.stopConfetti();
    assert.equal(f.frames.size, 0);
    assert.equal(f.audio.paused, false);
    assert.equal(f.active.at(-1), true);
});

test('blocked audio and media errors are reported without stopping the visual celebration', async () => {
    const f = fixture('retro', { playback: () => Promise.reject(new Error('Playback denied')) });
    f.effects.start({ motion: true, sound: true });
    await Promise.resolve();
    assert.match(f.messages.at(-1), /Sound could not play: Playback denied/);
    assert.equal(f.timers.size, 0);
    assert.equal(f.frames.size, 1);
    assert.equal(f.audio.paused, true);
    const media = fixture();
    media.effects.start({ motion: true, sound: true });
    media.audio.error = { message: 'Audio file unavailable' };
    media.events.get('error')();
    assert.match(media.messages.at(-1), /Audio file unavailable/);
    assert.equal(media.timers.size, 0);
});

test('late rejection from cancelled playback cannot stop a newer replay', async () => {
    const rejects = [];
    const f = fixture('retro', { playback: () => new Promise((resolve, reject) => rejects.push(reject)) });
    f.effects.start({ motion: true, sound: true });
    f.effects.start({ motion: true, sound: true });
    rejects[0](new Error('Cancelled play request'));
    await Promise.resolve();
    assert.equal(f.audio.paused, false);
    assert.equal(f.timers.size, 1);
    assert.equal(f.messages.at(-1), '');
    f.effects.stop();
    rejects[1](new Error('Stopped'));
    await Promise.resolve();
    assert.equal(f.messages.at(-1), '');
});

test('ended audio cleans up its timeout; missing canvas reports a visual limitation', () => {
    const f = fixture('elegant', { canvasAvailable: false });
    f.effects.start({ motion: true, sound: true });
    assert.match(f.messages.at(-1), /confetti is unavailable/);
    assert.equal(f.frames.size, 0);
    assert.equal(f.audio.paused, false);
    f.events.get('ended')();
    assert.equal(f.timers.size, 0);
    assert.equal(f.active.at(-1), false);
});

test('resize supports high-density screens without starting another animation loop', () => {
    const f = fixture();
    f.effects.start({ motion: true, sound: false });
    assert.equal(f.canvas.width, 2560);
    assert.equal(f.canvas.height, 1600);
    f.environment.innerWidth = 320;
    f.environment.innerHeight = 568;
    f.effects.resize();
    assert.equal(f.canvas.width, 640);
    assert.equal(f.canvas.height, 1136);
    assert.equal(f.frames.size, 1);
});
