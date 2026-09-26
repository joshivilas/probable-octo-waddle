const ColorContrast = (() => {
    function parse(value) {
        if (!/^#(?:[a-f\d]{6}|[a-f\d]{8})$/i.test(value)) {
            throw new Error('Enter a six-digit HEX or eight-digit ARGB color.');
        }
        const rgb = value.slice(-6);
        return {
            r: parseInt(rgb.slice(0, 2), 16),
            g: parseInt(rgb.slice(2, 4), 16),
            b: parseInt(rgb.slice(4, 6), 16),
            a: value.length === 9 ? parseInt(value.slice(1, 3), 16) / 255 : 1
        };
    }

    function composite(foreground, background) {
        return {
            r: foreground.r * foreground.a + background.r * (1 - foreground.a),
            g: foreground.g * foreground.a + background.g * (1 - foreground.a),
            b: foreground.b * foreground.a + background.b * (1 - foreground.a),
            a: 1
        };
    }

    function luminance(color) {
        const linear = channel => {
            const value = channel / 255;
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
    }

    function grade(ratio) {
        return { aaNormal: ratio >= 4.5, aaLarge: ratio >= 3, aaaNormal: ratio >= 7, aaaLarge: ratio >= 4.5 };
    }

    function compare(text, background) {
        // Resolve the background onto white, then text onto that opaque result.
        const renderedBackground = composite(parse(background), parse('#FFFFFF'));
        const renderedText = composite(parse(text), renderedBackground);
        const light = luminance(renderedText);
        const dark = luminance(renderedBackground);
        const ratio = (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
        return { ratio, ...grade(ratio), text: renderedText, background: renderedBackground };
    }

    return { parse, composite, luminance, grade, compare };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ColorContrast;
}
