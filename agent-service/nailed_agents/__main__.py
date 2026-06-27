"""Entry point: `python -m nailed_agents` runs one round of the team."""
from .orchestrator import run_round

if __name__ == "__main__":
    run_round()
