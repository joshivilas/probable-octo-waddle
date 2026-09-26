const promptCategories = [
  {
    id: 'text',
    title: 'Text',
    icon: 'text-cursor-input',
    tone: 'mint',
    prompts: [
      {
        id: 'daily-journal-reflection',
        title: 'Daily Journal Reflection',
        useWhen: 'Use this after a busy day when your notes mix events with interpretations. The goal is a small, evidence-based next step, not a score for how productive or positive you were.',
        inputs: 'Replace [notes] with two to six brief observations. Include what happened, what you felt, and anything still uncertain. Remove names or identifying details you do not want to send to an AI service.',
        text: `Help me reflect on these daily notes without diagnosing me or inventing motives.
Notes: [notes]

Choose up to three meaningful moments from the notes; do not pad the list if there are fewer. For each, separate:
1. What happened (only facts I supplied).
2. My reaction (use my words; mark anything else as a possible interpretation).
3. A tentative lesson, with the observation that supports it.
4. One small action I could try tomorrow.
End with one open question about an uncertainty in the notes. Avoid forced positivity and judgments about other people's intentions.`,
        exampleInput: 'Notes: I delayed sending a draft until 4 pm because I kept editing the opening. A colleague asked for it at noon. I felt embarrassed. A short walk helped me settle. I do not know whether the late draft blocked their work.',
        illustrativeResult: `Moment: Sending the draft late.
Fact: You sent it at 4 pm after repeated opening edits; a colleague had asked at noon.
Reaction: You felt embarrassed.
Tentative lesson: Editing the opening may have delayed useful feedback; the repeated edits and timing support this possibility.
Next step: Tomorrow, agree on a time to share a rough version before polishing it.
Open question: Did your colleague need the draft at noon to continue their work?`,
        checks: ['Compare every stated fact with your notes. Delete invented emotions, causes, or claims about your colleague.', 'Make the next step something you control. “Ask when the draft is needed” is more actionable than “stop disappointing people.”'],
        limitations: 'This is a reflection aid, not therapy or a mental-health assessment. Sparse notes cannot establish why an event happened. Reject an interpretation that does not fit your experience.',
        tags: ['journaling', 'reflection']
      },
      {
        id: 'email-polish',
        title: 'Email Polish',
        useWhen: 'Use this when an email has a clear request but buries it in background. It is designed to preserve commitments and uncertainty rather than make every message sound more confident.',
        inputs: 'Supply the recipient relationship, desired tone, original email, and facts that must not change. Use placeholders for customer names, private addresses, and confidential project details.',
        text: `Edit this email for clarity, preserving its intent.
Recipient and relationship: [recipient]
Tone: [tone]
Facts, dates, amounts, and commitments that must not change: [fixed details]
Original email:
[email]

Return a subject line and a concise email with the main request near the top. Preserve all deadlines, qualifications, and uncertainty. Do not add promises, apologies, urgency, or facts. If an important detail is ambiguous, flag it after the draft instead of guessing. Then list the substantive changes so I can check them before sending.`,
        exampleInput: `Recipient: A teammate coordinating a launch
Tone: Direct and friendly
Fixed details: Feedback requested by Tuesday at 2 pm; launch date is not yet confirmed
Email: Hi, I know there are several things going on and I wanted to send over the attached checklist. The launch date is still not confirmed. If you can take a look and let me know if any steps are missing by Tuesday at 2 pm, that would help. Thanks.`,
        illustrativeResult: `Subject: Checklist feedback by Tuesday at 2 pm
Hi,
Please review the attached checklist and let me know if any steps are missing by Tuesday at 2 pm. The launch date is still unconfirmed.
Thanks.

Changes: Moved the request first; removed the general preamble; retained the feedback deadline and unconfirmed launch date.
Review note: Specify a calendar date and time zone if Tuesday at 2 pm could be ambiguous to the recipient.`,
        checks: ['Compare names, numbers, dates, and promises with the original before sending. Confirm that any referenced attachment is actually attached.', 'Read the draft as the recipient: is it clear what they should do and when, without implying a confirmed launch?'],
        limitations: 'An editor cannot know your relationship norms or contractual context. For sensitive or legal correspondence, get appropriate human review; concise wording is not automatically safer wording.',
        tags: ['email', 'editing']
      }
    ]
  },
  {
    id: 'music',
    title: 'Music',
    icon: 'music-2',
    tone: 'lilac',
    prompts: [
      {
        id: 'practice-warmup',
        title: 'Practice Warmup',
        useWhen: 'Use this to plan a short, gentle guitar session around patterns you already know. A fixed time budget prevents a warmup from quietly becoming a demanding technique workout.',
        inputs: 'Name your experience level, a familiar scale and chord, and a tempo that already feels easy. Ask a teacher for a suitable starting pattern if you do not know one; do not use the model to assess pain or injury.',
        text: `Plan a gentle 10-minute guitar warmup.
Experience: [level]
Known scale and position: [scale]
Known chord or arpeggio: [chord]
Comfortable starting tempo: [BPM]
Today's focus: [focus]

Use only the patterns I supplied. Give timed blocks that total exactly 10 minutes, including short rests and transitions. State note value, tempo, and one listening or relaxation cue per playing block. Favor clean, relaxed notes over speed; do not schedule automatic tempo increases. Include an easier variation. Remind me to stop if I feel pain, numbness, or increasing strain. If my inputs are insufficient, ask for the missing pattern rather than inventing my skill level.`,
        exampleInput: 'Level: Beginner who knows open-position C major. Scale: C major, one octave from string 5 fret 3 to string 2 fret 1. Chord: Open C, familiar picking order 5–4–3–2–3–4. Tempo: 60 BPM. Focus: Even volume with relaxed hands.',
        illustrativeResult: `0:00–1:00 — Set a 60 BPM metronome; check comfortable posture and loosen your grip.
1:00–4:00 — Play the known C scale up and down in quarter notes, one note per click. Listen for even volume.
4:00–4:30 — Rest and release both hands.
4:30–7:30 — Pick the supplied open-C string order in quarter notes at 60 BPM. Use only enough pressure for a clear note.
7:30–8:00 — Rest and switch back to the scale.
8:00–10:00 — Repeat the scale at 60 BPM in quarter notes; notice whether your grip stays relaxed.
Easier variation: Use half notes, one note every two clicks, without extending the blocks. Stop for pain, numbness, or increasing strain.`,
        checks: ['Add the blocks, rests included: 1 + 3 + 0.5 + 3 + 0.5 + 2 = 10 minutes.', 'Try a few notes at the suggested pace. If they are uneven or tense, slow down or simplify rather than chasing the timer.'],
        limitations: 'A text plan cannot see posture, hear technique, or establish a safe tempo for you. This is not injury treatment; persistent discomfort calls for appropriate professional advice, not a harder warmup.',
        tags: ['guitar', 'practice']
      }
    ]
  },
  {
    id: 'video',
    title: 'Video',
    icon: 'clapperboard',
    tone: 'coral',
    prompts: [
      {
        id: 'short-form-hook',
        title: 'Short-Form Hook',
        useWhen: 'Use this when you have one useful demonstration for a short video but no clear opening. A good hook names a recognizable problem and earns its promise in the footage, rather than claiming a dramatic productivity transformation.',
        inputs: 'Describe the audience, one practical tip, footage you can actually show, and claims you can support. A small observable change is a better input than an unsupported promise to save hours.',
        text: `Write three distinct openings for a 30-second video.
Audience: [audience]
One tip: [tip]
Available demonstration footage: [footage]
Supported claims and boundaries: [claims]

For each opening, provide a spoken hook of at most 12 words, a matching first shot, and the specific payoff the viewer will see. Use a question, a contrast, and a direct demonstration as the three approaches. Avoid invented statistics, guaranteed outcomes, and shame. Choose the opening best supported by the available footage and explain why. Sketch a 0–5, 5–20, and 20–30 second outline that delivers its promise.`,
        exampleInput: 'Audience: Students returning to an essay after a break. Tip: Leave a one-sentence note naming the next concrete step before closing the document. Footage: A mock essay with “Next: add one example to paragraph two,” closing the laptop, reopening and following the note. Claims: This gives a visible restart cue; no measured time savings.',
        illustrativeResult: `Question: “Back from a break and unsure where to start?”
First shot: Reopen the mock essay. Payoff: Show a specific next-step note.
Contrast: “Leave yourself a next step, not just an open tab.”
First shot: Compare a blank tab with the note. Payoff: Show what makes the note actionable.
Demonstration: “Before closing your essay, write this one-line restart note.”
First shot: Type the note. Payoff: Reopen and add the example it names.

Choice: Demonstration, because the available footage shows the entire action.
0–5 seconds: Speak the hook while typing the note.
5–20 seconds: Close and reopen the document; highlight “paragraph two” and add an example.
20–30 seconds: Explain that a useful note names an action and a location. Invite viewers to write their own.`,
        checks: ['Count the spoken hook words, then read the whole planned voiceover aloud against a timer. A three-block outline is not proof that your script fits 30 seconds.', 'Check that every promised payoff appears in the shots you can make. Remove statistics or savings claims without evidence.'],
        limitations: 'These are writing examples, not tested hooks or evidence of audience performance. No external video is presented as an output of this prompt. Use your own or properly licensed footage and avoid exposing real student work.',
        tags: ['short-form', 'ideas']
      }
    ]
  },
  {
    id: 'image',
    title: 'Image',
    icon: 'image',
    tone: 'yellow',
    prompts: [
      {
        id: 'product-photo',
        title: 'Product Photo',
        useWhen: 'Use this for a product-image concept when you need to communicate framing, material, and caption space. Separate physical product facts from art direction so an attractive image does not silently redesign the item.',
        inputs: 'Describe the product geometry, material, finish, color, viewpoint, background, and intended crop. If the tool supports reference images, supply one you have permission to use and state which features must match.',
        text: `Create a studio-style product image concept.
Product and physical details to preserve: [product details]
Reference image, if supported: [reference or none]
Viewpoint: [viewpoint]
Background: [background]
Aspect ratio and caption space: [layout]

Keep the entire product visible with soft light from the upper left and a subtle contact shadow. Render the specified materials realistically. Preserve the product's shape, proportions, and listed features; do not add accessories, branding, or decorative details. Leave the requested caption area visually quiet. Do not generate text or watermarks. If no reference is supplied, treat this as a concept, not an exact depiction of a real product.`,
        exampleInput: 'Product: Unbranded cylindrical sage-green ceramic mug, matte glaze, one rounded handle on the right, no lid, no saucer. Reference: None. Viewpoint: Slightly elevated three-quarter view showing the opening. Background: Warm off-white. Layout: Square crop, mug in the left two-thirds, right third clear for a caption added later.',
        illustrativeResult: 'Target composition (written description, not a generated image): A single matte sage mug sits fully inside a square frame. Its opening is visible, the right-side handle connects at two plausible points, and a soft shadow anchors the base. The right third is quiet off-white space. There is no lettering, lid, saucer, or extra handle.',
        checks: ['Inspect the rim, handle attachments, base, and shadow at full size. Reject warped geometry or added accessories even when the lighting looks convincing.', 'Preview the intended crop with your real caption overlaid. Compare color and proportions with a reference before using the image to represent a real item.'],
        limitations: 'Image tools may ignore layout constraints and alter geometry, branding, or color. This example is an art-direction target, not a tested output. A synthetic concept does not prove product accuracy; use verified photography where customers need an exact depiction.',
        tags: ['product', 'photography']
      }
    ]
  }
];