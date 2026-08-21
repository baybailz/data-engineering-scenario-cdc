# Inserts, updates, deletes. One change log in. Current state and history out.

An orders system emits a change log: `op` (insert, update, delete), a `tx_seq`, and the
row's fields, one event per line, the same shape as Debezium or Aecorsoft CDC output.
The feed can redeliver an event it already sent, and an update can arrive after the
row it touches was already deleted. This pipeline applies the log idempotently and
publishes both the current state of every order and the full change history.

**[Live demo →](https://baybailz.github.io/data-engineering-scenario-cdc/)** — a presentation
and a working console. The Load button dispatches a GitHub Actions workflow that runs
the real pipeline and publishes the result back to the page.

## The hard part

Order 1003 gets inserted, then deleted. A later batch redelivers a stale update for
it; the source system does not know it is gone:

| tx_seq | op | Applied? |
|---|---|---|
| 3 | insert | current row created |
| 8 | delete | current row flagged deleted |
| 17 | update | **ignored** — the delete is sticky |

A later, higher-tx_seq change does not undo an earlier delete. `dim_order.is_deleted`
is computed as `bool_or(op = 'D')` over the whole change history for that key, not
just whatever landed last. See `macros/apply_cdc.sql`.

Separately, `tx_seq` 7 shows up twice, once in `changes_02.csv` and again, redelivered,
in `changes_03.csv`. It is deduped to one applied change, one row in `fact_order_change`,
not two.

## How it works

1. **Land.** `scripts/run.py` appends the next batch to the landing seed, stamped with
   `source_file` and `row_num`. Append-only; nothing is rewritten except on reset.
2. **Dedupe.** `trn_tbl_order_change` drops any tx_seq already seen, so a redelivery
   changes nothing.
3. **Apply.** `trn_tbl_order_current` ranks the deduped log by tx_seq per order (last
   write wins on status and amount) and sets `is_deleted` sticky, once true always true,
   via `macros/apply_cdc.sql`.
4. **Publish.** `dim_order` and `fact_order_change` are incremental and tested; a delete
   never removes a row, it only flags one. `dm_open_orders` and `dm_order_as_of` read
   from there.

Master rule: `tx_seq` is the only ordering that matters, not arrival order and not
`changed_at`. Re-running is safe: `dim_order` is incremental on `order_key`, and the
landing seed is a pure function of the state file.

## Layout

```
incoming/             changes_01.csv .. changes_06.csv, the simulated CDC feed
scripts/              run.py (land the next batch), scenario.py (page hooks)
seeds/                incoming_order_change, rebuilt from state on every run
models/stage/         rename and type the landing table, no logic
models/transform/     dedupe by tx_seq · apply_cdc: rank + sticky delete
models/conformed/     dim_order · dim_customer · fact_order_change
models/datamart/      dm_open_orders · dm_order_as_of
macros/apply_cdc.sql  dedupe by sequence, last write wins, tombstone not delete
tests/                deleted orders never open · no resurrection after delete
docs/                 the presentation and console, published by Pages
```

## Run it

Locally, free, about two minutes:

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
export DBT_PROFILES_DIR=.
.venv/bin/python scripts/run.py --action reset && .venv/bin/dbt build --select tag:scenario --full-refresh
.venv/bin/python scripts/run.py --action load_next && .venv/bin/dbt build --select tag:scenario
.venv/bin/python scripts/export_json.py --action load_next
(cd docs && python3 -m http.server 8000)   # http://localhost:8000
```

Repeat `load_next` to work through the remaining batches; `--action reset` starts over.
Those are the same commands the GitHub Actions pipeline runs.

## What I would add next

- A true watermark table instead of re-deriving "already loaded" from the seed's
  own `source_file` column, closer to how a real CDC consumer tracks its offset.
- Column-level change detection (only U rows that actually changed a value), so a
  no-op update from the source doesn't read as a real change in the audit log.
