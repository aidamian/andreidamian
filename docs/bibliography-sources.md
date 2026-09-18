# Publication metadata and BibTeX sources

Verified **18 September 2026**. The six selected references are stored in [`data/publications.json`](../data/publications.json), in the existing homepage order. This file supplies the visible citations, downloadable BibTeX, and scholarly structured data; the descriptions retain the homepage's short subject labels rather than reproducing abstracts.

## Sources and citation keys

| Stable ID | BibTeX key | Bibliographic record |
| --- | --- | --- |
| `edgeguard-threat-analytics-2026` | `Kopanov2026EdgeGuard` | *Information* **17**(8), article **794**, **19 August 2026**. [Publisher](https://www.mdpi.com/2078-2489/17/8/794), [DOI](https://doi.org/10.3390/info17080794), [Crossref metadata](https://api.crossref.org/works/10.3390/info17080794). |
| `clinical-ai-governance-2026` | `Panagoulias2026ClinicalAI` | *Electronics* **15**(14), article **3046**, **10 July 2026**. [Publisher](https://www.mdpi.com/2079-9292/15/14/3046), [DOI](https://doi.org/10.3390/electronics15143046), [Crossref metadata](https://api.crossref.org/works/10.3390/electronics15143046). |
| `ratio1-meta-os-cscs-2025` | `Damian2025Ratio1CSCS` | *2025 25th International Conference on Control Systems and Computer Science (CSCS)*, IEEE, **258–265**. Crossref publication date **27 May 2025**. [IEEE](https://ieeexplore.ieee.org/document/11181620), [DOI](https://doi.org/10.1109/CSCS66924.2025.00046), [Crossref metadata](https://api.crossref.org/works/10.1109/CSCS66924.2025.00046). |
| `ratio1-ai-meta-os-2025` | `Damian2025Ratio1` | arXiv preprint **2509.12223**, first submitted **5 September 2025**, currently **v1**. [arXiv record and history](https://arxiv.org/abs/2509.12223), [DOI](https://doi.org/10.48550/arXiv.2509.12223). |
| `solis-mlops-2021` | `Ciobanu2021SOLIS` | arXiv preprint **2112.11925**, first submitted **22 December 2021**, revised **28 January 2022**, currently **v2**. [arXiv record and history](https://arxiv.org/abs/2112.11925), [DOI](https://doi.org/10.48550/arXiv.2112.11925). |
| `cloudifiernet-2019` | `Damian2019CloudifierNet` | *Procedia Computer Science* **162** (**2019**), **720–728**. [Elsevier](https://linkinghub.elsevier.com/retrieve/pii/S187705091932054X), [DOI](https://doi.org/10.1016/j.procs.2019.12.043), [Crossref metadata](https://api.crossref.org/works/10.1016/j.procs.2019.12.043). |

Author order, spelling, and full titles come from the publishers' DOI deposits or arXiv's DOI export. These can differ from display typography on the original homepage: for example, the arXiv title is `SOLIS -- The MLOps journey from data acquisition to actionable insights`, with sentence capitalization. No coauthor was added or reordered.

The two 2026 journal deposits explicitly associate Andrei Ionut Damian with [ORCID 0000-0002-5294-6223](https://orcid.org/0000-0002-5294-6223). His [public works record](https://pub.orcid.org/v3.0/0000-0002-5294-6223/works) also identifies the four older references, establishing the same author identity where a publication credits the shorter name **Andrei Damian**. The JSON retains each publication's credited given name and includes his ORCID for all six. Other coauthor ORCIDs are included only where supplied by that publication's Crossref deposit; missing identifiers are left absent.

## Publication status and date precision

- The two 2026 entries are published journal articles. The clinical-governance paper's [5 June 2026 preprint](https://www.preprints.org/manuscript/202606.0484) is an earlier version of the July journal article and is not a seventh reference.
- The IEEE Ratio1 paper and the September Ratio1 arXiv preprint are separate bibliographic records with different author orders. Keep both references and their distinct identifiers. The IEEE `datePublished` is the date supplied by Crossref's `published`/`published-print` fields, coinciding with the opening date of the 27–30 May conference; it is not a claim about the date the paper was added to IEEE Xplore.
- Both arXiv items remain `preprint`. A DOI does not establish peer review. Neither arXiv record supplies a journal reference, and no later journal version of SOLIS was verified in the publication audit.
- SOLIS retains **2021** as its original year and `datePublished`; `dateModified` records the verified **2022-01-28** revision separately. The BibTeX note also distinguishes the original submission from the revision.
- Ratio1's arXiv history still contains only its **2025-09-05** submission. A **2025–2026** label on the independently maintained [Ratio1 whitepaper](https://ratio1.ai/whitepaper) does not change the arXiv publication year.
- CloudifierNet is the published Elsevier/Procedia version of record. Crossref's publication fields provide only **2019**, so `datePublished` remains the year string `2019`; do not manufacture a January 1 date or use a later metadata deposit date. `journal-article` follows the publisher's Crossref classification for the Procedia article, which appeared in the ITQM 2019 proceedings volume.
- For the MDPI journals, **794** and **3046** are article identifiers, not page ranges. JSON stores them in `articleNumber`. `pages` is reserved for the real IEEE and Procedia page ranges.

## BibTeX provenance and normalization

All six canonical BibTeX records were retrieved through DOI content negotiation with `Accept: application/x-bibtex`. The journal and conference records resolve to Crossref's transform service; the arXiv records resolve to the DataCite/Crosscite export. Publisher metadata was independently refreshed with `Accept: application/vnd.citationstyles.csl+json`, and preprint submission histories were checked on arXiv.

The stored citations preserve the canonical authors, titles, years, venues, volume/issue numbers, identifiers, and pagination. Deliberate formatting changes are:

- Stable, unique keys as listed above; `@article` for journal records, `@inproceedings` for IEEE, and `@misc` for arXiv.
- Full-title brace protection to retain names and acronyms such as Ratio1, AI, MLOps, SOLIS, and CloudifierNet in BibTeX styles that change title capitalization.
- Canonical HTTPS DOI or arXiv URLs, consistent DOI casing, braced month names, and BibTeX `--` page-range separators.
- Explicit arXiv `eprint`, `archivePrefix`, `primaryClass`, and preprint notes. These fields come from the arXiv records; the SOLIS note records its revision without changing its original year.
- Article identifiers retained in BibTeX's `pages` field to match the publishers' canonical exports and common BibTeX styles. Their separate JSON `articleNumber` field prevents treating them as page ranges in structured data.

The citation keys are also stored as `bibtexKey`, and the complete normalized entry is stored as `bibtex`. Neither the browser nor the production server needs to fetch bibliographic APIs to serve these citations.

## Validation

All six stored entries and their combined bibliography parsed successfully with **bibtexparser 2.0.1**. Each entry was checked against its freshly retrieved canonical DOI BibTeX export for exact author order, title, year, and DOI (case-insensitive DOI comparison). Additional checks matched each BibTeX entry to the JSON type, citation key, URL, venue, volume/issue representation, and pagination, and checked unique IDs/keys and date precision. Validation used an ephemeral `uv run --no-project --with bibtexparser==2.0.1` environment; no runtime dependency was added to the website.

The broader discovery audit checked the exact ORCID, independent Crossref author-name queries, publisher pages, and arXiv on **17 September 2026**; citation exports and the six selected records were refreshed on **18 September 2026**. This is a curated research selection, not a complete publication count or a guarantee that databases contain every work.
