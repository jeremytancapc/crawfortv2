-- The Google Sheet worklist (docs/sheet-worklist.md): every applicant and where
-- they stand, for staff to follow up.
--
-- The sheet lives in Google, outside our systems, so it gets no personal data:
-- no name, NRIC, mobile, email, address, income or loan amounts. Only the CFH5-
-- reference staff already use, the stage and the reasons. Staff find the
-- customer in AirConnect by the reference. That is why this is its own view,
-- not reporting.applicant_journey, which carries the mobile and the figures.
--
-- The sheet logs in as `sheet_worklist_reader`, which can read this view and
-- nothing else, so the password kept in Apps Script cannot reach customer data.
-- The view runs with its owner's rights, which is what lets that role read it
-- without any grant on the tables or views behind it.
--
-- The role is created without a password: set one by hand after applying,
--   alter role sheet_worklist_reader with password '<from the password manager>';
-- and never commit it.
--
-- Views and a role only, no data of their own, so this is safe to re-run.

create or replace view reporting.sheet_worklist as
select
  to_char(j.created_at, 'YYYY-MM-DD HH24:MI')                       as created_sgt,
  j.ref,
  j.apply                                                           as applied_via,
  j.journey_group                                                   as pile,
  j.stage,
  case when j.needs_follow_up then 'Yes' else 'No' end              as needs_follow_up,
  j.hours_since_last_activity,
  to_char(j.last_activity_at, 'YYYY-MM-DD HH24:MI')                 as last_activity_sgt,
  coalesce(j.ascend_result, '')                                     as ascend_result,
  coalesce(j.selected_plan, '')                                     as plan_chosen,
  -- A fixed list of choices on the offer screen, never free text.
  coalesce(j.decline_reason, '')                                    as decline_reason,
  coalesce(to_char(j.booking_date, 'YYYY-MM-DD') || ' ' || left(j.booking_time::text, 5), '') as booking_sgt,
  j.documents                                                       as documents_uploaded,
  -- The sentence the applicant was shown when a document was refused (no name: 0007).
  coalesce(j.last_income_issue, '')                                 as last_document_issue,
  -- A code only. no_order_detail is left out: it is raw API text.
  coalesce(j.no_order_reason, '')                                   as no_order_reason,
  coalesce(to_char(a.airconnect_lead_pushed_at at time zone 'Asia/Singapore', 'YYYY-MM-DD HH24:MI'), '') as sent_to_airconnect_sgt,
  j.created_at,
  j.booking_date
from reporting.applicant_journey j
join applicants a on a.id = j.id;

comment on view reporting.sheet_worklist is
  'Applicants for the Google Sheet worklist. No personal data: reference, stage and reasons only.';

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'sheet_worklist_reader') then
    create role sheet_worklist_reader login connection limit 3;
  end if;
end
$$;

alter role sheet_worklist_reader set statement_timeout = '30s';
grant usage on schema reporting to sheet_worklist_reader;
grant select on reporting.sheet_worklist to sheet_worklist_reader;
