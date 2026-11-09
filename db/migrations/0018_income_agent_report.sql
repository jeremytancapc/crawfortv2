-- The agent's own reading of the documents, next to its decision.
--
-- The agent reads the documents for itself (lib/income-agent.ts), so when it
-- and the rules disagree the cause is one of two things: it read the documents
-- differently, or it read them the same and judged them differently. Without
-- its report there is no telling which. The rules' own report is in
-- income_model_calls; this is the agent's, for the same submission.

alter table income_agent_runs
  add column agent_report jsonb;

comment on column income_agent_runs.agent_report is
  'The report the agent sent to check_rules, as it sent it. Null if it never ran the rules.';
