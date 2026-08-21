-- Datamart: orders that are current and not deleted. What BI reads for
-- "what's open right now" without anyone re-deriving is_deleted.
select
    dim_order.order_id,
    dim_order.customer_id,
    dim_order.status,
    dim_order.amount,
    dim_order.changed_at
from {{ ref('dim_order') }}
where dim_order.is_deleted = false
order by dim_order.order_id
