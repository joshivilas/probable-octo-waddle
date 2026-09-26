# probable-octo-waddle
This is static website with a collection of useful web tools, where you can declare winners name and share the link with your team.

You can use application here - https://jolly-wave-0f389ea00.2.azurestaticapps.net

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
  - Real-time tempo adjustment while playing
  - Web Audio API click sounds
  - Visual beat indicator with flash animation
  - Clean, responsive interface
  - No external dependencies
- **Usage:** Open `metronome/metronome.html` in your browser

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