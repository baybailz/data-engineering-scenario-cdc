-- Stage over the landing table. record_key identifies the incoming row;
-- tx_seq is the change log's own ordering and identity, carried through
-- untouched. No dedup, no business logic, that happens in transform.
with source as (
    select * from {{ ref('incoming_order_change') }}
)

select
    source_file || ':' || cast(row_num as varchar) as record_key,
    source_file,
    row_num,
    op,
    order_id,
    customer_id,
    status,
    amount,
    changed_at,
    tx_seq
from source
