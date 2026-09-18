import publications from '../data/publications.json' with { type: 'json' };

export { publications };
export const escapeHtml = (value) => String(value).replace(/[&<>"']/g,
  character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

const publicationTypes = {
  'journal-article': 'Journal article',
  'conference-paper': 'Conference paper',
  preprint: 'Preprint'
};

export function renderPublications() {
  return publications.map(publication => {
    const { id, title, year, bibtex } = publication;
    const date = publication.datePublished.length === 10
      ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
        .format(new Date(`${publication.datePublished}T00:00:00Z`))
      : publication.datePublished;
    const venue = `${publication.venue}${publication.volume ? ` ${publication.volume}` : ''}`
      + `${publication.issue ? `(${publication.issue})` : ''}`
      + `${publication.articleNumber ? `, article ${publication.articleNumber}` : ''}`
      + `${publication.pages ? `, pp. ${publication.pages.replace('-', '–')}` : ''}`;
    const authors = publication.authors.map(author => `${author.given} ${author.family}`).join(', ');
    return `<li id="${id}">
      <span class="publication-year">${year}</span>
      <div>
        <h3><a href="${escapeHtml(publication.url)}">${escapeHtml(title.replace(/ --? /g, ' — '))} <span aria-hidden="true">↗</span></a></h3>
        <p class="publication-authors">${escapeHtml(authors)}</p>
        <p>${escapeHtml(publication.description)} · ${escapeHtml(venue)} · ${publicationTypes[publication.type]}, <time datetime="${publication.datePublished}">${date}</time></p>
        <details class="citation">
          <summary class="citation-toggle" aria-label="BibTeX citation for ${escapeHtml(title)}">BibTeX</summary>
          <div class="citation-panel">
            <textarea id="bibtex-${id}" aria-label="BibTeX for ${escapeHtml(title)}" readonly spellcheck="false" wrap="off" rows="${Math.min(bibtex.trim().split('\n').length, 14)}">${escapeHtml(bibtex)}</textarea>
            <div class="citation-actions">
              <button class="citation-copy" type="button" data-copy-bibtex="bibtex-${id}" hidden>Copy BibTeX</button>
              <a class="text-link" href="/publications/${id}.bib" download>Download .bib</a>
            </div>
            <p class="citation-status" role="status" aria-live="polite"></p>
          </div>
        </details>
      </div>
    </li>`;
  }).join('\n');
}

export function renderBibliography() {
  return publications.map(publication => publication.bibtex.trim()).join('\n\n') + '\n';
}
