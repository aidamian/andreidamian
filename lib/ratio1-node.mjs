function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

export function renderNodeAttribution(env) {
  const name = env.R1EN_HOST_ID?.trim() || env.EE_HOST_ID?.trim();
  const address = env.R1EN_HOST_ADDR?.trim() || env.EE_HOST_ADDR?.trim();
  const label = name || address;

  if (!label) {
    return 'Node information unavailable';
  }

  const title = address ? ` title="${escapeHtml(address)}"` : '';
  return 'Served by <a href="https://ratio1.ai/">Ratio1</a> node '
    + `<span class="node-name"${title}>${escapeHtml(label)}</span>`;
}
