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
        text: 'Summarize the three most important things that happened today and what I learned from each.',
        tags: ['journaling', 'reflection']
      },
      {
        id: 'email-polish',
        title: 'Email Polish',
        text: 'Rewrite the following email to be more concise and professional while keeping the original intent.',
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
        text: 'Generate a 10-minute warmup routine for practicing scales and arpeggios on guitar.',
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
        text: 'Write three attention-grabbing opening lines for a 30-second video about productivity tips.',
        resultVideoUrl: 'https://www.youtube.com/shorts/F19G1zRZssQ',
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
        text: 'Create a studio product photo of [product] on a clean background. Use soft side lighting, realistic materials, and a subtle shadow. Keep the entire product visible and leave space around it for a caption. Do not add text or watermarks.',
        resultImageUrl: '',
        tags: ['product', 'photography']
      }
    ]
  },
  {
    id: 'other',
    title: 'Other',
    icon: 'sparkles',
    tone: 'yellow',
    prompts: []
  }
];