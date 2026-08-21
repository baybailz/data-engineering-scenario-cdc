-- Conformed: the customer dimension. This scenario is a CDC feed off the
-- orders system, not a customer feed, so a customer here is only ever an
-- id that shows up on an order. Deliberately thin rather than invented.
{{ config(unique_key='customer_key') }}

with distinct_customer as (
    select distinct customer_id
    from {{ ref('trn_tbl_order_change') }}
)

select
    {{ surrogate_key(['distinct_customer.customer_id']) }} as customer_key,
    distinct_customer.customer_id,
    current_timestamp as dbt_run_timestamp
from distinct_customer
