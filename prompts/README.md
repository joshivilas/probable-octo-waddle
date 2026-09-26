# Prompts Library

Open `prompts.html` directly in a browser. No build or server is required.
The page shares the site's typography, navigation, and footer styles through
`../info-pages.css`. Library-specific styles stay in `prompts.html`.

## Add Content

Edit `prompt-data.js`; no HTML or rendering changes are needed.

- Each category needs a unique `id` (reserve `all`), a `title`, and a `prompts` array.
- Optional `icon` is a Lucide icon name; the default is `files`.
- Optional `tone` is `mint`, `coral`, `lilac`, or `yellow`; the default is mint.
- Each prompt needs a stable `id` unique within its category, a `title`, and `text`.
- Optional `tags` is an array of strings, displayed on the card and included in search.
- Optional `resultVideoUrl` on prompts in the `video` category links to the resulting video. Set it to a full `https://` or `http://` URL; the card shows a "View result" link that opens in a new tab. Leave it empty or omit it to hide the link. Invalid URLs and other protocols are not rendered.
- Optional `resultImageUrl` on prompts in the `image` category links to a resulting image or its public viewing page. It follows the same URL validation and new-tab behavior as video links. Leave it empty or omit it until a result is available.
- Use lowercase hyphenated IDs. Keep existing IDs stable when revising copy.
- Array order sets collection order. The title sort is available independently.

Example entry inside a category's `prompts` array:

```js
{
  id: 'meeting-summary',
  title: 'Meeting Summary',
  text: 'Summarize these meeting notes into decisions, open questions, and action items.\nNotes: [paste notes here]',
  tags: ['meetings', 'summary']
}
```

Add a category by appending an object with the same shape to `promptCategories`.
Category buttons, counts, search, and cards update automatically. Empty categories
remain selectable with an empty state, but do not create blank sections in All prompts.
Long prompt text is displayed in full; line breaks are preserved. Values are rendered
as plain text, not HTML. Add useful, reviewed content rather than placeholder cards.

## Checks After Editing

- Run `node --check prompts/prompt-data.js` and `node --check prompts/prompts.js` from the repository root.
- Verify category counts, search by title/text/tag, combined category and search, title sorting, and reset.
- Test copying from a focused browser tab. Clipboard permissions may depend on the browser and origin; when copying fails, the text is selected for manual copying.
- Check long titles, multiline text, and new categories on mobile and desktop.

The library remains ad-free. Fonts and icons load from external providers; the
collection and navigation remain usable if those resources are blocked.