"""Scenario hooks for export_json.py.

summary(con, ctx)  -> dict merged into summary.json (headline numbers)
history(con, ctx)  -> dict: one cell per pipeline step key in scenario.json,
                      plus anything else the console's log row wants.
extra(ctx)         -> optional: {"name.json": payload} for anything else the
                      page wants (a V1 file set, a scorecard, a golden set).
ctx has: action, loaded, queue, next_file, passed, failed, cfg
"""

# A row that already landed in an earlier file, redelivered under the same
# tx_seq, is the "at-least-once delivery" case: same event, later batch.
REDELIVERED_SQL = """
    select count(*) from main.stg_incoming_order_change t
    where t.source_file = ?
    and exists (
        select 1 from main.stg_incoming_order_change t2
        where t2.tx_seq = t.tx_seq and t2.source_file < t.source_file
    )
"""
OP_COUNTS_SQL = """
    select op, count(*) from main.stg_incoming_order_change t
    where t.source_file = ?
    and not exists (
        select 1 from main.stg_incoming_order_change t2
        where t2.tx_seq = t.tx_seq and t2.source_file < t.source_file
    )
    group by op
"""


def _plural(n: int, word: str) -> str:
    return f"{n} {word}{'' if n == 1 else 's'}"


def summary(con, ctx) -> dict:
    orders_total = con.execute("select count(*) from main.dim_order").fetchone()[0]
    orders_open = con.execute(
        "select count(*) from main.dim_order where not is_deleted").fetchone()[0]
    orders_deleted = con.execute(
        "select count(*) from main.dim_order where is_deleted").fetchone()[0]
    changes_applied = con.execute("select count(*) from main.fact_order_change").fetchone()[0]
    redelivered_total = con.execute(
        "select count(*) from main.stg_incoming_order_change t "
        "where exists (select 1 from main.stg_incoming_order_change t2 "
        "where t2.tx_seq = t.tx_seq and t2.source_file < t.source_file)"
    ).fetchone()[0]
    return {"orders_total": orders_total, "orders_open": orders_open,
            "orders_deleted": orders_deleted, "changes_applied": changes_applied,
            "redelivered_ignored": redelivered_total}


def history(con, ctx) -> dict:
    last = ctx["loaded"][-1] if ctx["action"] != "reset" and ctx["loaded"] else None
    if ctx["action"] == "reset":
        python = "reset · queue cleared"
    elif last:
        ops = dict(con.execute(OP_COUNTS_SQL, [last]).fetchall())
        redelivered = con.execute(REDELIVERED_SQL, [last]).fetchone()[0]
        total = sum(ops.values()) + redelivered
        parts = []
        if ops.get("I"):
            parts.append(_plural(ops["I"], "insert"))
        if ops.get("U"):
            parts.append(_plural(ops["U"], "update"))
        if ops.get("D"):
            parts.append(_plural(ops["D"], "delete"))
        if redelivered:
            parts.append(f"{redelivered} redelivered (ignored)")
        python = f"{last}.csv · {_plural(total, 'change')} · " + ", ".join(parts)
    else:
        python = "nothing left to load"

    dbt = (f"dbt build --select {ctx['cfg']['dbt_select']} · PASS={ctx['passed']}"
           if ctx["passed"] else "—")

    if last or ctx["action"] == "reset":
        open_n = con.execute(
            "select count(*) from main.dim_order where not is_deleted").fetchone()[0]
        fact_n = con.execute("select count(*) from main.fact_order_change").fetchone()[0]
        out = f"dim_order → {open_n} open · fact_order_change → {fact_n} rows"
    else:
        out = "—"

    return {"python": python, "dbt": dbt, "out": out, "loaded_file": last}
