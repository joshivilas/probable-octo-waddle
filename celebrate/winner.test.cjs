const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildLink, styles } = require('./winner.js');

test('each celebration uses its existing route and decoder, preserving order and duplicates', () => {
    const names = ['Alex', 'Sam', 'Alex'];
    for (const style of Object.keys(styles)) {
        const url = new URL(buildLink(names, style, 'https://example.com/celebrate/Celebrate-winner.html?test=1#old'));
        assert.equal(url.pathname, `/celebrate/${style}`);
        assert.equal(url.search, '');
        assert.deepEqual(JSON.parse(atob(decodeURIComponent(url.hash.slice(1)))), names);
    }
});

test('Unicode, quotes, backslashes, and markup remain names in the legacy decoder', () => {
    const names = ['\u4f60\u597d', '\u091c\u0940\u0924', '\ud83c\udfc6', 'Zo\u00eb', 'Line\nTwo', '"Quoted" \\ Name', '<img src=x onerror=alert(1)>'];
    const url = new URL(buildLink(names, 'winners.html', 'https://example.com/celebrate/Celebrate-winner.html'));
    assert.deepEqual(JSON.parse(atob(decodeURIComponent(url.hash.slice(1)))), names);
});

test('file previews keep relative result routes', () => {
    const url = new URL(buildLink(['Alex'], 'octo.html', 'file:///C:/site/celebrate/Celebrate-winner.html'));
    assert.equal(url.protocol, 'file:');
    assert.equal(url.pathname, '/C:/site/celebrate/octo.html');
});

test('empty names and unsupported result routes fail explicitly', () => {
    for (const names of [[], null, [''], ['  '], [42]]) {
        assert.throws(() => buildLink(names, 'winners.html', 'https://example.com/'));
    }
    for (const style of ['https://elsewhere.example/', '../index.html', 'toString']) {
        assert.throws(() => buildLink(['Alex'], style, 'https://example.com/'), /available celebration styles/);
    }
});
