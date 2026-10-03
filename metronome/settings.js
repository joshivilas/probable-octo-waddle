const MetronomeSettings = (() => {
    const core = typeof module !== 'undefined' && module.exports ? require('./engine.js') : MetronomeCore;
    const STORAGE_KEY = 'pow.metronome.presets.v1';

    function toHash(config) {
        const settings = core.validateConfig(config);
        const params = new URLSearchParams({ v: '1' });
        for (const key of Object.keys(core.DEFAULTS)) params.set(key, String(settings[key]));
        return `#${params}`;
    }

    function fromHash(hash) {
        if (!hash || hash === '#content') return null;
        const params = new URLSearchParams(hash.replace(/^#/, ''));
        if (params.get('v') !== '1') throw new Error('This settings link has an unsupported version.');
        const result = { ...core.DEFAULTS };
        const seen = new Set();
        for (const [key, value] of params) {
            if (seen.has(key)) throw new Error(`This settings link repeats "${key}".`);
            seen.add(key);
            if (key === 'v') continue;
            if (!Object.hasOwn(core.DEFAULTS, key)) throw new Error(`Unknown setting in this link: ${key}.`);
            if (typeof core.DEFAULTS[key] === 'boolean') {
                if (value !== 'true' && value !== 'false') throw new Error(`Invalid ${key} in this link.`);
                result[key] = value === 'true';
            } else if (typeof core.DEFAULTS[key] === 'number') {
                if (!/^\d+$/.test(value)) throw new Error(`Invalid ${key} in this link.`);
                result[key] = Number(value);
            } else {
                result[key] = value;
            }
        }
        return core.validateConfig(result);
    }

    function presetName(name) {
        if (typeof name !== 'string' || !name.trim() || name.trim().length > 60) {
            throw new Error('Use a preset name between 1 and 60 characters.');
        }
        return name.trim();
    }

    function decodePresets(value) {
        if (value === null) return [];
        let data;
        try {
            data = JSON.parse(value);
        } catch {
            throw new Error('Saved presets are not valid JSON. Clear unreadable data to save new presets.');
        }
        if (!data || data.version !== 1 || !Array.isArray(data.presets)) {
            throw new Error('Saved presets have an unsupported format. Clear unreadable data to start again.');
        }
        const names = new Set();
        return data.presets.map(item => {
            if (!item || typeof item !== 'object') throw new Error('A saved preset is invalid.');
            if (!item.config || typeof item.config !== 'object' || Array.isArray(item.config)
                || Object.keys(core.DEFAULTS).some(key => !Object.hasOwn(item.config, key))) {
                throw new Error('A saved preset is missing settings. Clear unreadable data to save new presets.');
            }
            const name = presetName(item.name);
            if (names.has(name.toLowerCase())) throw new Error('Saved presets contain duplicate names.');
            names.add(name.toLowerCase());
            return { name, config: core.validateConfig(item.config) };
        });
    }

    function encodePresets(presets) {
        const value = JSON.stringify({ version: 1, presets });
        decodePresets(value);
        return value;
    }

    class TapTempo {
        constructor() {
            this.times = [];
        }
        reset() {
            this.times = [];
        }
        tap(now) {
            if (!Number.isFinite(now)) throw new Error('Tap time must be finite.');
            const previous = this.times.at(-1);
            if (previous !== undefined && now <= previous) throw new Error('Tap times must increase.');
            if (previous !== undefined && now - previous > 3000) this.reset();
            this.times.push(now);
            this.times = this.times.slice(-7);
            const count = this.times.length;
            if (count < 2) return { bpm: null, count };
            const bpm = Math.round(60000 * (count - 1) / (now - this.times[0]));
            if (bpm < 30 || bpm > 240) {
                this.times = [now];
                throw new Error('Tap a steady main beat between 30 and 240 BPM.');
            }
            return { bpm, count };
        }
    }

    return { STORAGE_KEY, toHash, fromHash, presetName, decodePresets, encodePresets, TapTempo };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = MetronomeSettings;
