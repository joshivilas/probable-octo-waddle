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

test('every HTML page loads and initializes the requested GA4 tag exactly once in its head', () => {
    const measurementId = 'G-9XEBN4MED1';
    for (const file of htmlFiles(root)) {
        const source = fs.readFileSync(file, 'utf8');
        const head = source.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
        assert.ok(head, file);
        const loaders = [...source.matchAll(/<script\b[^>]*\bsrc=["']https:\/\/www\.googletagmanager\.com\/gtag\/js[^"']*["'][^>]*>/gi)];
        assert.equal(loaders.length, 1, file);
        const loader = loaders[0][0];
        assert.ok(head[1].includes(loader), file);
        assert.match(loader, /\basync\b/, file);
        const url = new URL(loader.match(/\bsrc=["']([^"']+)["']/i)[1]);
        assert.equal(url.searchParams.get('id'), measurementId, file);

        const initializers = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
            .filter(match => /\bgtag\s*\(\s*['"]config['"]/.test(match[1]));
        assert.equal(initializers.length, 1, file);
        assert.ok(head[1].includes(initializers[0][0]), file);
        const context = vm.createContext({});
        vm.runInContext('window = globalThis; dataLayer = ["existing event"];', context);
        vm.runInContext(initializers[0][1], context, { filename: file });
        assert.equal(context.dataLayer[0], 'existing event', file);
        const events = Array.from(context.dataLayer).slice(1).map(event => Array.from(event));
        assert.equal(events.length, 2, file);
        assert.equal(events[0][0], 'js', file);
        assert.ok(Number.isFinite(Number(events[0][1])), file);
        assert.deepEqual(events[1], ['config', measurementId], file);
    }
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

test('all branded headers use the local octopus logo without changing names or navigation', () => {
    const legacy = path.join(root, 'color-compare', 'color-compare2.html');
    for (const file of htmlFiles(root).filter(file => file !== legacy)) {
        const source = fs.readFileSync(file, 'utf8');
        const brands = [...source.matchAll(/<a\b([^>]*\bclass="brand"[^>]*)>([\s\S]*?)<\/a>/g)];
        assert.equal(brands.length, 1, file);
        const [, attributes, content] = brands[0];
        const images = [...content.matchAll(/<img\b[^>]*>/g)];
        assert.equal(images.length, 1, file);
        const image = images[0][0];
        const src = image.match(/\bsrc="([^"]+)"/)?.[1];
        assert.ok(src, file);
        assert.equal(path.resolve(path.dirname(file), src), path.join(root, 'logo', 'octo-waddle-logo.svg'), file);
        assert.ok(fs.existsSync(path.resolve(path.dirname(file), src)), file);
        assert.match(image, /\balt=""/, file);
        assert.match(image, /\bwidth="40"/, file);
        assert.match(image, /\bheight="40"/, file);
        assert.doesNotMatch(content, /data-lucide=|✳/, file);
        const picNotch = file === path.join(root, 'PicNotch', 'index.html');
        const href = picNotch ? './index.html' : path.dirname(file) === root ? 'index.html' : '../index.html';
        assert.ok(attributes.includes(`href="${href}"`), file);
        assert.ok(content.includes(picNotch ? 'PicNotch' : 'Probable<br>Octo Waddle'), file);
    }
});

test('every page has local SVG, PNG, and Apple icons with correct asset paths', () => {
    const expected = [
        { rel: 'icon', type: 'image/png', sizes: '32x32', name: 'favicon-32.png' },
        { rel: 'icon', type: 'image/svg+xml', sizes: 'any', name: 'favicon.svg' },
        { rel: 'apple-touch-icon', sizes: '180x180', name: 'apple-touch-icon.png' }
    ];
    for (const file of htmlFiles(root)) {
        const source = fs.readFileSync(file, 'utf8');
        const head = source.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)[1];
        const icons = [...head.matchAll(/<link\b[^>]*>/g)]
            .map(([tag]) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value])))
            .filter(attributes => ['icon', 'apple-touch-icon'].includes(attributes.rel));
        assert.equal(icons.length, expected.length, file);
        for (const icon of expected) {
            const matches = icons.filter(attributes => attributes.rel === icon.rel && attributes.sizes === icon.sizes);
            assert.equal(matches.length, 1, `${file}: ${icon.name}`);
            const attributes = matches[0];
            if (icon.type) assert.equal(attributes.type, icon.type, file);
            assert.ok(attributes.href, file);
            const asset = path.resolve(path.dirname(file), attributes.href);
            assert.equal(asset, path.join(root, 'logo', icon.name), file);
            assert.ok(fs.existsSync(asset), asset);
        }
    }
});

test('browser icons preserve the master artwork and declare real PNG dimensions', () => {
    const master = fs.readFileSync(path.join(root, 'logo', 'octo-waddle-logo.svg'), 'utf8');
    const favicon = fs.readFileSync(path.join(root, 'logo', 'favicon.svg'), 'utf8');
    const paths = svg => [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map(match => match[1]);
    const circles = svg => [...svg.matchAll(/<circle\b[^>]*>/g)].map(match => match[0]);
    assert.deepEqual(paths(favicon), paths(master));
    assert.deepEqual(circles(favicon), circles(master));
    assert.match(favicon, /viewBox="0 0 256 256"/);
    assert.match(favicon, /<rect width="256" height="256" rx="48" fill="#edf4ee"/);
    for (const [name, size] of [['favicon-32.png', 32], ['apple-touch-icon.png', 180]]) {
        const png = fs.readFileSync(path.join(root, 'logo', name));
        assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', name);
        assert.equal(png.readUInt32BE(16), size, name);
        assert.equal(png.readUInt32BE(20), size, name);
    }
});

test('instruction sections are native disclosures closed by default', () => {
    const guides = [
        ['index.html', /\binstruction-guide\b/],
        [path.join('color-compare', 'color-compare.html'), /\binstruction-guide\b/],
        [path.join('prompts', 'prompts.html'), /\binstruction-guide\b/],
        [path.join('celebrate', 'Celebrate-winner.html'), /\binstruction-guide\b/],
        [path.join('PicNotch', 'index.html'), /\bstudio-guide\b/],
        [path.join('metronome', 'metronome.html'), /\bguideDetails\b/],
        [path.join('piano-notes', 'piano-notes.html'), /\bguideDetails\b/]
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

test('Azure routes are unique after trailing-slash normalization and short links point to real pages', () => {
    const config = JSON.parse(fs.readFileSync(path.join(root, 'staticwebapp.config.json'), 'utf8'));
    const normalized = config.routes.map(item => item.route.toLowerCase().replace(/\/+$/, '') || '/');
    assert.equal(new Set(normalized).size, normalized.length, `duplicate routes: ${normalized.join(', ')}`);
    for (const item of config.routes.filter(route => route.redirect)) {
        assert.ok(fs.existsSync(path.join(root, item.redirect.slice(1))), item.redirect);
    }
    const piano = config.routes.find(item => item.route === '/piano-notes');
    assert.equal(piano.redirect, '/piano-notes/piano-notes.html');
    assert.equal(piano.statusCode, 301);
});
