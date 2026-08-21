-- An update after a delete must never resurrect the order. Any order with a
-- delete event anywhere in its change log must still read as deleted in
-- dim_order, no matter what tx_seq arrived after that delete.
select fact_order_change.order_id
from {{ ref('fact_order_change') }}
inner join {{ ref('dim_order') }} on fact_order_change.order_id = dim_order.order_id
where
    fact_order_change.op = 'D'
    and not dim_order.is_deleted
