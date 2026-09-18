for (const button of document.querySelectorAll('[data-copy-bibtex]')) {
  const text = document.getElementById(button.dataset.copyBibtex);
  const status = button.closest('.citation-panel')?.querySelector('.citation-status');
  if (!text || !status) continue;
  button.hidden = false;
  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = '';
    try {
      await navigator.clipboard.writeText(text.value);
      status.textContent = 'BibTeX copied.';
    } catch {
      text.focus();
      text.select();
      status.textContent = 'Automatic copy is unavailable. The citation is selected; use your device’s Copy command, or download the .bib file.';
    } finally {
      button.disabled = false;
    }
  });
}
