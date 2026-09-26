const { test } = require('node:test');
const assert = require('node:assert/strict');
const contrast = require('./contrast.js');

test('black and white have the exact maximum ratio and pass every text threshold', () => {
    const result = contrast.compare('#000000', '#FFFFFF');
    assert.equal(result.ratio, 21);
    for (const key of ['aaNormal', 'aaLarge', 'aaaNormal', 'aaaLarge']) assert.equal(result[key], true);
    assert.equal(contrast.compare('#FFFFFF', '#000000').ratio, 21);
});

test('identical colors fail all text thresholds', () => {
    const result = contrast.compare('#667EEA', '#667EEA');
    assert.equal(result.ratio, 1);
    for (const key of ['aaNormal', 'aaLarge', 'aaaNormal', 'aaaLarge']) assert.equal(result[key], false);
});

test('WCAG thresholds use the full ratio, never the rounded display', () => {
    for (const [key, threshold] of Object.entries({ aaNormal: 4.5, aaLarge: 3, aaaNormal: 7, aaaLarge: 4.5 })) {
        assert.equal(contrast.grade(threshold - 0.0001)[key], false);
        assert.equal(contrast.grade(threshold)[key], true);
    }
    const result = contrast.compare('#777777', '#FFFFFF');
    assert.ok(result.ratio > 4.47 && result.ratio < 4.48);
    assert.equal(result.aaNormal, false);
    assert.equal(result.aaLarge, true);
});

test('ARGB is alpha-first and composited in layer order', () => {
    assert.equal(contrast.compare('#00000000', '#FFFFFF').ratio, 1);
    assert.equal(contrast.compare('#FF000000', '#00FFFFFF').ratio, 21);
    const result = contrast.compare('#80000000', '#80000000');
    assert.equal(result.background.r, 127);
    assert.ok(Math.abs(result.text.r - 127 * 127 / 255) < 1e-10);
    assert.ok(result.ratio > 2 && result.ratio < 3);
    assert.equal(contrast.compare('#000000', '#80000000').background.r, 127);
});

test('invalid colors fail explicitly', () => {
    for (const value of ['', '#123', '#GGGGGG', '#1234567', '123456', '#FFFFFFjunk']) {
        assert.throws(() => contrast.compare(value, '#FFFFFF'), /HEX.*ARGB/);
    }
});
