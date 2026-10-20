// A local workflow layer over the original, unchanged model outputs.
const STORAGE_KEY = 'pipeline-intelligence.workspace.v1';
const STAGES = ['Research', 'Reach out', 'In conversation', 'Next step'];
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const opportunityKey = (product, domain) => JSON.stringify([product, domain]);
const productByKey = new Map(PRODUCTS.map(p => [p.k, p]));
const rowIndex = new Map(Object.entries(ROWS).map(([key, rows]) => [key, new Map(rows.map(row => [row.d, row]))]));
let workspace = { version: 1, opportunities: {} }, activeView = 'queue', toastTimer, previousFocus;

function validateWorkspace(value) {
  if (!value || value.version !== 1 || !value.opportunities || typeof value.opportunities !== 'object' || Array.isArray(value.opportunities)) throw new Error('This is not a Pipeline workspace backup.');
  const entries = Object.entries(value.opportunities);
  if (entries.length > 10000) throw new Error('This backup contains too many saved opportunities.');
  const clean = { version: 1, opportunities: {} };
  for (const [key, item] of entries) {
    if (!item || !productByKey.has(item.product) || !rowIndex.get(item.product)?.has(item.domain)) throw new Error('A saved opportunity does not belong to this dataset.');
    if (key !== opportunityKey(item.product, item.domain) || !STAGES.includes(item.stage)) throw new Error('Invalid opportunity details.');
    clean.opportunities[key] = { product: item.product, domain: item.domain, stage: item.stage,
      notes: String(item.notes || '').slice(0, 12000), nextStep: String(item.nextStep || '').slice(0, 500),
      updated: typeof item.updated === 'string' ? item.updated.slice(0, 40) : '' };
  }
  return clean;
}
try { const stored = localStorage.getItem(STORAGE_KEY); if (stored) workspace = validateWorkspace(JSON.parse(stored)); }
catch { setTimeout(() => toast('Saved workspace could not be loaded. Restore an exported backup if available.'), 500); }
function toast(message) {
  $('toast').textContent = message; $('toast').classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 4200);
}
function persist(next = workspace) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); workspace = next; updateCounts(); return true; }
  catch { toast('Could not save locally. Export a backup before closing.'); return false; }
}
function updateCounts() {
  const count = Object.keys(workspace.opportunities).length;
  $('savedCount').textContent = String(count); $('savedStat').textContent = count.toLocaleString();
}
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const originalRowsNow = rowsNow;
const originalRender = render;
render = function () {
  const total = originalRowsNow().length;
  pageIndex = Math.min(Math.max(0, pageIndex), Math.max(0, Math.ceil(total / PAGE_SIZE) - 1));
  originalRender();
  const shown = originalRowsNow().slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE);
  [...$('tb').children].forEach((tr, index) => {
    const row = shown[index]; tr.tabIndex = 0; tr.setAttribute('aria-label', `Open ${row.c}`);
    tr.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); tr.click(); } };
    const cell = tr.children[1];
    const saved = workspace.opportunities[opportunityKey(sel.value, row.d)];
    cell.innerHTML = `<div class="table-account"><span class="accountAvatar" aria-hidden="true">${escapeHTML(row.c.trim().slice(0, 2).toUpperCase())}</span><div><span class="co">${escapeHTML(row.c)}</span>${saved ? '<span class="savedMark" title="Saved to your pipeline">◇</span>' : ''}<span class="dm">${escapeHTML(row.d)}</span></div></div>`;
    tr.querySelector('.sigbtn').textContent = 'Open ↗';
    // Show provenance limitations without making the main queue a diagnostics table.
    tr.children[4].title = 'Imported propensity estimate, not a calibrated probability of a deal';
    tr.children[5].title = 'Estimated annual contract value if purchased; not a quoted price';
    tr.children[7].title = 'Original modeled value calculation, not committed revenue';
  });
  if (!total) $('tb').innerHTML = '<tr><td colspan="9"><div class="empty"><b>No matching accounts.</b>Try a different product or clear the filters.</div></td></tr>';
  $('pagination').innerHTML = `<span>${total ? pageIndex * PAGE_SIZE + 1 : 0}–${Math.min(total, (pageIndex + 1) * PAGE_SIZE)} of ${total.toLocaleString()} matches</span><div><button id="prevPage" ${pageIndex === 0 ? 'disabled' : ''}>← Previous</button><button id="nextPage" ${(pageIndex + 1) * PAGE_SIZE >= total ? 'disabled' : ''}>Next →</button></div>`;
  $('prevPage').onclick = () => { pageIndex--; render(); $('queueView').scrollIntoView({ block: 'start' }); };
  $('nextPage').onclick = () => { pageIndex++; render(); $('queueView').scrollIntoView({ block: 'start' }); };
  const count = ['seg', 'ind', 'cty'].filter(id => $(id).value).length + filters.size;
  $('filterCount').textContent = count ? `· ${count}` : '';
};
['seg', 'ind', 'cty'].forEach(id => $(id).onchange = () => { pageIndex = 0; render(); });
$('q').oninput = () => { pageIndex = 0; render(); };
sel.onchange = () => { pageIndex = 0; closePane(); render(); };
document.querySelectorAll('[data-f]').forEach(button => {
  const click = button.onclick;
  button.setAttribute('role', 'button'); button.tabIndex = 0;
  button.onclick = () => { pageIndex = 0; click(); };
  button.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); button.click(); } };
});
$('clearFilters').onclick = () => {
  ['seg', 'ind', 'cty'].forEach(id => $(id).value = ''); filters.clear();
  document.querySelectorAll('[data-f]').forEach(chip => chip.classList.remove('on')); pageIndex = 0; render();
};
function csvValue(value) {
  let text = String(value ?? '');
  // A company name or note must never become a spreadsheet formula.
  if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
$('exportCsv').onclick = () => {
  const product = productByKey.get(sel.value);
  const rows = originalRowsNow().map(row => [row.c, row.d, product.n, row.i, row.sg, row.w, row.acv, row.mo, row.ev, row.conf]);
  rows.unshift(['Account', 'Domain', 'Product', 'Industry', 'Segment', 'Modeled propensity % — not probability', 'Modeled ACV USD', 'Modeled months', 'Modeled value USD', 'Data confidence']);
  download(`Pipeline-${sel.value}.csv`, rows.map(row => row.map(csvValue).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
};

function briefFor(row, product) {
  const account = ACCT[row.d] || { v: {} };
  const evidence = product.drivers.filter(([key]) => account.v[key] !== undefined && OBS.includes(SIG[key]?.s)).slice(0, 3);
  const missing = product.drivers.filter(([key]) => account.v[key] === undefined).slice(0, 2).map(([key]) => SIG[key]?.l || key);
  return `<div class="briefLabel">Account at a glance</div><div class="factGrid"><div><small>Industry</small><b>${escapeHTML(row.i || 'Not recorded')}</b></div><div><small>Employees · imported</small><b>${Number(row.e).toLocaleString()}</b></div><div><small>Country</small><b>${escapeHTML(row.ct || 'Not recorded')}</b></div><div><small>Relationship signal</small><b>${row.sf ? 'Salesforce footprint detected' : 'No detected Salesforce footprint'}</b></div></div>
    <div class="briefLabel">Potential conversation angle</div><p class="briefIntro">${escapeHTML(product.edge)}</p><p class="quiet">Product-level hypothesis. Validate relevance with this account before using it as a claim.</p>
    <div class="grp"><h4>Evidence worth checking</h4>${evidence.length ? evidence.map(([key]) => `<div class="evidenceLine"><b>${escapeHTML(SIG[key].l)}</b> · ${escapeHTML(fmt(account.v[key][0], SIG[key].u))}<small>${escapeHTML(SRC[SIG[key].s] || SIG[key].s)} · imported observation</small></div>`).join('') : '<p class="quiet">No populated observed driver evidence for this product. Start by verifying the need.</p>'}
    <p class="quiet">${missing.length ? `Not populated: ${escapeHTML(missing.join('; '))}. ` : ''}Actual priorities, buying intent and the right stakeholder need confirmation.</p></div>
    <div class="grp"><h4>Possible buying role</h4><p>${escapeHTML(product.persona)}</p><p class="quiet">A suggested role for this product, not a verified contact.</p></div>${noteEditor(row, product)}`;
}
function currentItem() { return cur && workspace.opportunities[opportunityKey(sel.value, cur.d)]; }
function noteEditor(row, product) {
  const item = workspace.opportunities[opportunityKey(product.k, row.d)];
  if (!item) return '<p class="quiet" style="margin-top:28px">Save this opportunity to add private notes and a next step.</p>';
  return `<section class="noteEditor"><h3>Your working notes</h3><label for="nextStep">Next step</label><input id="nextStep" maxlength="500" placeholder="What will you do next?" value="${escapeHTML(item.nextStep)}"><label for="accountNotes">Notes</label><textarea id="accountNotes" maxlength="12000" placeholder="What you know, what to verify, and what the buyer said…">${escapeHTML(item.notes)}</textarea><div id="noteStatus">Saved on this Mac</div></section>`;
}
const originalDrawPane = drawPane;
drawPane = function () {
  if (!cur) return;
  const product = productByKey.get(sel.value), item = currentItem();
  if (ptab === 'brief') $('pB').innerHTML = briefFor(cur, product); else originalDrawPane();
  $('accountActions').innerHTML = item
    ? `<select id="opportunityStage" aria-label="Opportunity stage">${STAGES.map(stage => `<option value="${stage}">${stage}</option>`).join('')}</select><span class="quiet" style="margin:0">Saved to your pipeline</span><button class="textButton" id="removeOpportunity">Remove</button>`
    : '<button class="primaryButton" id="saveOpportunity">+ Save to my pipeline</button><span class="quiet" style="margin:0">Add your notes and next step</span>';
  if (item) {
    $('opportunityStage').value = item.stage;
    $('opportunityStage').onchange = e => { item.stage = e.target.value; item.updated = new Date().toISOString(); persist(); if (activeView === 'board') renderBoard(); };
    $('removeOpportunity').onclick = () => {
      // Keep notes available in a single-action undo until the next toast expires.
      const key = opportunityKey(sel.value, cur.d), removed = { ...item }; delete workspace.opportunities[key]; persist();
      drawPane(); if (activeView === 'board') renderBoard(); else render();
      $('toast').textContent = ''; toast('Opportunity removed.');
      const undo = document.createElement('button'); undo.textContent = 'Undo'; undo.className = 'secondary'; undo.style.marginLeft = '12px';
      undo.onclick = () => { workspace.opportunities[key] = removed; persist(); drawPane(); if (activeView === 'board') renderBoard(); toast('Opportunity restored.'); };
      $('toast').appendChild(undo); $('toast').style.pointerEvents = 'auto';
    };
    ['nextStep', 'accountNotes'].forEach(id => { if ($(id)) $(id).oninput = e => {
      item[id === 'nextStep' ? 'nextStep' : 'notes'] = e.target.value; item.updated = new Date().toISOString();
      $('noteStatus').textContent = persist() ? 'Saved on this Mac' : 'Not saved — export a backup';
    }; });
  } else $('saveOpportunity').onclick = () => {
    workspace.opportunities[opportunityKey(sel.value, cur.d)] = { product: sel.value, domain: cur.d, stage: 'Research', notes: '', nextStep: '', updated: new Date().toISOString() };
    const saved = persist(); ptab = 'brief'; syncPanelTabs(); drawPane(); if (saved) toast('Saved. Add a next step whenever you’re ready.');
  };
};
function syncPanelTabs() { document.querySelectorAll('.ptab').forEach(tab => tab.classList.toggle('on', tab.dataset.t === ptab)); }
const originalOpenPane = openPane, originalClosePane = closePane;
openPane = function (row) { previousFocus = document.activeElement; ptab = 'brief'; syncPanelTabs(); originalOpenPane(row); $('panel').focus(); };
closePane = function () { originalClosePane(); if (previousFocus?.isConnected) previousFocus.focus(); if (activeView === 'board') renderBoard(); };
$('pX').onclick = closePane; $('scrim').onclick = closePane;
document.addEventListener('keydown', event => {
  if (event.key === 'Tab' && $('panel').classList.contains('on')) {
    const elements = [...$('panel').querySelectorAll('button,select,input,textarea,[tabindex="0"]')].filter(el => !el.disabled);
    const first = elements[0], last = elements.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === $('panel'))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});

const TITLES = {
  queue: ['Your next opportunity', 'Find your next conversation.', 'Explore the evidence. Focus on the accounts worth understanding.'],
  prod: ['Salesforce portfolio', 'Understand the possibilities.', 'Product context, potential buyers and the signals behind each fit.'],
  dict: ['Behind the recommendation', 'Look at the evidence.', 'Explore what is observed, what is derived and what is still missing.'],
  data: ['Research provenance', 'Know where it comes from.', 'The imported universe, adoption evidence and training-label coverage.'],
  val: ['Model transparency', 'Confidence starts with honesty.', 'Inspect validation, data gaps and limitations before relying on a ranking.'],
  board: ['Your working pipeline', 'Make the next move clear.', 'A focused place for the accounts you choose to pursue.']
};
function updateView(view) {
  activeView = view; closePane();
  const [eyebrow, title, subtitle] = TITLES[view];
  $('pageEyebrow').textContent = eyebrow; $('pageTitle').textContent = title; $('pageSubtitle').textContent = subtitle;
  $('overview').hidden = view !== 'queue'; $('boardView').hidden = view !== 'board';
  document.querySelector('.productContext').hidden = view !== 'queue';
  $('boardNav').classList.toggle('on', view === 'board');
  document.querySelectorAll('.tab').forEach(tab => tab.setAttribute('aria-current', tab.dataset.v === view ? 'page' : 'false'));
  if (view === 'board') {
    document.querySelectorAll('.wrap,.bar').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('on')); renderBoard();
  }
  if (view === 'queue') render();
  window.scrollTo({ top: 0 });
}
document.querySelectorAll('.tab').forEach(tab => { const original = tab.onclick; tab.onclick = () => { original(); updateView(tab.dataset.v); }; });
$('boardNav').onclick = () => updateView('board');
$('discoverButton').onclick = () => document.querySelector('[data-v="queue"]').click();
function renderBoard() {
  const entries = Object.entries(workspace.opportunities);
  $('board').innerHTML = STAGES.map(stage => {
    const matching = entries.filter(([, item]) => item.stage === stage);
    return `<section class="column"><div class="columnHead"><i class="stageDot"></i>${stage}<span>${matching.length}</span></div>${matching.length ? matching.map(([key, item]) => {
      const row = rowIndex.get(item.product).get(item.domain), product = productByKey.get(item.product);
      return `<button class="opportunity" data-opportunity="${escapeHTML(key)}"><b>${escapeHTML(row.c)}</b><small>${escapeHTML(product.n)}</small><div class="task">${escapeHTML(item.nextStep || 'Choose a useful next step →')}</div></button>`;
    }).join('') : '<div class="columnEmpty">Room for your next opportunity</div>'}</section>`;
  }).join('');
  $('board').querySelectorAll('[data-opportunity]').forEach(button => button.onclick = () => {
    const item = workspace.opportunities[button.dataset.opportunity]; sel.value = item.product; openPane(rowIndex.get(item.product).get(item.domain));
  });
}
$('backupWorkspace').onclick = () => download(`Pipeline-workspace-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(workspace, null, 2), 'application/json');
$('restoreWorkspace').onclick = () => $('restoreFile').click();
$('restoreFile').onchange = async event => {
  const file = event.target.files?.[0]; if (!file) return;
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error('Backup is too large.');
    const restored = validateWorkspace(JSON.parse(await file.text()));
    // Merge: existing notes win on collisions, so importing cannot silently overwrite work.
    const merged = { version: 1, opportunities: { ...restored.opportunities, ...workspace.opportunities } };
    if (persist(merged)) { render(); if (activeView === 'board') renderBoard(); toast('Backup merged. Existing notes were preserved.'); }
  } catch (error) { toast(error.message || 'Unable to restore this backup.'); }
  event.target.value = '';
};
$('aboutButton').onclick = () => $('aboutDialog').showModal(); $('closeAbout').onclick = () => $('aboutDialog').close();
const companies = [...new Map(all.map(row => [row.d, { domain: row.d, name: row.c }])).values()];
function commandResults() {
  const term = $('commandSearch').value.trim().toLowerCase();
  const matches = term ? companies.filter(row => `${row.name} ${row.domain}`.toLowerCase().includes(term)).slice(0, 8) : [];
  $('commandResults').innerHTML = term ? (matches.length ? matches.map(row => `<button data-domain="${escapeHTML(row.domain)}">${escapeHTML(row.name)}<small>${escapeHTML(row.domain)}</small></button>`).join('') : '<p>No account found in the imported snapshot.</p>') : '<p>Start typing a company name. Search spans all products.</p>';
  $('commandResults').querySelectorAll('[data-domain]').forEach(button => button.onclick = () => {
    const domain = button.dataset.domain;
    const key = rowIndex.get(sel.value)?.has(domain) ? sel.value : PRODUCTS.find(p => rowIndex.get(p.k)?.has(domain))?.k;
    if (!key) return;
    sel.value = key; $('q').value = domain; ['seg', 'ind', 'cty'].forEach(id => $(id).value = ''); filters.clear();
    document.querySelectorAll('[data-f]').forEach(chip => chip.classList.remove('on'));
    pageIndex = 0; $('commandDialog').close(); document.querySelector('[data-v="queue"]').click(); render(); openPane(rowIndex.get(key).get(domain));
  });
}
function openCommand() { $('commandDialog').showModal(); $('commandSearch').value = ''; commandResults(); $('commandSearch').focus(); }
$('commandButton').onclick = openCommand; $('commandSearch').oninput = commandResults; $('closeCommand').onclick = () => $('commandDialog').close();
document.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); closePane(); openCommand(); } });
document.addEventListener('click', event => { const filter = document.querySelector('.filters'); if (filter.open && !filter.contains(event.target)) filter.open = false; });
// Use the focused overview as the default drawer, including the first account opened.
ptab = 'brief'; updateCounts(); render();
