# probable-octo-waddle
This is static website with a collection of useful web tools, where you can declare winners name and share the link with your team.

You can use application here - https://octowaddle.in

## Site logo

All branded headers use [the octopus SVG](logo/octo-waddle-logo.svg), including
PicNotch and the three celebration results. The existing site/tool names and
navigation destinations are unchanged. Header images are decorative beside the
visible brand name, load without JavaScript, and scale within the existing
desktop/mobile header sizes.

Every HTML page includes [an SVG favicon](logo/favicon.svg), a
[32px PNG fallback](logo/favicon-32.png), and a
[180px Apple touch icon](logo/apple-touch-icon.png). These variants use a pale
background so the green mark remains visible on light and dark browser chrome.
The favicon artwork is derived from the SVG master; keep them in sync when
changing the design. The opaque PNG icons are composited from the matching
transparent exports over `#edf4ee`. The original SVG, transparent PNG sizes, and
concept previews remain in [logo](logo).

Run the branding, local asset path, and existing site checks with
`node --test tests/site.test.cjs`.

## Azure Functions and Application Insights

The GitHub Actions deployment publishes the static site from the repository root
and the managed Azure Functions API from [api](api). The API uses Node.js 22 and
the existing CommonJS handler with HTTP bindings in
[api/hello/function.json](api/hello/function.json).

After committing and pushing these changes to `main`:

1. Wait for the Azure Static Web Apps CI/CD workflow to deploy successfully.
2. Open https://jolly-wave-0f389ea00.2.azurestaticapps.net/api/hello and confirm
  it returns `Hello from Azure Function!`.
3. In the Azure portal, open the Static Web App, select **Application Insights**,
  set **Enable Application Insights** to **Yes**, and select **Save**.
4. Request `/api/hello` again to generate API telemetry, then allow time for
  ingestion before checking Application Insights requests and failures.

The portal integration requires at least one deployed function. A JavaScript
handler alone is insufficient: its trigger bindings must be present and the
workflow's `api_location` must point to the API folder.

This integration monitors backend API requests, not static page views or browser
errors. Frontend monitoring requires the Application Insights JavaScript SDK
configured separately. Application Insights has separate usage-based pricing.

## Tools Available

### 1. **Celebrate** 🎉
Declare winners and share celebratory messages with your team.

The winner generator uses the collection's shared header and typography, a
responsive name editor, and a live style preview. Add names with Enter or Add;
remove mistakes individually. Create a link to copy it or open the result for review.
When clipboard access fails, the visible URL is selected for manual copying.
List or style changes invalidate the generator's displayed link, not previously
shared links. Names and their order (including duplicates) are preserved.
Unicode names are represented as ASCII JSON escapes before Base64 encoding,
remaining compatible with the existing result-page decoders.

The result pages share responsive name cards and controls, with three distinct
designs: warm confetti, pixel-style retro, and midnight/gold appreciation.
Winners Display still reveals names immediately; both thank-you pages wait for
the recipient to press Start/Celebrate. Long names wrap and long lists scroll
naturally on desktop, tablets, and phones. Existing shared links still work;
missing or malformed links show a recovery message rather than an empty result.
Names are rendered as text, never HTML.

Confetti lasts five seconds, with reduced-motion preferences respected. The two
thank-you pages offer optional sound (loaded on demand, capped at seven seconds),
replay, and Stop effects. Replay replaces existing effects; hiding/leaving the
page cancels animation and audio. Playback failures are displayed without
preventing the name reveal. The shared implementation is in
[results.js](celebrate/results.js) and [results.css](celebrate/results.css).

Large tool instructions use native `details`/`summary` sections, closed by default.
They remain keyboard-accessible and readable without JavaScript. Primary content,
tool controls, and privacy/about information remain visible.

```sh
node --test celebrate/winner.test.cjs celebrate/results.test.cjs tests/site.test.cjs
```

### 2. **Color Compare** 🎨
Compare colors with contrast ratio analysis for accessibility testing.

