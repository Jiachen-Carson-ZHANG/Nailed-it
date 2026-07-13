"""Nailed-it merchant operations agent team (ADR-0007).

Full-Python multi-agent service. Reasoning runs on Claude; the team reads grounded numbers from the
TS app's /api/agent/briefing endpoint and writes its runs + actions to Supabase, which the
/merchant/agents panel reads. Supabase is the shared bus — the only TS contact is the briefing read.
"""
