-- Ascend's view of the applicant, learned from /openApi/users.
--
-- These land before any Order exists: the New vs Reloan check happens right
-- after MyInfo, and a Reloan Customer leaves the web funnel there without a
-- credit pull ever being spent (ADR-0001). So they cannot live on
-- ascend_orders, which only has rows for applicants who got that far.
--
-- ascend_user_id is TEXT, not a numeric type. Ascend's ids exceed
-- Number.MAX_SAFE_INTEGER - 1426270128715821056 becomes 1426270128715821000
-- once anything treats it as a JavaScript number - so it must stay a string
-- from the wire to the column.

alter table applicants
  add column ascend_user_id     text,
  -- Ascend is the only authority on this. Never inferred from our own records.
  add column ascend_new_customer boolean,
  -- Whether that user has authorised MyInfo with Ascend. Decides whether
  -- /openApi/apply/credit can be called with userId alone, or needs the whole
  -- myinfo object passed in.
  add column ascend_has_myinfo   boolean;

create index applicants_ascend_user_id_idx
  on applicants (ascend_user_id) where ascend_user_id is not null;

comment on column applicants.ascend_user_id is
  'Ascend userId. TEXT because the value exceeds Number.MAX_SAFE_INTEGER.';
comment on column applicants.ascend_new_customer is
  'From /openApi/users. false = Reloan Customer, who leaves the web funnel.';
