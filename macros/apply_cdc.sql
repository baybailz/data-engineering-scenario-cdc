{#
  Same idea as the CDC macro I built at Rush (handle_cdc_load.sql): an
  opflag-driven deletion flag plus a qualify dedup to the latest row per key.
  Two departures from that macro, both deliberate:

  1. is_deleted is STICKY. bool_or(...) over the whole partition, not just
     the latest row. Once any row for a key is op='D', is_deleted stays true
     even if a later change (a higher tx_seq) arrives with a different op.
     A CDC log can carry an update after a delete (a late, stale write from
     the source system, or a redelivery); the business rule here is that a
     deletion is never implicitly undone by anything downstream of it.
  2. deleted_at is carried alongside it, taken from the same partition, so a
     dimension can show when a still-deleted-forever row was deleted even
     though its "latest" attributes come from a later row.

  Expects `relation` to expose a `changed_at` timestamp column alongside
  `key`, `seq`, and `op_col`. Returns full rows (*) from `relation`, one per
  distinct `key`, plus is_deleted and deleted_at.
#}
{% macro apply_cdc(relation, key, seq, op_col) -%}
    select
        {{ relation.identifier }}.*,
        bool_or({{ op_col }} = 'D') over (partition by {{ key }}) as is_deleted,
        min(case when {{ op_col }} = 'D' then changed_at end)
            over (partition by {{ key }}) as deleted_at
    from {{ relation }} as {{ relation.identifier }}
    qualify row_number() over (partition by {{ key }} order by {{ seq }} desc) = 1
{%- endmacro %}
