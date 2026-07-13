"""bus-level hygiene tests — network-free via a chainable fake Supabase table."""
from types import SimpleNamespace

from nailed_agents import bus


class _Chain:
    def __init__(self, rows):
        self._rows = rows
        self.fields = None
        self.filters = []

    def table(self, name):
        self.table_name = name
        return self

    def update(self, fields):
        self.fields = fields
        return self

    def eq(self, col, val):
        self.filters.append(("eq", col, val))
        return self

    def lt(self, col, val):
        self.filters.append(("lt", col, val))
        return self

    def execute(self):
        return SimpleNamespace(data=self._rows)


def test_sweep_stale_runs_marks_zombies_failed():
    """A process that dies mid-round leaves 'running' rows forever (no lease/heartbeat at demo
    scale — deliberate); the next round's sweep is the recovery story."""
    fake = _Chain(rows=[{"id": "r1"}, {"id": "r2"}])
    n = bus.sweep_stale_runs(fake, "m-1", older_than_minutes=30)
    assert n == 2
    assert fake.fields["status"] == "failed"
    assert "stale_run_swept" in fake.fields["output"]["error"]
    kinds = [(f[0], f[1]) for f in fake.filters]
    assert ("eq", "merchant_id") in kinds and ("eq", "status") in kinds and ("lt", "started_at") in kinds


def test_sweep_stale_runs_never_blocks_the_round():
    class Boom:
        def table(self, name):
            raise RuntimeError("db down")

    assert bus.sweep_stale_runs(Boom(), "m-1") == 0  # WARN + 0, never an exception
