/* Classic-script global; also exported below for dependency-free Node tests. */
const PianoCues = (() => {
  'use strict';

  const PEAK = 0.2;
  const ATTACK = 0.01;
  const SILENT = 0.0001;
  const CUES = Object.freeze({
    correct: Object.freeze([
      Object.freeze({ type: 'sine', frequency: 880, start: 0, duration: 0.12 }),
      Object.freeze({ type: 'sine', frequency: 1318.51, start: 0.09, duration: 0.2 }),
    ]),
    wrong: Object.freeze([
      Object.freeze({ type: 'triangle', frequency: 247, glideTo: 165, start: 0, duration: 0.24 }),
    ]),
  });

  /* Schedules a short synthesized cue on an AudioContext and returns the oscillators. */
  function playCue(context, name) {
    const tones = CUES[name];
    if (!tones) throw new Error('Cue must be correct or wrong.');
    const base = context.currentTime + 0.005;
    return tones.map(tone => {
      const time = base + tone.start;
      const end = time + tone.duration;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = tone.type;
      oscillator.frequency.setValueAtTime(tone.frequency, time);
      if (tone.glideTo) oscillator.frequency.exponentialRampToValueAtTime(tone.glideTo, end);
      gain.gain.setValueAtTime(SILENT, time);
      gain.gain.exponentialRampToValueAtTime(PEAK, time + ATTACK);
      gain.gain.exponentialRampToValueAtTime(SILENT, end);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(time);
      oscillator.stop(end + 0.02);
      return oscillator;
    });
  }

  return { CUES, PEAK, playCue };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PianoCues;
}
