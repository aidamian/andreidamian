const repository = 'https://github.com/aidamian/PurpleRay_SBOM_Analyzer';
const platforms = [['windows', 'Windows'], ['linux', 'Linux'], ['macos', 'macOS']];
const formats = { zip: 'ZIP', 'tar.gz': '.tar.gz', deb: '.deb', binary: 'binary' };
const escapeHTML = (value) => String(value).replace(/[&<>"']/g,
  character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function downloadableAssets(release) {
  if (!release || typeof release.tag !== 'string' || !release.tag || !Array.isArray(release.assets)) return [];
  return release.assets.filter(asset => {
    if (!asset || typeof asset.name !== 'string' || !asset.name || !Object.hasOwn(formats, asset.format)) return false;
    const expected = `${repository}/releases/download/${encodeURIComponent(release.tag)}/${encodeURIComponent(asset.name)}`;
    return asset.url === expected;
  });
}

// Shared by the server and browser so downloads also work without JavaScript.
export function renderReleaseOptions(snapshot) {
  const releases = snapshot?.releases;
  return platforms.map(([key, label]) => {
    const release = releases?.[key];
    const assets = downloadableAssets(release);
    const archived = assets.length && release.tag !== snapshot?.latestRelease?.tag;
    const paused = key === 'macos' && (!assets.length || archived);
    const version = assets.length
      ? `${archived ? 'Archived release' : 'Latest available'}: <a href="${repository}/releases/tag/${encodeURIComponent(release.tag)}">${escapeHTML(release.tag)}</a>`
      : releases ? 'No published package available.' : 'Check the latest release on GitHub.';
    const architecture = [...new Set(assets.map(asset => asset.architecture).filter(Boolean))].join(', ');
    const detail = paused ? 'Builds temporarily paused.'
      : key === 'linux' ? `${architecture ? `${escapeHTML(architecture)} · ` : ''}Requires glibc 2.34+ and GTK2. WSL2 supported with WSLg.`
      : key === 'windows' ? `${architecture ? `${escapeHTML(architecture)} · ` : ''}Extract the ZIP to get started.`
      : 'Download the published macOS package.';
    const links = assets.length ? assets.map(asset => {
      const format = formats[asset.format];
      const description = `Download PurpleRay ${release.tag} for ${label} (${format}${asset.architecture ? `, ${asset.architecture}` : ''})`;
      return `<a class="button button-secondary" href="${escapeHTML(asset.url)}" aria-label="${escapeHTML(description)}">Download ${archived ? 'archived ' : ''}${format}</a>`;
    }).join('\n') : `<a class="text-link" href="${repository}/releases${key === 'macos' ? '' : '/latest'}">${key === 'macos' ? 'View release history' : `View ${label} packages on GitHub`}</a>`;
    return `<article class="platform-download" data-platform="${key}">
      <h3>${label}</h3>
      <p class="platform-version">${version}</p>
      <p class="platform-detail">${detail}</p>
      <div class="platform-assets">${links}</div>
      ${paused && assets.length ? '<p class="platform-detail">Experimental archive; current features may be missing.</p>' : ''}
    </article>`;
  }).join('\n');
}

export function releaseStatus(snapshot) {
  if (!snapshot?.releases) return 'Package links are available on GitHub while release information loads.';
  return snapshot.stale
    ? 'Showing the last available package links. The latest refresh is delayed.'
    : 'Package links refresh hourly. Reload this page to see updates. Older builds are marked as archives.';
}

if (typeof document !== 'undefined') (() => {
  const statistic = document.getElementById('download-stat');
  const live = document.getElementById('download-live');
  const total = document.getElementById('download-total');
  const status = document.getElementById('download-status');
  const options = document.getElementById('release-options');
  const releasesStatus = document.getElementById('release-status');

  if (!statistic || !live || !total || !status) return;

  const unavailable = () => {
    statistic.dataset.state = 'unavailable';
    total.textContent = 'Unavailable';
    status.textContent = 'Download statistics are temporarily unavailable. You can still download the latest release on GitHub.';
  };

  const requestSnapshot = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch('/api/purpleray/downloads', {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('Statistics request failed');
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  };

  const loadDownloads = async () => {
    statistic.dataset.state = 'loading';
    live.setAttribute('aria-busy', 'true');
    total.textContent = '…';
    status.textContent = 'Loading download statistics…';

    try {
      let data;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        data = await requestSnapshot();
        if (data?.metric !== 'package_downloads') throw new Error('Invalid metric');
        if (data.releases && options) {
          options.innerHTML = renderReleaseOptions(data);
          if (releasesStatus) releasesStatus.textContent = releaseStatus(data);
        }
        if (data.downloads !== null || attempt === 3) break;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      if (!Number.isSafeInteger(data.downloads)
        || data.downloads < 0
        || typeof data.stale !== 'boolean'
        || typeof data.updatedAt !== 'string') {
        throw new Error('Statistics are unavailable');
      }

      const updated = new Date(data.updatedAt);
      if (Number.isNaN(updated.getTime())) throw new Error('Invalid update time');

      const formattedDate = new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      }).format(updated);

      statistic.dataset.state = data.stale ? 'stale' : 'ready';
      total.textContent = new Intl.NumberFormat().format(data.downloads);
      status.textContent = data.stale
        ? `Last recorded total · ${formattedDate}. The latest refresh is delayed.`
        : `Updated ${formattedDate}.`;
    } catch {
      unavailable();
      if (releasesStatus) releasesStatus.textContent = 'Package links could not refresh. You can also browse the latest release on GitHub.';
    } finally {
      live.setAttribute('aria-busy', 'false');
    }
  };

  loadDownloads();
})();
