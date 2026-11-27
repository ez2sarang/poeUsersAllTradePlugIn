(() => {
  const trade = document.getElementById('trade');
  if (!trade) return;

  const buttonClass = 'poe-all-items-button';
  const taggedAccount = /^[^#\s\p{Cc}][^#\p{Cc}]*#[0-9]+$/u;
  const rowSelector = '.resultset > .row:not(.controls)';
  const tradeSearchPath = /^\/trade\/search\/(?:(xbox|sony)\/)?([^/]+)(?:\/[^/]+)?\/?$/u;
  const encodedBySeller = new Map();

  function searchPrefix() {
    const match = tradeSearchPath.exec(location.pathname);
    if (!match) return '';
    const [, realm, league] = match;
    return `${location.origin}/trade/search/${realm ? `${realm}/` : ''}${league}/`;
  }

  async function encodeSeller(account) {
    const query = {
      status: { option: 'any' },
      stats: [{ type: 'and', filters: [] }],
      filters: { trade_filters: { filters: { account: { input: account }, sale_type: { option: 'any' } } } },
    };
    const json = new Blob([JSON.stringify(query)]);
    const gzip = json.stream().pipeThrough(new CompressionStream('gzip'));
    const bytes = new Uint8Array(await new Response(gzip).arrayBuffer());
    return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
  }

  function sellerLinkQuery(account) {
    const existing = encodedBySeller.get(account);
    if (existing) return existing;
    if (encodedBySeller.size >= 250) encodedBySeller.clear();
    const encoded = encodeSeller(account);
    encodedBySeller.set(account, encoded);
    return encoded;
  }

  function readSeller(row) {
    const profile = row.querySelector('.right .details .profile-link a[href^="/account/view-profile/"]');
    if (!profile) return '';

    const encodedName = new URL(profile.href).pathname.match(/^\/account\/view-profile\/([^/]+)\/?$/u)?.[1];
    try {
      const account = decodeURIComponent(encodedName ?? '');
      if (taggedAccount.test(account)) return account;
    } catch {
      // The full displayed account is also available if the profile URL changes.
    }
    const account = profile.textContent.trim();
    return taggedAccount.test(account) ? account : '';
  }

  function makeLink(row) {
    const link = document.createElement('a');
    link.className = `btn btn-xs btn-default ${buttonClass}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = '모든아이템';
    link.addEventListener('click', event => {
      event.stopPropagation();
      const prefix = searchPrefix();
      if (!prefix || !link.dataset.query || readSeller(row) !== link.dataset.seller) {
        event.preventDefault();
        return;
      }
      link.href = prefix + link.dataset.query;
    });
    return link;
  }

  function bindSeller(link, account) {
    link.dataset.seller = account;
    delete link.dataset.query;
    link.removeAttribute('href');
    link.hidden = true;
    link.title = `${account}의 전체 매물을 새 탭에서 보기`;
    link.setAttribute('aria-label', `모든아이템, ${link.title}`);
    sellerLinkQuery(account).then(query => {
      const prefix = searchPrefix();
      if (link.dataset.seller !== account || !prefix) return;
      link.dataset.query = query;
      link.href = prefix + query;
      link.hidden = false;
    }).catch(() => {
      if (link.dataset.seller === account) link.hidden = true;
    });
  }

  function updateRows() {
    for (const row of trade.querySelectorAll(rowSelector)) {
      const actions = row.querySelector('.right .details .btns');
      if (!actions) continue;

      let link = actions.querySelector(`.${buttonClass}`);
      const account = readSeller(row);
      if (!account || !searchPrefix()) {
        link?.remove();
        continue;
      }

      link ??= makeLink(row);
      if (link.dataset.seller !== account) bindSeller(link, account);

      const direct = actions.querySelector('button.direct-btn');
      if (direct) {
        if (direct.nextElementSibling !== link) direct.after(link);
      } else {
        const group = actions.querySelector(':scope > .btn-group') ?? actions;
        if (link.parentElement !== group) group.append(link);
      }
    }
  }

  let frame;
  const observer = new MutationObserver(() => {
    if (frame !== undefined) return;
    frame = requestAnimationFrame(() => {
      frame = undefined;
      updateRows();
    });
  });
  observer.observe(trade, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
  updateRows();
})();
