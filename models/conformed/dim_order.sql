-- Conformed: the order dimension. Publish only, no new logic; the state
-- (latest status/amount, is_deleted, deleted_at) was already decided in
-- trn_tbl_order_current. Incremental on order_key: a repeated run upserts
-- the same order instead of duplicating it, and a row is never physically
-- removed when an order is deleted, only flagged. Soft delete only.
{{ config(unique_key='order_key') }}

with trn_tbl_order_current as (
    select * from {{ ref('trn_tbl_order_current') }}
)

select
    {{ surrogate_key(['trn_tbl_order_current.order_id']) }} as order_key,
    {{ surrogate_key(['trn_tbl_order_current.customer_id']) }} as customer_key,
    trn_tbl_order_current.order_id,
    trn_tbl_order_current.customer_id,
    trn_tbl_order_current.status,
    trn_tbl_order_current.amount,
    trn_tbl_order_current.changed_at,
    trn_tbl_order_current.latest_tx_seq,
    trn_tbl_order_current.is_deleted,
    trn_tbl_order_current.deleted_at,
    current_timestamp as dbt_run_timestamp
from trn_tbl_order_current
