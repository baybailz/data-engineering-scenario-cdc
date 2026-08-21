-- Transform: the deduped change log. The source system can redeliver a
-- change it already sent (at-least-once delivery); tx_seq is its own
-- identity for a change, so the same tx_seq showing up in a later batch is
-- the same event, not a new one. Keep the earliest landing of each tx_seq
-- and drop the rest. Grain and unique_key are both tx_seq.
{{ config(unique_key='tx_seq') }}

with incoming as (
    select * from {{ ref('stg_incoming_order_change') }}
),

deduped as (
    select
        incoming.*,
        row_number() over (
            partition by incoming.tx_seq
            order by incoming.source_file, incoming.row_num
        ) as delivery_rank
    from incoming
)

select
    record_key,
    source_file,
    row_num,
    op,
    order_id,
    customer_id,
    status,
    amount,
    changed_at,
    tx_seq
from deduped
where delivery_rank = 1
order by tx_seq
