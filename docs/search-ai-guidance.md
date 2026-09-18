# Search, AI retrieval, and training access

Research and public-site checks: **18 September 2026**. These recommendations reflect the owner's preference to make published site content available for search, AI answers, and model training. No Cloudflare or search-engine account settings were inspected or changed in this audit.

## Public baseline before this update

At 05:22 UTC, `https://andreidamian.ro/`, `/purpleray`, `/robots.txt`, and `/sitemap.xml` returned HTTP 200. Both HTML pages had the expected canonical URLs, `Cache-Control: no-store`, and no observed `noindex` or `X-Robots-Tag` restriction. The site reported version `1.1.0`, revision `68c498141d4a`. The sitemap contained the two canonical page URLs; `/llms.txt` returned 404.

The delivered robots file allowed `/`, excluded `/api/`, and advertised the correct sitemap. It contained no Cloudflare-managed crawler block or `ai-train=no` signal. Homepage requests using ordinary, OpenAI, Anthropic, Googlebot, Bingbot, and CCBot user-agent strings all received the same HTML with HTTP 200. These requests came from the audit client's IP: they test responses to those strings, **not access from verified crawler networks**. Temporary evidence is in `/tmp/andreidamian-ai-review/public-audit.json`.

## Which controls serve which purpose

| Operator and token | Documented purpose | Policy for this site |
| --- | --- | --- |
| OpenAI `OAI-SearchBot` | Discovery for ChatGPT search results. | Allow public pages. |
| OpenAI `GPTBot` | Collection of material potentially used for foundation-model training. Independent of search permission. | Allow public pages. |
| OpenAI `ChatGPT-User` | Fetches prompted by users; does not determine search eligibility. Robots rules may not apply to these requests. | Keep public pages accessible. |

OpenAI publishes crawler IP ranges for verification. Do not grant security bypasses merely because a request claims one of these user agents. [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots).

| Operator and token | Documented purpose | Policy for this site |
| --- | --- | --- |
| Anthropic `ClaudeBot` | Collection for possible model training. | Allow public pages. |
| Anthropic `Claude-SearchBot` | Search discovery and indexing. | Allow public pages. |
| Anthropic `Claude-User` | Retrieval requested by Claude users. | Allow public pages. |

Anthropic documents robots compliance for all three and says its bots do not bypass CAPTCHAs. [Anthropic crawler guidance](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler), updated 7 April 2026.

| Operator and token | Documented purpose | Policy for this site |
| --- | --- | --- |
| Googlebot | Google Search crawling, including discovery for its AI search features. | Allow public pages. |
| `Google-Extended` | Robots product token controlling certain Gemini training and grounding uses; it has no separate HTTP user agent. | Allow; do not confuse this with Google Search eligibility. |

[Google's crawler documentation](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers#google-extended) separates these controls. Its current [AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) requires search indexing, snippet eligibility, and inclusion through the Search Console AI control. Existing SEO practices remain relevant; access alone does not guarantee inclusion.

Bing uses its search infrastructure for Copilot and related grounding. Allow Bingbot and keep public pages free of restrictive robots directives such as `noindex`, `noarchive`, and `nocache` when those uses are desired. Bing documents that the latter two also constrain how content can be used for model training. **Bing's robots `nocache` directive is different from HTTP `Cache-Control: no-store`**; retain the site's HTTP policy for accurate per-node footer rendering. [Bing webmaster guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a), [supported robots directives](https://www.bing.com/webmasters/help/robots-meta-tags-and-attributes-that-bing-supports-5198d240).

Common Crawl's `CCBot` collects a public web corpus that other organizations can reuse. Allowing it is consistent with training friendliness, but does not establish that any particular crawl, dataset, or model will contain this site. Common Crawl provides verification instructions and respects robots exclusions. [CCBot documentation](https://commoncrawl.org/ccbot).

## Cloudflare checks for the operator

In the current dashboard, inspect **Security Settings → Configure AI bot policies**. For this site's intended policy, choose Allow for Search, Agent, and Training. Allow means that this feature adds no block; other WAF or crawler rules can still intervene. Inspect relevant events before adjusting any such rule, and retain normal security protection. Cloudflare is replacing the older single AI-blocking control; defaults for newly added domains do not establish this existing zone's configuration. [AI bot policies](https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/), updated 1 July 2026.

Keep the managed training-blocking robots option off: **Security Settings → Bot traffic → Set your preference to block training in robots.txt**. When enabled, Cloudflare can prepend exclusions to an existing origin file and add `ai-train=no`. Check the actual public response after deployment. Content Signals distinguish ordinary search, AI answer input, and training; they are additional policy signals, not universally supported crawler instructions. A positive `search=yes, ai-input=yes, ai-train=yes` signal can express the owner's intent, but does not replace robots permissions or edge access. The newer `use` extension is experimental and unnecessary here. [Managed robots and Content Signals](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/), updated 3 August 2026.

## Search Console and submission

Verify the effective choice under **Search Console → Settings → Search generative AI** remains Include. This is the default; child properties may inherit a parent's choice. Google reports this control rolled out worldwide on 31 August 2026. It affects appearance in AI Overviews, AI Mode, and generative Discover features, independently of training controls. A public HTTP check cannot verify the property's selection. [Search generative AI control](https://support.google.com/webmasters/answer/16908024).

Submit the canonical sitemap through Google Search Console and Bing Webmaster Tools, then inspect the public page URLs after deployment. IndexNow is an optional later addition for notifying participating engines about changed URLs; a successful submission is not an indexing promise. For this small site, it does not require a new scheduled process. [IndexNow documentation](https://www.indexnow.org/documentation).

## Minimal repository approach

- Keep meaningful profile, project, and publication content in ordinary server-rendered HTML, with stable canonical URLs and visible source links. Structured data should describe the same public content.
- Keep public crawl permission broad and exclude operational endpoints. If separate bot-specific robots groups are introduced, repeat operational exclusions: do not assume those groups inherit the wildcard group's rules.
- Put specific path exclusions before a broad allow rule for compatibility with simple first-match parsers. Google instead selects the most specific matching path, independent of rule order. The local Python check exposed this difference and passed after reordering the existing rules. [Google robots rule precedence](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec).
- Preserve accurate XML sitemap entries and verify the served HTML, sitemap, robots file, and response headers after publication. Observe verified crawler events when available.
- A short `/llms.txt` index is optional. The current [llms.txt proposal](https://llmstxt.org/) focuses on helping agents navigate a site at inference time; it is not a training subscription or an indexing protocol. Keep it consistent with the HTML and link to canonical pages and source material. Avoid maintaining a second biography or a duplicate site dump.

Google explicitly says its Search systems ignore `llms.txt` for ranking. The file may help tools that choose to read it, but no documented universal discovery, citation, ranking, or training benefit follows. Public access and clear, well-supported content establish eligibility; publishers and model providers still decide what they index or use. [Google AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).
