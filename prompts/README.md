# Prompts Library

Open `prompts.html` directly in a browser. No build or server is required.
The page shares the site's typography, navigation, and footer styles through
`../info-pages.css`. Library-specific styles stay in `prompts.html`.

## Add Content

Edit `prompt-data.js`; no HTML or rendering changes are needed. Prefer a small
collection of complete, task-specific guides to generic one-line prompts. The five
current guides include worked inputs, illustrative results, evaluation checks,
and limitations. These illustrations are not claims of tested model output.

- Each category needs a unique `id` (reserve `all`), a `title`, and a `prompts` array.
- Optional `icon` is a Lucide icon name; the default is `files`.
- Optional `tone` is `mint`, `coral`, `lilac`, or `yellow`; the default is mint.
- Each prompt needs a stable `id` unique within its category, a `title`, and `text`.
- `text` is the actual copyable template, including bracketed input placeholders.
- Each prompt also needs `useWhen`, `inputs`, `exampleInput`, `illustrativeResult`,
  and `limitations` strings, plus a nonempty `checks` array of evaluation strings.
  These fields are guidance, never included in clipboard content.
- Optional `tags` is an array of strings, displayed on the card and included in search.
- External result links are not part of the schema. The former unverified video
  link was removed rather than implying it was produced by this template.
  Any future media feature must distinguish third-party references from actual
  outputs and record attribution and provenance.
- Use lowercase hyphenated IDs. Keep existing IDs stable when revising copy.
- Array order sets collection order. The title sort is available independently.

Example entry shape inside a category's `prompts` array (replace the editorial
placeholders with substantive content before publishing):

```js
{
  id: 'meeting-summary',
  title: 'Meeting Summary',
  text: 'Summarize these meeting notes into decisions, open questions, and action items.\nNotes: [paste notes here]',
  useWhen: 'Describe the task and when this approach is useful.',
  inputs: 'Explain what the user needs to supply and what to remove.',
  exampleInput: 'Supply a realistic, non-sensitive worked input.',
  illustrativeResult: 'Write an explicitly illustrative response to that input.',
  checks: ['Give a concrete accuracy check.', 'Explain how to judge usefulness.'],
  limitations: 'State what this prompt cannot establish or safely replace.',
  tags: ['meetings', 'summary']
}
```

Add a category by appending an object with the same shape to `promptCategories`.
Category buttons, counts, search, and cards update automatically. Empty categories
are omitted from filters and category totals, regardless of their IDs. They do not
create blank sections or unfinished-category messages. The empty state is only a
no-match message with a reset action.
Long prompt text is displayed in full; line breaks are preserved. Values are rendered
as plain text, not HTML. Native keyboard-accessible details/summary controls reveal
each worked example and review guide. Search includes all guidance, even when
collapsed, as well as category, title, template, and tags. Copy and manual-selection
fallback target only `text`. Add useful, reviewed content rather than placeholder cards.

## Checks After Editing

- Run `node --check prompts\prompt-data.js` and `node --check prompts\prompts.js` from the repository root.
- Verify category counts, search by title/text/tag/example/check/limitation, combined category and search, title sorting, and reset.
- Inject an empty category in a test fixture and confirm it creates neither a filter nor an inflated category total.
- Test copying from a focused browser tab. Clipboard permissions may depend on the browser and origin; when copying fails, the text is selected for manual copying.
- Confirm the copied/selected content equals only the template, not the guide.
- Check long titles, multiline text, and new categories on mobile and desktop;
  expand example guides with the keyboard and inspect their heading order.

The library includes the Google AdSense loader, consistent with the other HTML
pages. Ad serving depends on account approval, configuration, and applicable
consent requirements. Fonts and icons load from external providers; the
collection and navigation remain usable if those resources are blocked.