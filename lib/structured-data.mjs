import { publications } from './publications.mjs';

export const siteOrigin = 'https://andreidamian.ro';
const personId = `${siteOrigin}/#person`;
const websiteId = `${siteOrigin}/#website`;
const projectRepository = 'https://github.com/aidamian/PurpleRay_SBOM_Analyzer';

const person = {
  '@type': 'Person', '@id': personId,
  name: 'Andrei Ionuț Damian',
  alternateName: ['Andrei Ionut Damian', 'Andrei Damian'],
  url: `${siteOrigin}/`, image: `${siteOrigin}/300x300.png`,
  description: 'Serial entrepreneur, AI researcher, co-founder and CEO of Ratio1.ai, and Senior Lecturer at University Politehnica of Bucharest.',
  jobTitle: ['Co-founder and CEO', 'Senior Lecturer'],
  worksFor: [
    { '@type': 'Organization', name: 'Ratio1.ai', url: 'https://ratio1.ai/' },
    { '@type': 'CollegeOrUniversity', name: 'University Politehnica of Bucharest' }
  ],
  sameAs: [
    'https://orcid.org/0000-0002-5294-6223',
    'https://github.com/aidamian',
    'https://www.linkedin.com/in/AndreiIonutDamian'
  ]
};

const website = {
  '@type': 'WebSite', '@id': websiteId,
  name: 'Andrei Ionuț Damian', alternateName: 'Andrei Damian',
  url: `${siteOrigin}/`, inLanguage: 'en', publisher: { '@id': personId }
};

function scholarlyArticle(publication) {
  const record = {
    '@type': 'ScholarlyArticle', '@id': `https://doi.org/${publication.doi}`,
    name: publication.title, headline: publication.title, url: publication.url,
    description: publication.description, datePublished: publication.datePublished,
    creativeWorkStatus: publication.type === 'preprint' ? 'Preprint' : 'Published',
    identifier: { '@type': 'PropertyValue', propertyID: 'DOI', value: publication.doi },
    author: publication.authors.map(author => author.orcid === person.sameAs[0]
      ? { '@id': personId }
      : { '@type': 'Person', name: `${author.given} ${author.family}`, ...(author.orcid ? { sameAs: author.orcid } : {}) }),
    subjectOf: {
      '@type': 'MediaObject', name: `BibTeX citation for ${publication.title}`,
      about: { '@id': `https://doi.org/${publication.doi}` }, encodingFormat: 'application/x-bibtex',
      contentUrl: `${siteOrigin}/publications/${publication.id}.bib`
    }
  };
  if (publication.dateModified) record.dateModified = publication.dateModified;
  if (publication.pages) record.pagination = publication.pages;
  if (publication.type === 'journal-article') {
    let venue = { '@type': 'Periodical', name: publication.venue };
    if (publication.volume) venue = { '@type': 'PublicationVolume', volumeNumber: publication.volume, isPartOf: venue };
    if (publication.issue) venue = { '@type': 'PublicationIssue', issueNumber: publication.issue, isPartOf: venue };
    record.isPartOf = venue;
  } else {
    record.isPartOf = { '@type': 'CreativeWork', name: publication.venue };
  }
  return record;
}

export function profileStructuredData() {
  return { '@context': 'https://schema.org', '@graph': [
    website, person,
    {
      '@type': 'ProfilePage', '@id': `${siteOrigin}/#profile`, url: `${siteOrigin}/`,
      name: 'Andrei Ionuț Damian — AI founder and researcher', inLanguage: 'en',
      isPartOf: { '@id': websiteId }, mainEntity: { '@id': personId },
      citation: publications.map(publication => ({ '@id': `https://doi.org/${publication.doi}` }))
    },
    {
      '@type': 'ItemList', '@id': `${siteOrigin}/#research`,
      name: 'Selected research publications by Andrei Ionuț Damian',
      numberOfItems: publications.length,
      itemListElement: publications.map((publication, index) => ({
        '@type': 'ListItem', position: index + 1, item: { '@id': `https://doi.org/${publication.doi}` }
      }))
    },
    ...publications.map(scholarlyArticle)
  ] };
}

export function projectStructuredData() {
  return { '@context': 'https://schema.org', '@graph': [
    website, person,
    {
      '@type': 'WebPage', '@id': `${siteOrigin}/purpleray#page`, url: `${siteOrigin}/purpleray`,
      name: 'PurpleRay — Open-source SBOM Analyzer', inLanguage: 'en',
      isPartOf: { '@id': websiteId }, mainEntity: { '@id': `${siteOrigin}/purpleray#software` },
      breadcrumb: { '@id': `${siteOrigin}/purpleray#breadcrumb` }
    },
    {
      '@type': 'BreadcrumbList', '@id': `${siteOrigin}/purpleray#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Andrei Damian', item: `${siteOrigin}/` },
        { '@type': 'ListItem', position: 2, name: 'PurpleRay', item: `${siteOrigin}/purpleray` }
      ]
    },
    {
      '@type': 'SoftwareApplication', '@id': `${siteOrigin}/purpleray#software`,
      name: 'PurpleRay SBOM Analyzer', url: `${siteOrigin}/purpleray`,
      description: 'Free, open-source desktop SBOM analyzer for Windows and Linux. Scan local software, export CycloneDX inventories, compare scans, and optionally check OSV advisories. macOS availability varies by release.',
      applicationCategory: 'DeveloperApplication', operatingSystem: ['Windows', 'Linux'],
      creator: { '@id': personId }, isAccessibleForFree: true,
      license: 'https://www.apache.org/licenses/LICENSE-2.0',
      screenshot: [
        `${siteOrigin}/purpleray/application-overview.png`,
        `${siteOrigin}/purpleray/components-known-issues.png`,
        `${siteOrigin}/purpleray/scan-details.png`
      ],
      installUrl: `${projectRepository}/releases/latest`,
      releaseNotes: `${projectRepository}/releases`,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR', url: `${siteOrigin}/purpleray#download` },
      subjectOf: { '@id': `${siteOrigin}/purpleray#source` }
    },
    {
      '@type': 'SoftwareSourceCode', '@id': `${siteOrigin}/purpleray#source`,
      name: 'PurpleRay SBOM Analyzer source code', codeRepository: projectRepository,
      url: projectRepository, license: 'https://www.apache.org/licenses/LICENSE-2.0',
      author: { '@id': personId }, targetProduct: { '@id': `${siteOrigin}/purpleray#software` }
    }
  ] };
}

export function renderStructuredData(data) {
  // Keep markup-like text inert inside the JSON-LD script element.
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

export function renderLlmsIndex() {
  return `# Andrei Ionuț Damian\n\n> Personal website of Andrei Ionuț Damian, serial entrepreneur, AI researcher, Ratio1 co-founder and CEO, and Senior Lecturer.\n\n`
    + `## Pages\n\n- [Profile and company history](${siteOrigin}/): Career, Lummetry acquisition, education, and selected research.\n`
    + `- [PurpleRay SBOM Analyzer](${siteOrigin}/purpleray): Open-source desktop software, screenshots, supported platforms, and release links.\n\n`
    + `## Research\n\n`
    + publications.map(publication => `- [${publication.title}](${publication.url}): ${publication.year}; ${publication.type === 'preprint' ? 'preprint' : publication.venue}.`).join('\n')
    + `\n- [BibTeX bibliography](${siteOrigin}/publications.bib): Citations for all selected publications.\n\n`
    + `## Author profiles\n\n- [ORCID](https://orcid.org/0000-0002-5294-6223)\n- [GitHub](https://github.com/aidamian)\n`;
}
