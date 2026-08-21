-- No deleted order may appear as open in dm_open_orders. is_deleted is
-- decided once, in trn_tbl_order_current, and dm_open_orders is supposed to
-- filter on it; this test catches the join or filter breaking silently.
select dm_open_orders.order_id
from {{ ref('dm_open_orders') }}
inner join {{ ref('dim_order') }} on dm_open_orders.order_id = dim_order.order_id
where dim_order.is_deleted
