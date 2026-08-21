/* Console tabs for this scenario.
   tabs:    [{key, label, count()}]  in display order
   render:  {key: () => html}        S.tablePanel / S.incomingPanel are generic
   afterRun(action) -> tab key to show when a run finishes (optional)
   toast(action, before, after) -> message after a run (optional) */
'use strict';
const OP_CLS = {I: 'b-new', U: 'b-crm', D: 'b-dup'};
const OP_ICO = {I: S.ICO.check, U: S.ICO.copy, D: S.ICO.close};
const opBadge = v => S.badge(v, OP_CLS[v] || 'b-crm', OP_ICO[v] || '');
const lastLoaded = () => (S.D.logs?.history || []).slice(-1)[0]?.loaded_file || null;
const lastBatchTxSeqs = () => new Set(
  (S.D.tables.fact_order_change || [])
    .filter(r => r.source_file === lastLoaded())
    .map(r => r.tx_seq));

window.PANELS = {
  tabs: [
    {key: 'incoming', label: 'incoming/*.csv', count: () => S.D.next?.name ? S.D.next.rows.length : 0},
    {key: 'dim_order', label: 'dim_order', count: () => (S.D.tables.dim_order || []).length},
    {key: 'fact_order_change', label: 'fact_order_change', count: () => (S.D.tables.fact_order_change || []).length},
    {key: 'dm_open_orders', label: 'dm_open_orders', count: () => (S.D.tables.dm_open_orders || []).length},
  ],
  render: {
    // Like S.incomingPanel() but with a colored op badge per row — the raw
    // feed is the clearest place to see I/U/D at a glance before anything
    // has been applied.
    incoming: () => {
      if (!S.D.next?.name) return S.incomingPanel();
      const cols = S.D.next.rows.length ? Object.keys(S.D.next.rows[0]) : [];
      const body = S.D.next.rows.map((r, i) => `<tr><td class="num faded">${i + 1}</td>${
        cols.map(c => `<td>${c === 'op' ? opBadge(r[c]) : S.esc(r[c] ?? '—')}</td>`).join('')}</tr>`).join('');
      return `<div class="card"><div class="cardhead"><h2><span class="mono">incoming/${S.esc(S.D.next.name)}.csv</span></h2><span class="hint">raw rows, not yet loaded</span></div>
        ${S.tableHTML(['#', ...cols], body)}<div class="loadbar">${S.runButton('loadBtn')}</div></div>`;
    },
    dim_order: () => {
      const touched = lastBatchTxSeqs();
      return S.tablePanel('dim_order', 'current state per order, soft delete only', {
        rowClass: r => touched.has(r.latest_tx_seq) ? 'rowimp' : '',
        cell: (c, v, r) => {
          if (c === 'is_deleted') return S.badge(v ? 'deleted' : 'open', v ? 'b-dup' : 'b-new');
          const text = S.esc(S.fmtCell(v));
          return r.is_deleted ? `<span style="text-decoration:line-through;opacity:.5">${text}</span>` : text;
        },
      });
    },
    fact_order_change: () => S.tablePanel('fact_order_change', 'the full audit log, one row per deduped change', {
      cell: (c, v) => c === 'op' ? opBadge(v) : S.esc(S.fmtCell(v)),
    }),
    dm_open_orders: () => S.tablePanel('dm_open_orders', 'what BI reads: current, not deleted'),
  },
  afterRun: action => action === S.CFG.actions.reset ? 'incoming' : 'dim_order',
  toast: (action, before, after) => {
    if (action === S.CFG.actions.reset) return 'Demo reset ↺';
    const parts = [], add = (n, w) => { if (n > 0) parts.push(`<b>${n}</b> ${w}`); };
    add((after.orders_total ?? 0) - (before.orders_total ?? 0), 'orders opened');
    add((after.orders_deleted ?? 0) - (before.orders_deleted ?? 0), 'orders deleted');
    add((after.redelivered_ignored ?? 0) - (before.redelivered_ignored ?? 0), 'redelivered changes ignored');
    return parts.length ? parts.join(' · ') : 'Load complete';
  },
};
