(() => {
  const statistic = document.getElementById('download-stat');
  const live = document.getElementById('download-live');
  const total = document.getElementById('download-total');
  const status = document.getElementById('download-status');

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
    } finally {
      live.setAttribute('aria-busy', 'false');
    }
  };

  loadDownloads();
})();
