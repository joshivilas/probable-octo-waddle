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
  const entries = promptCategories.flatMap(category => category.prompts.map(prompt => ({ category, prompt })));
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

  function createResultLink(prompt, resultUrl, iconName) {
    let url;
    try {
      url = new URL(resultUrl);
    } catch {
      return null;
    }
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    const link = createElement('a', 'result-link');
    link.href = url.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `View result for ${prompt.title} (opens in a new tab)`);
    link.append(createIcon(iconName), createElement('span', '', 'View result'), createIcon('arrow-up-right'));
    return link;
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
    card.append(topLine, title, text, tags);
    if (category.id === 'video' || category.id === 'image') {
      const isVideo = category.id === 'video';
      const resultLink = createResultLink(prompt, isVideo ? prompt.resultVideoUrl : prompt.resultImageUrl, isVideo ? 'play' : 'image');
      if (resultLink) card.append(resultLink);
    }
    card.append(actions);
    return card;
  }

  function renderPrompts() {
    const terms = searchInput.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const selectedCategory = promptCategories.find(category => category.id === activeCategory);
    const matches = entries.filter(({category, prompt}) => {
      const searchText = [category.title, prompt.title, prompt.text, ...(prompt.tags || [])].join(' ').toLowerCase();
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
    document.getElementById('empty-title').textContent = !terms.length && selectedCategory ? 'This category is still growing' : 'No matching prompts';
    document.getElementById('empty-description').textContent = !terms.length && selectedCategory ? `No prompts have been added to ${selectedCategory.title} yet.` : 'Nothing in this selection matches your search.';
    refreshIcons();
  }

  categoryFilters.append(createCategoryButton('all', 'All prompts', 'layout-grid', entries.length));
  promptCategories.forEach(category => categoryFilters.append(createCategoryButton(category.id, category.title, category.icon || 'files', category.prompts.length)));
  searchInput.addEventListener('input', renderPrompts);
  sortInput.addEventListener('change', renderPrompts);
  document.getElementById('reset-filters').addEventListener('click', () => {
    activeCategory = 'all';
    searchInput.value = '';
    sortInput.value = 'collection';
    renderPrompts();
    searchInput.focus();
  });
  document.getElementById('library-total').textContent = `${entries.length} ${entries.length === 1 ? 'prompt' : 'prompts'} / ${promptCategories.length} categories`;
  renderPrompts();
  document.getElementById('library').hidden = false;
  loadStatus.hidden = true;
})();