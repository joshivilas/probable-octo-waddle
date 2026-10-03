const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function htmlFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') return [];
        const file = path.join(directory, entry.name);
        return entry.isDirectory() ? htmlFiles(file) : entry.name.endsWith('.html') ? [file] : [];
    });
}

test('every HTML page includes the requested AdSense loader exactly once in its head', () => {
    const loader = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9788688281525825" crossorigin="anonymous"></script>';
    for (const file of htmlFiles(root)) {
        const source = fs.readFileSync(file, 'utf8');
        const head = source.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
        assert.ok(head, file);
        assert.ok(head[1].includes(loader), file);
        assert.equal((source.match(/<script\b[^>]*\bsrc=["'][^"']*adsbygoogle\.js[^"']*["'][^>]*>/gi) || []).length, 1, file);
    }
    const homepage = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(homepage, /<meta name="google-adsense-account" content="ca-pub-9788688281525825">/);
    assert.match(fs.readFileSync(path.join(root, 'ads.txt'), 'utf8'), /google\.com,\s*pub-9788688281525825,\s*DIRECT/);
});

test('inline JavaScript remains syntactically valid on all pages', () => {
    for (const file of htmlFiles(root)) {
        const source = fs.readFileSync(file, 'utf8');
        for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
            if (/\bsrc\s*=|\btype\s*=\s*["']application\/ld\+json/i.test(match[1])) continue;
            assert.doesNotThrow(() => new vm.Script(match[2], { filename: file }));
        }
    }
});

test('instruction sections are native disclosures closed by default', () => {
    const guides = [
        ['index.html', /\binstruction-guide\b/],
        [path.join('color-compare', 'color-compare.html'), /\binstruction-guide\b/],
        [path.join('prompts', 'prompts.html'), /\binstruction-guide\b/],
        [path.join('celebrate', 'Celebrate-winner.html'), /\binstruction-guide\b/],
        [path.join('PicNotch', 'index.html'), /\bstudio-guide\b/],
        [path.join('metronome', 'metronome.html'), /\bguideDetails\b/]
    ];
    for (const [relative, marker] of guides) {
        const source = fs.readFileSync(path.join(root, relative), 'utf8');
        const attributes = [...source.matchAll(/<details\b([^>]*)>/gi)].map(match => match[1]);
        assert.ok(attributes.some(value => marker.test(value)), `${relative} has a collapsible guide`);
        for (const value of attributes) {
            assert.doesNotMatch(value, /(?:^|\s)open(?:\s|=|$)/i, `${relative} defaults to collapsed`);
        }
    }
});

test('sitemap destinations exist and exclude celebration-only outputs', () => {
    const source = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
    for (const match of source.matchAll(/<loc>(.*?)<\/loc>/g)) {
        const url = new URL(match[1]);
        const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        assert.ok(fs.existsSync(path.join(root, relative)), relative);
        assert.doesNotMatch(relative, /celebrate\/(?:winners|octo|waddle)\.html/);
    }
    for (const name of ['winners', 'octo', 'waddle']) {
        const page = fs.readFileSync(path.join(root, 'celebrate', `${name}.html`), 'utf8');
        assert.match(page, /<meta name="robots" content="noindex, follow">/);
    }
});

test('legacy color page redirects to the maintained tool in Azure configuration', () => {
    const config = JSON.parse(fs.readFileSync(path.join(root, 'staticwebapp.config.json'), 'utf8'));
    const route = config.routes.find(item => item.route === '/color-compare/color-compare2.html');
    assert.equal(route.redirect, '/color-compare/color-compare.html');
    assert.equal(route.statusCode, 301);
    assert.equal(config.platform.apiRuntime, 'node:22');
});