The main tool supports HEX and alpha-first ARGB values, selectable text and
background colors, and WCAG AA/AAA text thresholds. Transparent backgrounds are
composited onto white, then text onto that background. Pass/fail uses the
unrounded ratio. Invalid selected inputs clear the result. Switching to HEX
removes alpha. Palettes are not persisted or shareable. The legacy
`color-compare2.html` URL redirects to the main tool in Azure.

Run the calculation regression tests with:

```sh
node --test color-compare/contrast.test.cjs
```

Run site-wide AdSense-loader, inline-script, sitemap, and redirect-configuration checks
alongside the calculation tests with:

```sh
node --test color-compare/contrast.test.cjs tests/site.test.cjs
```

### 3. **Metronome** 🎵
A professional metronome web app for musicians and rhythm practice.
- **Features:**
  - Adjustable BPM (30-240 beats per minute)
  - Audio-clock scheduling, cancelable clicks, live tempo/sound/volume controls
  - Tap tempo averaged over up to six recent intervals
  - 2/4, 3/4, 4/4, 5/4, and compound 6/8; first-beat accents and numbered indicators
  - Eighth notes, triplets, and sixteenth notes (6/8 uses two dotted-quarter pulses)
  - Soft click, woodblock-style (default), and beep sounds synthesized locally
  - One/two-bar count-in; elapsed timer and optional timed stop up to one hour
  - Tempo trainer with a configurable increase, bar interval, and target
  - Explicitly saved, named local presets and shareable settings links
  - Optional screen wake lock with unsupported/denied-state feedback
  - Desktop viewport-height app with scrollable settings; natural scrolling on mobile and short screens
- **Usage:** Open `metronome/metronome.html` in your browser

Space starts/stops, T taps, and arrow keys change BPM (Shift changes by five)
when focus is outside interactive controls. Inputs retain normal keyboard behavior.
Stop preserves settings, while Reset restores defaults but does not delete presets.
Each Start begins a fresh session. Count-in bars do not advance the trainer or
practice timer. The trainer holds at its target; its starting BPM is restored on
Stop. Change meter/subdivision/practice settings while stopped. Changing meter
resets subdivision to main beats. At 60 BPM in 6/8, the dotted-quarter pulse is
one second, and each bar is two seconds.

Manual BPM changes during count-in take effect when practice begins; the count-in
retains its original tempo and duration. During ordinary playback, an already
scheduled onset is retained, and the new BPM controls following intervals.

Preset storage uses `pow.metronome.presets.v1` in localStorage. Presets are saved
only on request; storage failures are shown rather than presented as successful
saves. Links carry validated versioned settings in the fragment, never preset
names, wake-lock permission, or playback state. Loading a link never starts audio.
Fonts, icons, and advertising still load from external providers; there are no
third-party audio or application dependencies.

The audio engine schedules oscillator nodes at absolute AudioContext times.
Visual callbacks cannot delay the sound. Stop cancels pending audio and visual
work. Audio interruptions or a stalled scheduler stop playback explicitly; browser
throttling, wireless output latency, and device sleep remain limitations.
Wake lock requires a supported secure context and can be denied or released by
the device; it does not guarantee background audio.

Run metronome and site regression checks:

```sh
node --test metronome/engine.test.cjs metronome/settings.test.cjs tests/site.test.cjs
```

For browser checks, verify count-in/timer/trainer boundaries, rapid Start/Stop,
muting and sound changes, invalid inputs, preset save/load/delete, settings-link
round trips, keyboard behavior, clipboard fallback, and denied/unsupported wake
lock. Check desktop at 1280x800 and 1024x650 (100vh shell, independently scrollable
settings), tablet, 320px mobile, and short landscape (page scrolling, no clipping).

