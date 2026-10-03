const WinnerLinks = (() => {
    const styles = Object.freeze({
        'winners.html': { title: "Here's to your winners", description: 'A bright confetti celebration. Every name appears as soon as the link opens.' },
        'octo.html': { title: 'Thank you, team!', description: 'A pixel-style thank-you with sound and confetti. Recipients press Start to reveal the names.' },
        'waddle.html': { title: 'A moment to celebrate', description: 'An elegant animated thank-you. Recipients press the celebration button to reveal the names and start the effects.' }
    });

    function buildLink(names, style, base) {
        if (!Array.isArray(names) || !names.length) throw new Error('Add at least one winner before creating a link.');
        if (names.some(name => typeof name !== 'string' || !name.trim())) throw new Error('Every winner must have a non-empty name.');
        if (!Object.hasOwn(styles, style)) throw new Error('Choose one of the available celebration styles.');
        // ASCII JSON keeps Unicode compatible with the existing atob + JSON.parse result pages.
        const json = JSON.stringify(names).replace(/[\u007f-\uffff]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
        const url = new URL(style, base);
        url.hash = encodeURIComponent(btoa(json));
        return url.href;
    }

    return { styles, buildLink };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = WinnerLinks;

if (typeof document !== 'undefined') {
    const winners = [];
    const ui = Object.fromEntries([
        'winnerForm', 'winnerInput', 'addWinnerBtn', 'winnerList', 'emptyWinners', 'winnerCount',
        'nameError', 'listStatus', 'celebrationStyle', 'stylePreview', 'previewTitle', 'previewNames',
        'previewMore', 'styleDescription', 'generateBtn', 'shareResult', 'generatedLink', 'openLink',
        'copyLinkBtn', 'linkStatus'
    ].map(id => [id, document.getElementById(id)]));
    let revision = 0;

    function setStatus(message, error = false) {
        ui.linkStatus.textContent = message;
        ui.linkStatus.dataset.error = String(error);
    }

    function clearLink() {
        revision++;
        ui.shareResult.hidden = true;
        ui.generatedLink.value = '';
        ui.openLink.removeAttribute('href');
        setStatus('');
    }

    function renderPreview() {
        const style = WinnerLinks.styles[ui.celebrationStyle.value];
        ui.stylePreview.dataset.style = ui.celebrationStyle.value;
        ui.previewTitle.textContent = style.title;
        ui.styleDescription.textContent = style.description;
        ui.previewNames.textContent = winners.length ? winners.slice(0, 3).join('\n') : 'Your team takes center stage.';
        ui.previewMore.hidden = winners.length <= 3;
        ui.previewMore.textContent = winners.length > 3 ? `+ ${winners.length - 3} more in the full celebration` : '';
    }

    function renderWinners() {
        ui.winnerList.replaceChildren(...winners.map((name, index) => {
            const row = document.createElement('li');
            const number = document.createElement('span');
            number.className = 'winner-number';
            number.textContent = String(index + 1).padStart(2, '0');
            number.setAttribute('aria-hidden', 'true');
            const text = document.createElement('span');
            text.className = 'winner-name';
            text.textContent = name;
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'remove-winner';
            remove.textContent = '\u00d7';
            remove.setAttribute('aria-label', `Remove ${name}`);
            remove.addEventListener('click', () => {
                winners.splice(index, 1);
                clearLink();
                renderWinners();
                ui.listStatus.textContent = `Removed ${name}. ${winners.length} winners remaining.`;
                const next = ui.winnerList.querySelectorAll('button')[Math.min(index, winners.length - 1)];
                (next || ui.winnerInput).focus();
            });
            row.append(number, text, remove);
            return row;
        }));
        ui.winnerList.hidden = winners.length === 0;
        ui.emptyWinners.hidden = winners.length > 0;
        ui.winnerCount.textContent = `${winners.length} added`;
        renderPreview();
    }

    async function copyLink() {
        const link = ui.generatedLink.value;
        if (!link) {
            setStatus('Create a celebration link before copying.', true);
            return;
        }
        const currentRevision = revision;
        try {
            if (!navigator.clipboard?.writeText) throw new Error('This browser does not offer clipboard access.');
            await navigator.clipboard.writeText(link);
            if (currentRevision === revision) setStatus('Link copied. Check the celebration before sharing it.');
        } catch (error) {
            if (currentRevision !== revision) return;
            setStatus(`Could not copy automatically: ${error instanceof Error ? error.message : String(error)} Select and copy the link manually.`, true);
            ui.generatedLink.focus();
            ui.generatedLink.select();
        }
    }

    ui.winnerForm.addEventListener('submit', event => {
        event.preventDefault();
        const name = ui.winnerInput.value.trim();
        if (!name) {
            ui.nameError.textContent = 'Enter a winner name first.';
            ui.winnerInput.setAttribute('aria-invalid', 'true');
            ui.winnerInput.focus();
            return;
        }
        winners.push(name);
        ui.nameError.textContent = '';
        ui.winnerInput.removeAttribute('aria-invalid');
        ui.winnerInput.value = '';
        clearLink();
        renderWinners();
        ui.listStatus.textContent = `Added ${name}. ${winners.length} winners in the list.`;
        ui.winnerInput.focus();
    });
    ui.winnerInput.addEventListener('input', () => {
        ui.nameError.textContent = '';
        ui.winnerInput.removeAttribute('aria-invalid');
    });
    ui.celebrationStyle.addEventListener('change', () => {
        clearLink();
        renderPreview();
    });
    ui.generateBtn.addEventListener('click', () => {
        try {
            const link = WinnerLinks.buildLink(winners, ui.celebrationStyle.value, location.href);
            revision++;
            ui.generatedLink.value = link;
            ui.openLink.href = link;
            ui.shareResult.hidden = false;
            setStatus('Link created. Attempting to copy it...');
            copyLink();
        } catch (error) {
            setStatus(error instanceof Error ? error.message : String(error), true);
            if (!winners.length) ui.winnerInput.focus();
        }
    });
    ui.copyLinkBtn.addEventListener('click', copyLink);
    ui.addWinnerBtn.disabled = false;
    ui.generateBtn.disabled = false;
    renderWinners();
    if (window.lucide) window.lucide.createIcons();
}
