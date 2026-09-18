# PicNotch

Open `index.html` in a browser to edit local images and export postcard stickers.
Cropping, icons, and fonts currently load from external providers. Uploaded images
are processed on your device.

## Google AdSense

An Advertisement section appears below the editor. Ad requests are disabled by
default; no Google advertising script is loaded until configured and enabled.

Before enabling production ads:

1. Host the app on an HTTPS website and obtain AdSense approval for that site.
2. Create a responsive display ad unit in AdSense.
3. In `index.html`, set `data-ad-client` on `#postcard-ad` to your publisher ID
   (`ca-pub-` followed by 16 digits), and `data-ad-slot` to your ad unit's numeric ID.
4. Publish the required privacy disclosures and configure consent handling for
   your audience, including a Google-certified CMP where required. Integrate any
   required consent gate before the `initializeAds()` call in `app.js`. The enable
   switch is a deployment setting, not visitor consent.
5. Add the exact `ads.txt` entry provided by your AdSense account at your site's root
   if instructed by Google. Do not invent publisher IDs or seller records.
6. Set `data-enabled="true"` on `#postcard-ad` after completing the above setup.

Live ads do not run from `file://` or HTTP pages in this implementation. Approval,
consent, ad availability, and browser blockers can affect whether an ad appears.
The editor remains usable when the ad script fails. Enabling ads introduces
requests to Google advertising services; the page is not fully offline or
tracking-free. Never click your own live ads for testing.