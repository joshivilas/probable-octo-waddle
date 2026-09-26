(() => {
  const loadStatus = document.getElementById('load-status');
  if (typeof promptCategories === 'undefined') {
    loadStatus.textContent = 'The collection could not load. Please reload the page.';
    return;
  }

  const searchInput = document.getElementById('prompt-search');
  const sortInput = document.getElementById('prompt-sort');
  const promptList = document.getElementById('prompt-list');
  const categoryFilters = document.getElementById('category-filters');
  const copyStatus = document.getElementById('copy-status');
  const visibleCategories = promptCategories.filter(category => category.prompts.length > 0);
  const entries = visibleCategories.flatMap(category => category.prompts.map(prompt => ({ category, prompt })));
  let activeCategory = 'all';

  function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
  }

  function createIcon(name) {
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', name);
    icon.setAttribute('aria-hidden', 'true');
    return icon;
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function createCategoryButton(id, title, icon, count) {
    const button = createElement('button', 'category-button');
    button.type = 'button';
    button.dataset.category = id;
    button.setAttribute('aria-label', `${title}, ${count} ${count === 1 ? 'prompt' : 'prompts'}`);
    button.append(createIcon(icon), createElement('span', 'category-name', title), createElement('span', 'category-count', count));
    button.addEventListener('click', () => {
      activeCategory = id;
      renderPrompts();
    });
    return button;
  }

  function createGuidanceSection(heading, content) {
    const section = createElement('div', 'prompt-guidance');
    section.append(createElement('h4', '', heading), createElement('p', '', content));
    return section;
  }

  function createPromptCard({category, prompt}) {
    const card = createElement('article', 'prompt-card');
    card.dataset.tone = category.tone || 'mint';
    const titleId = `prompt-${category.id}-${prompt.id}`;
    card.setAttribute('aria-labelledby', titleId);
    const topLine = createElement('div', 'prompt-topline');
    const icon = createElement('span', 'prompt-icon');
    icon.append(createIcon(category.icon || 'files'));
    topLine.append(icon, createElement('span', 'prompt-category', category.title));
    const title = createElement('h3', 'prompt-title', prompt.title);
    title.id = titleId;
    const text = createElement('p', 'prompt-text', prompt.text);
    const tags = createElement('ul', 'prompt-tags');
    tags.setAttribute('aria-label', 'Topics');
    (prompt.tags || []).forEach(tag => tags.append(createElement('li', '', tag)));
    const actions = createElement('div', 'prompt-actions');
    const state = createElement('span', 'copy-state', 'Ready to copy');
    const copyButton = createElement('button', 'copy-button');
    copyButton.type = 'button';
    copyButton.setAttribute('aria-label', `Copy ${prompt.title}`);
    copyButton.dataset.tooltip = 'Copy prompt';
    copyButton.append(createIcon('copy'));
    copyButton.addEventListener('click', async () => {
      copyButton.disabled = true;
      state.textContent = 'Copying...';
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(prompt.text);
        state.textContent = 'Copied to clipboard';
        copyButton.dataset.tooltip = 'Copy again';
        copyButton.replaceChildren(createIcon('check'));
        copyStatus.textContent = `${prompt.title} copied to clipboard.`;
      } catch {
        const range = document.createRange();
        range.selectNodeContents(text);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        state.textContent = 'Copy unavailable. Text selected.';
        copyStatus.textContent = `Could not copy ${prompt.title}. The prompt text is selected for manual copying.`;
      } finally {
        copyButton.disabled = false;
        refreshIcons();
      }
    });
    actions.append(state, copyButton);
    card.append(topLine, title);
    card.append(createGuidanceSection('When to use it', prompt.useWhen));
    card.append(createGuidanceSection('Prepare your input', prompt.inputs));
    card.append(createElement('h4', 'template-heading', 'Prompt template'), text);
    card.append(actions);
    const guide = createElement('details', 'prompt-example');
    guide.append(createElement('summary', '', `Example and review guide: ${prompt.title}`));
    guide.append(createGuidanceSection('Example input', prompt.exampleInput));
    guide.append(createGuidanceSection('Illustrative result — not a tested AI output', prompt.illustrativeResult));
    const checks = createElement('div', 'prompt-guidance');
    const checklist = createElement('ul', 'prompt-checks');
    prompt.checks.forEach(check => checklist.append(createElement('li', '', check)));
    checks.append(createElement('h4', '', 'How to evaluate the response'), checklist);
    guide.append(checks, createGuidanceSection('Limitations', prompt.limitations));
    card.append(guide, tags);
    return card;
  }

  function renderPrompts() {
    const terms = searchInput.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const selectedCategory = visibleCategories.find(category => category.id === activeCategory);
    const matches = entries.filter(({category, prompt}) => {
      const searchText = [
        category.title, prompt.title, prompt.text, prompt.useWhen, prompt.inputs,
        prompt.exampleInput, prompt.illustrativeResult, prompt.limitations,
        ...prompt.checks, ...(prompt.tags || [])
      ].join(' ').toLowerCase();
      return (activeCategory === 'all' || category.id === activeCategory) && terms.every(term => searchText.includes(term));
    });
    if (sortInput.value === 'title') matches.sort((first, second) => first.prompt.title.localeCompare(second.prompt.title));
    const fragment = document.createDocumentFragment();
    matches.forEach(entry => fragment.append(createPromptCard(entry)));
    promptList.replaceChildren(fragment);
    categoryFilters.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === activeCategory)));
    document.getElementById('results-title').textContent = selectedCategory ? `${selectedCategory.title} prompts` : 'All prompts';
    document.getElementById('result-count').textContent = `${matches.length} ${matches.length === 1 ? 'prompt' : 'prompts'}`;
    document.getElementById('empty-state').hidden = matches.length !== 0;
    refreshIcons();
  }

  categoryFilters.append(createCategoryButton('all', 'All prompts', 'layout-grid', entries.length));
  visibleCategories.forEach(category => categoryFilters.append(createCategoryButton(category.id, category.title, category.icon || 'files', category.prompts.length)));
  searchInput.addEventListener('input', renderPrompts);
  sortInput.addEventListener('change', renderPrompts);
  document.getElementById('reset-filters').addEventListener('click', () => {
    activeCategory = 'all';
    searchInput.value = '';
    sortInput.value = 'collection';
    renderPrompts();
    searchInput.focus();
  });
  document.getElementById('library-total').textContent = `${entries.length} ${entries.length === 1 ? 'prompt' : 'prompts'} / ${visibleCategories.length} categories`;
  renderPrompts();
  document.getElementById('library').hidden = false;
  loadStatus.hidden = true;
})();