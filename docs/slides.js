/* Slides for this scenario. Each slide: {id, kicker, render() -> html}.
   S exposes shell helpers and the live data (S.D), config (S.CFG). */
'use strict';
const m = t => `<span class="mono">${t}</span>`;
const EXAMPLE_ORDER = 1002;

window.SLIDES = [
  {id:'title', kicker:'SCENARIO', render(){
    const {esc} = S;
    return `<div class="titleslide">
      <div class="kicker">Scenario walkthrough</div>
      <h2>Inserts, updates, deletes.<br>One change log in.</h2>
      <div class="stackchips">
        <span class="schip hot">python</span><span class="schip hot">dbt</span>
        <span class="schip">duckdb</span><span class="schip">github actions</span>
      </div>
      <p class="lead">An orders system emits a change log: insert, update, delete, one row per
        event, like Debezium or Aecorsoft CDC output. This pipeline applies it idempotently and
        produces both the current state of every order and the full history of how it got there.</p>
      <div class="byline">${esc(S.CFG.author)}</div>
    </div>`;}},

  {id:'assumptions', kicker:'ASSUMPTIONS & STRATEGY', render(){
    return `<h2>Assumptions &amp; strategy</h2>
      <div class="ptsec">What I assumed</div>
      <ul class="pointlist">
        <li><span class="pt">1</span><span><b>The log is at-least-once, not exactly-once.</b> The same ${m('tx_seq')} can arrive twice, and a redelivery is not a new event.</span></li>
        <li><span class="pt">2</span><span><b>tx_seq is the only ordering that matters.</b> Not ${m('changed_at')} and not arrival order: within a batch, the highest tx_seq wins.</span></li>
        <li><span class="pt">3</span><span><b>A delete is sticky.</b> Once an order is deleted, no later change un-deletes it, even a higher-tx_seq update.</span></li>
      </ul>
      <div class="ptsec">How I built it</div>
      <ul class="pointlist">
        <li><span class="pt">1</span><span><b>Layered.</b> stage (rename) → transform (dedup + apply CDC) → conformed (publish, keyed, tested) → datamart (what BI reads).</span></li>
        <li><span class="pt">2</span><span><b>Soft delete only.</b> ${m('dim_order')} never drops a row; ${m('is_deleted')} and ${m('deleted_at')} carry the fact.</span></li>
        <li><span class="pt">3</span><span><b>Nothing merges red.</b> CI lints the SQL and builds every model with its tests on every pull request.</span></li>
      </ul>`;}},

  {id:'arch', kicker:'THE ARCHITECTURE', render(){
    return `<h2>The architecture</h2>
      <p class="lead">Load dispatches a GitHub Actions workflow: Python lands the next batch, dbt builds and tests,
        results are committed back as JSON. A real pipeline, driven from a web page.</p>
      <div class="diagram" style="position:relative">
        ${S.isNarrow()?S.archFlow():S.svgArch()}
        ${S.isNarrow()?'':`<button class="zoombtn" id="archZoomBtn">${S.archZoom?'&#8854; full picture':'&#8853; zoom to pipeline'}</button>`}
      </div>`;}},

  {id:'lineage', kicker:'DBT LINEAGE', render(){
    return `<h2>dbt lineage</h2>
      <p class="lead">Read from the dbt manifest after the last build, so the picture can never drift from the project.</p>
      <div class="diagram" style="margin:38px 0 26px">${S.isNarrow()?S.dagFlow():S.svgDag()}</div>
      ${S.dagLegend()}`;}},

  {id:'code', kicker:'THE CODE', render(){
    const files = S.D.models?.files || [];
    const lines = files.reduce((a,f)=>a+f.sql.split('\n').length,0);
    return `<h2>The code</h2>
      <p class="lead">${files.length} files, ~${Math.round(lines/10)*10} lines. Same idea as the CDC macro I built
        at Rush: opflag + qualify dedup. Press ▶ on a model to see its rows from the last run.</p>
      ${S.ideHtml()}`;}},

  {id:'sequence', kicker:'THE HARD PART · ONE ORDER', render(){
    const changes = (S.D.tables.fact_order_change||[])
      .filter(c=>c.order_id===EXAMPLE_ORDER).sort((a,b)=>a.tx_seq-b.tx_seq);
    const deleteSeq = changes.find(c=>c.op==='D')?.tx_seq;
    const current = (S.D.tables.dim_order||[]).find(o=>o.order_id===EXAMPLE_ORDER);
    const opWord = {I:'insert', U:'update', D:'delete'};
    const steps = changes.map(c=>{
      const ignored = deleteSeq!=null && c.tx_seq>deleteSeq && c.op!=='D';
      return `<div class="pt2step${ignored?' ignored':''}" style="display:flex;align-items:center;gap:10px;padding:8px 0;${ignored?'opacity:.5':''}">
        <span class="mono" style="min-width:34px">#${S.esc(c.tx_seq)}</span>
        ${S.badge(opWord[c.op]||c.op, {I:'b-new',U:'b-crm',D:'b-dup'}[c.op]||'b-crm')}
        <span class="mono">${S.esc(c.status)} · $${S.esc(c.amount)}</span>
        ${ignored?'<span class="hint">ignored — order already deleted</span>':''}
      </div>`;}).join('<div style="margin-left:17px;color:var(--ink3)">↓</div>');
    return `<h2>Order ${EXAMPLE_ORDER}: what actually happened</h2>
      <p class="lead">Every change this order ever received, in tx_seq order, next to the row it produces.</p>
      <div style="display:flex;gap:34px;flex-wrap:wrap;align-items:flex-start">
        <div style="flex:1;min-width:260px">${steps}</div>
        <div class="card" style="flex:1;min-width:260px;padding:16px 18px">
          <div class="hint" style="margin-bottom:8px">dim_order · current row</div>
          ${current?`<div class="mono" style="line-height:1.9">
            order_id: ${S.esc(current.order_id)}<br>
            status: ${S.esc(current.status)}<br>
            amount: $${S.esc(current.amount)}<br>
            is_deleted: ${current.is_deleted}<br>
            deleted_at: ${S.esc(current.deleted_at??'—')}</div>`
            :'<div class="empty">Not built yet</div>'}
        </div>
      </div>`;}},

  {id:'macro', kicker:'THE HARD PART · THE MACRO', render(){
    const file = (S.D.models?.files||[]).find(f=>f.path==='macros/apply_cdc.sql');
    return `<h2>apply_cdc(): three rules</h2>
      <div style="display:flex;gap:30px;flex-wrap:wrap;align-items:flex-start">
        <ul class="pointlist" style="flex:1;min-width:240px">
          <li><span class="pt">1</span><span><b>Dedupe by sequence.</b> A redelivered tx_seq is the same event, not a new row.</span></li>
          <li><span class="pt">2</span><span><b>Last write wins.</b> ${m('qualify row_number() over (partition by key order by seq desc) = 1')} picks the latest.</span></li>
          <li><span class="pt">3</span><span><b>Tombstone, not delete.</b> ${m('is_deleted')} is sticky: once true, no later row flips it back.</span></li>
        </ul>
        <div style="flex:1.4;min-width:320px">${file?S.codePanel(file.path,`${file.sql.split('\n').length} lines`,file.sql,'sql',360):'<div class="empty">Not published yet</div>'}</div>
      </div>`;}},

  {id:'result', kicker:'THE RESULT', render(){
    const rows = S.D.tables.dim_order || [];
    const body = rows.map(o=>`<tr${o.is_deleted?' class="rowdup"':''}>
        <td class="num mono faded">${S.esc(o.order_id)}</td>
        <td class="num mono faded">${S.esc(o.customer_id)}</td>
        <td${o.is_deleted?' style="opacity:.55;text-decoration:line-through"':''}>${S.esc(o.status)}</td>
        <td class="mono">$${S.esc(o.amount)}</td>
        <td>${o.is_deleted?S.badge('deleted','b-dup',S.ICO.close):S.badge('live','b-new',S.ICO.check)}</td></tr>`).join('');
    return `<h2>The result</h2>
      <p class="lead">${m('select * from dim_order')}</p>
      <div class="verdicts scrollbox"><table><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Amount</th><th>State</th></tr></thead>
      <tbody>${body}</tbody></table></div>`;}},
];
