import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const scripts = ['bootstrap.js', 'dataset.js', 'engine.js', 'workspace.js'].map(f => read(`app/${f}`)).join('\n');
const html = read('app/index.html').replace(/<script[^>]*>.*?<\/script>/gs, '');
async function mount(run, stored) {
  const window = new Window({ url: 'http://localhost/', settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  if (stored) window.localStorage.setItem('pipeline-intelligence.workspace.v1', stored);
  window.document.write(html);
  const downloads = [];
  window.URL.createObjectURL = blob => { downloads.push(blob); return 'blob:local-test'; };
  window.URL.revokeObjectURL = () => {};
  window.eval(scripts + '\nwindow.inspect = { getRows: () => rowsNow(), product: () => sel.value, productCount: PRODUCTS.length, sourceRow: (key, domain) => rowIndex.get(key).get(domain), validateWorkspace, csvValue };');
  const $ = selector => window.document.querySelector(selector);
  const click = selector => { const node = $(selector); assert.ok(node, selector); node.click(); };
  const input = (selector, value, type = 'input') => { $(selector).value = value; $(selector).dispatchEvent(new window.Event(type, { bubbles: true })); };
  try { await run({ window, $, click, input, downloads }); }
  finally { await window.happyDOM.abort(); window.close(); }
}

test('the imported dataset is byte-for-byte preserved', () => {
  const manifest = JSON.parse(read('source-manifest.json'));
  const hash = content => crypto.createHash('sha256').update(content).digest('hex');
  assert.equal(hash(read('app/dataset.js')), manifest.datasetSha256);
});
test('initial workspace displays the full universe but only 40 rows, with advanced filters collapsed', () => mount(({ $, window }) => {
  assert.equal($('#sCo').textContent, '8,399'); assert.equal(window.inspect.productCount, 53);
  assert.equal(window.document.querySelectorAll('#tb tr').length, 40);
  assert.equal($('.filters').open, false); assert.equal($('.productContext').open, false);
  assert.equal($('#boardView').hidden, true);
  const ids = [...window.document.querySelectorAll('[id]')].map(node => node.id);
  assert.equal(new Set(ids).size, ids.length);
}));
test('pagination changes actual rows without changing model values; search resets the page', () => mount(({ $, click, input, window }) => {
  const first = $('#tb tr .co').textContent;
  const row = window.inspect.getRows()[0], before = JSON.stringify(row);
  click('#nextPage'); assert.notEqual($('#tb tr .co').textContent, first); assert.match($('#pagination').textContent, /41–80/);
  input('#q', row.d); assert.equal($('#tb tr .co').textContent, first);
  assert.equal(JSON.stringify(window.inspect.getRows()[0]), before);
}));
test('account overview shows evidence and hypotheses separately; source detail remains available', () => mount(({ $, click }) => {
  click('#tb tr'); assert.ok($('#panel').classList.contains('on'));
  assert.match($('#pB').textContent, /Product-level hypothesis/);
  assert.match($('#pB').textContent, /not a verified contact/);
  click('[data-t="score"]'); assert.match($('#pB').textContent, /ranking signal, not a forecast/);
  click('[data-t="signals"]'); assert.match($('#pB').textContent, /observed|derived|enrichment/);
  click('[data-t="approach"]'); assert.match($('#pB').textContent, /not confirmed incumbents/);
}));
test('save, notes, stage and next step survive reload without HTML injection', async () => {
  let stored;
  await mount(({ $, click, input, window }) => {
    click('#tb tr'); click('#saveOpportunity');
    input('#accountNotes', '<img src=x onerror=alert(1)>'); input('#nextStep', 'Ask about the current workflow');
    input('#opportunityStage', 'In conversation', 'change');
    stored = window.localStorage.getItem('pipeline-intelligence.workspace.v1');
    click('#pX'); click('#boardNav'); assert.equal(window.document.querySelectorAll('.opportunity').length, 1);
    assert.match($('.opportunity').textContent, /Ask about the current workflow/);
    assert.equal($('.column:nth-child(3) .opportunity') !== null, true);
  });
  await mount(({ $, click }) => {
    assert.equal($('#savedCount').textContent, '1'); click('#boardNav'); click('.opportunity');
    assert.equal($('#accountNotes').value, '<img src=x onerror=alert(1)>'); assert.equal($('#pB img'), null);
    assert.equal($('#opportunityStage').value, 'In conversation');
  }, stored);
});
test('different product opportunities keep independent notes and returning from board updates product results', () => mount(({ $, click, input, window }) => {
  click('#tb tr'); click('#saveOpportunity'); input('#accountNotes', 'First product'); click('#pX');
  const firstProduct = $('#prod').value;
  const secondProduct = [...$('#prod').options].find(o => o.value !== firstProduct).value;
  input('#prod', secondProduct, 'change'); const secondName = $('#prod').selectedOptions[0].textContent;
  click('#tb tr'); click('#saveOpportunity'); input('#accountNotes', 'Second product'); click('#pX');
  click('#boardNav'); const cards = [...window.document.querySelectorAll('.opportunity')];
  assert.equal(cards.length, 2); cards[1].click(); assert.equal($('#accountNotes').value, 'Second product');
  click('#pX'); click('[data-v="queue"]'); assert.equal($('#ttl').textContent, secondName);
}));
test('removing an opportunity supports undo without losing notes', () => mount(({ $, click, input }) => {
  click('#tb tr'); click('#saveOpportunity'); input('#accountNotes', 'Keep this note');
  click('#removeOpportunity'); assert.equal($('#savedCount').textContent, '0'); click('#toast button');
  assert.equal($('#savedCount').textContent, '1'); assert.equal($('#accountNotes').value, 'Keep this note');
}));
test('all secondary views render; validation and data adoption labels have separate tables', () => mount(({ $, click }) => {
  click('[data-v="data"]'); const data = $('#labB').textContent; assert.ok(data.length > 100);
  click('[data-v="val"]'); assert.ok($('#modelLabels').textContent.length > 100); assert.equal($('#labB').textContent, data);
  assert.match($('#valNote').textContent, /near-random/);
  click('[data-v="prod"]'); assert.ok($('#prodb').children.length === 53);
  click('[data-v="dict"]'); assert.ok($('#dictb').children.length > 100);
  assert.equal($('.productContext').hidden, true); assert.equal($('#overview').hidden, true);
}));
test('signal dictionary filters affect only signal rows', () => mount(({ $, click, window }) => {
  const before = window.inspect.getRows().length; click('[data-v="dict"]');
  const all = $('#dictb').children.length; click('[data-d="obs"]');
  assert.ok($('#dictb').children.length < all); assert.ok($('#dictb').children.length > 0);
  assert.equal(window.inspect.getRows().length, before);
}));
test('command search crosses products and opens the selected account', () => mount(({ $, click, input }) => {
  click('#commandButton'); input('#commandSearch', 'Target');
  assert.ok($('#commandResults button')); const name = $('#commandResults button').textContent;
  click('#commandResults button'); assert.ok(name.includes($('#pT').textContent));
  assert.ok($('#panel').classList.contains('on')); assert.equal($('#commandDialog').open, false);
}));
test('workspace backups validate input; formula-looking CSV text is escaped', () => mount(({ window }) => {
  assert.throws(() => window.inspect.validateWorkspace({ version: 2, opportunities: {} }));
  assert.throws(() => window.inspect.validateWorkspace({ version: 1, opportunities: { bad: { product: 'fake', domain: 'fake' } } }));
  assert.equal(window.inspect.csvValue('=1+1'), '"\'=1+1"');
  assert.equal(window.inspect.csvValue('Name, Inc.'), '"Name, Inc."');
}));
test('keyboard account access and Escape work, and exported workspace is available', () => mount(({ $, click, window, downloads }) => {
  $('#tb tr').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.ok($('#panel').classList.contains('on'));
  window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal($('#panel').classList.contains('on'), false);
  click('#backupWorkspace'); assert.equal(downloads.length, 1);
}));
test('desktop shell isolates renderer, denies permissions and blocks outbound requests', () => {
  const main = read('main.js');
  assert.match(main, /contextIsolation: true, nodeIntegration: false, sandbox: true/);
  assert.match(main, /setPermissionRequestHandler/); assert.match(main, /cancel: true/);
  assert.match(html, /connect-src 'none'/); assert.doesNotMatch(html, /https:\/\/.*?\.js/);
});
