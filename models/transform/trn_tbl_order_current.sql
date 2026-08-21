-- Transform: latest state per order, deletion sticky. apply_cdc() ranks the
-- deduped change log by tx_seq within each order_id (last write wins on
-- status/amount) and separately flags is_deleted true if ANY change for
-- that order was a delete, regardless of what arrives after it. See
-- macros/apply_cdc.sql for why that is deliberate.
{{ config(unique_key='order_id') }}

select
    order_id,
    customer_id,
    status,
    amount,
    changed_at,
    tx_seq as latest_tx_seq,
    is_deleted,
    deleted_at
from ({{ apply_cdc(ref('trn_tbl_order_change'), 'order_id', 'tx_seq', 'op') }})
