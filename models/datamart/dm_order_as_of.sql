-- Datamart: state of every order at the end of each batch. A simple as-of
-- view, not a snapshot table: for every batch, the latest field values as
-- of that batch's last tx_seq, with the same sticky deletion rule as
-- dim_order (once any change for an order is a delete, it reads deleted as
-- of every later batch too, even if a later change tries to resurrect it).
with batches as (
    select
        source_file,
        max(tx_seq) as batch_max_tx_seq
    from {{ ref('fact_order_change') }}
    group by source_file
),

orders as (
    select distinct order_id from {{ ref('fact_order_change') }}
),

changes_as_of as (
    select
        batches.source_file,
        orders.order_id,
        fact_order_change.status,
        fact_order_change.amount,
        fact_order_change.tx_seq,
        bool_or(fact_order_change.op = 'D') over (
            partition by batches.source_file, orders.order_id
        ) as is_deleted,
        row_number() over (
            partition by batches.source_file, orders.order_id
            order by fact_order_change.tx_seq desc
        ) as rn
    from batches
    cross join orders
    inner join {{ ref('fact_order_change') }}
        on
            fact_order_change.order_id = orders.order_id
            and fact_order_change.tx_seq <= batches.batch_max_tx_seq
)

select
    changes_as_of.source_file as batch,
    changes_as_of.order_id,
    changes_as_of.status,
    changes_as_of.amount,
    changes_as_of.is_deleted
from changes_as_of
where changes_as_of.rn = 1
order by changes_as_of.source_file, changes_as_of.order_id
