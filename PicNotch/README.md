# PicNotch

Open `index.html` in a browser to edit local images and export PNG images.
Cropping, icons, and fonts currently load from external providers. Uploaded images
are processed on your device.

## Styles

- **Postcard** is the default, with the original perforated edges and paper border.
- **Polaroid** has straight edges, a wider bottom margin, and an optional caption
	of up to 60 characters. Long captions shrink to fit the frame, and text color
	adapts to the paper color.

The tabs share the uploaded image but preserve each style's crop, paper color,
border, and other settings while the page remains open. A new image clears saved
crops. Reloading the page resets the session. Use Left/Right Arrow or Home/End
when a style tab is focused to change styles with the keyboard.

Exports use `image-name-postcard.png` or `image-name-polaroid.png`, with the
longest side limited to 4096 pixels. Small screens retain scrolling to keep all
controls accessible.

## Adding a Style

`app.js` builds the tabs from its `styles` registry. Add an entry with a label,
Lucide icon, default settings, and a separate renderer returning output dimensions.
Keep the existing postcard renderer unchanged. Add the corresponding
`<style-id>-settings` section in `index.html`, and extend settings persistence,
the empty preview, and output metadata as needed for the new style.

## Regression Checks

Upload an image, edit each style, and switch back and forth. Verify that crops and
settings are restored and that the postcard preview is unchanged. Export both PNGs
and check their names, frame edges, and caption placement. Check keyboard tabs and
layouts at 320px mobile, desktop, and short landscape sizes.