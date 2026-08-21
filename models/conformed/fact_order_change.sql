-- Conformed: the full audit log. Publish only, no new logic. Grain is one
-- row per change event; tx_seq is both the natural key and the unique_key,
-- so a repeated run upserts the same event instead of duplicating it.
{{ config(unique_key='tx_seq') }}

with trn_tbl_order_change as (
    select * from {{ ref('trn_tbl_order_change') }}
)

select
    trn_tbl_order_change.tx_seq,
    trn_tbl_order_change.order_id,
    trn_tbl_order_change.customer_id,
    trn_tbl_order_change.op,
    trn_tbl_order_change.status,
    trn_tbl_order_change.amount,
    trn_tbl_order_change.changed_at,
    trn_tbl_order_change.source_file,
    current_timestamp as dbt_run_timestamp
from trn_tbl_order_change