### 4. **Piano Note Trainer** 🎹
A note-finding exercise for a MIDI keyboard or digital piano connected to the computer.
- **Features:**
  - Web MIDI connection with live connected/missing/blocked/unsupported status and hot-plug detection
  - Shuffled note prompts: every note appears once per cycle, and repeats are always spaced apart (mixed spelling alternates each black key's names fairly); any octave counts
  - White keys only or all 12 notes, with black keys spelled as sharps, flats, or both
  - Correct answers advance automatically; wrong answers name the key played so you can retry
  - Right/wrong feedback: ✓/✗ badge, green/red panel flash, and optional synthesized sound cues (chime / low tone)
  - Skip reveals the answer on a one-octave on-screen keyboard, which also accepts clicks
  - Score, accuracy, streak, best streak, average response time, and 10/20/50-note rounds
  - Current note set shown under the prompt; settings remembered in localStorage (`pow.pianoNotes.settings.v1`), scores never saved
- **Usage:** Open `piano-notes/piano-notes.html`, select **Connect keyboard**, allow MIDI access, and press **Start**

Space starts/stops and N skips when focus is outside interactive controls. MIDI
permission is requested only on Connect keyboard, or automatically if it was
already granted. Browsers do not remember permissions for pages opened as
`file:///` URLs, so the page shows a notice there; test through the deployed site or
a local server such as `http://localhost` to see automatic reconnection. Only note-on messages are used; system-exclusive access is not
requested, and nothing played is recorded; only the exercise settings are kept locally. Web MIDI requires a secure context (HTTPS or
localhost) and works in Chrome, Edge, Opera, and desktop Firefox. Safari and iOS
browsers fall back to the on-screen keys.

Run the exercise logic and site regression checks:

```sh
node --test piano-notes/notes.test.cjs piano-notes/cues.test.cjs tests/site.test.cjs
```

## Google Analytics

Every HTML page includes the asynchronous Google tag and a single GA4
initialization for measurement ID `G-9XEBN4MED1`. The configuration automatically
reports page views; no additional manual page-view event is sent. Enhanced
measurement options are controlled in the Google Analytics web stream settings.

After deployment, check Reports > Realtime while visiting the public site.
Use the Pages and screens report for per-page views; standard reports can take
24-48 hours to populate. These are browser-reported views, not Azure SiteHits,
and blockers or consent choices can prevent collection.

The supplied tag loads immediately. This repository does not yet implement
Analytics consent gating. Configure and verify applicable consent controls before
collecting analytics where consent is required; an AdSense consent message alone
does not guarantee that Analytics consent is wired correctly. Avoid sending
personal information in URLs, page titles, or custom events.

Run `node --test tests/site.test.cjs` to check that all pages load and initialize
the correct tag exactly once, alongside the existing site checks.

## Advertising and review readiness

Every HTML page includes the asynchronous Google AdSense loader for
`ca-pub-9788688281525825` exactly once in its head. The homepage also retains
the `google-adsense-account` verification meta tag, and `ads.txt` retains the
publisher authorization entry. The loader does not guarantee that ads appear:
serving depends on Google approval, account configuration, and consent requirements.

Before enabling ad placements:

1. Deploy and check the actual public pages, including tool results, invalid
   inputs, mobile layouts, navigation, and the legacy color-tool redirect.
2. Review original content and remove unfinished categories. Keep explanations
   accurate when tools change; do not add filler or promise unsupported features.
3. In AdSense, review Privacy & messaging and configure a Google-certified CMP
   where required for EEA, UK, and Swiss traffic. Verify consent, refusal, and
   withdrawal behavior from the applicable regions. A privacy link or an
   ordinary cookie banner is not a substitute for the required consent flow.
4. Update the privacy policy to describe the actual enabled services.
5. Request a site review in AdSense when ready. Google alone determines
   eligibility; these changes do not guarantee approval or demonstrate traffic
   quality.
6. If approved, enable ads only on individually reviewed, substantive publisher
   pages. Keep empty editors, celebration outputs, search-empty states,
   confirmation/error screens, and unfinished content ad-free. Check Auto ads
   exclusions as well as code-level placement before enabling it.

The repository does not implement a CMP or gate the loader on consent.
The loader is included even on celebration and empty-editor pages at the owner's
request; this is not a declaration that those screens are eligible for ads.
Configure and verify applicable consent handling and Auto ads exclusions before
serving ads. Account settings, consent configuration, deployment, and the review
request require the site owner's action.