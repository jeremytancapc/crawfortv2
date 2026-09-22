-- Tracks whether this applicant's details have been pushed to AirConnect as
-- a new lead. Separate from eligibility_status: eligibility is what
-- AirConnect told us about the applicant at submit; this is what we told
-- AirConnect back, once Ascend opens an order for them.
--
-- Nullable, set once: a null value means "push it (or retry it)", a set
-- timestamp means "already pushed, do not push again". Guards a resubmit
-- (same applicant hits submit twice) from creating a duplicate lead on
-- AirConnect's side.

alter table applicants
  add column airconnect_lead_pushed_at timestamptz;

comment on column applicants.airconnect_lead_pushed_at is
  'When this applicant was pushed to AirConnect as a new lead. Null = not yet pushed (or push failed and should retry).';
