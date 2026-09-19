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