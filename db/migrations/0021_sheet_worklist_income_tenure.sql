-- The Google Sheet worklist, third version: what the applicant asked for, the
-- income Ascend was given, and the tenure.
--
-- Four columns are added at the end (the only place a view can gain them):
--   requested    the Desired Amount - replaced by the drawn amount once a plan is chosen
--   income       the monthly income Ascend was last given (reporting.applicant_journey's
--                income_used: the submitted documents, otherwise MyInfo)
--   income_type  Ascend's label for that income: NOA, CPF, NON_PANEL_PAYSLIP, ...
--   loan_tenure  as text, e.g. "6 months" - replaced by the plan's tenure once chosen
--
-- Income is personal data, like the mobile number 0020 added: the sharing rules in
-- docs/sheet-worklist.md apply to it too. The reader role is unchanged and still
-- reads this one view only.
--
-- A view only, no data of its own, so this is safe to re-run.

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
  j.booking_date,
  -- Added in 0020, at the end.
  coalesce(j.mobile, '')                                            as mobile,
  -- A limit counts only while Ascend's current answer is a pass. One stored from
  -- an earlier answer, on an order since rejected, is not a limit they have -
  -- the same rule `journey_group` uses, so the sheet and the piles agree.
  case when j.ascend_result = 'passed' then j.approved end          as acard_limit,
  j.max_eligible                                                    as max_loan_quantum,
  -- Added in 0021, at the end.
  -- The Desired Amount, but the app overwrites it with the amount the applicant
  -- draws once they choose a plan (select-plan: setDesiredAmount), so from then
  -- on it is their choice, not what they first asked for.
  j.requested                                                       as requested,
  -- What Ascend was last given as monthly income, and Ascend's own label for it:
  -- the submitted documents when there are any, otherwise the MyInfo figure.
  j.income_used                                                     as income,
  coalesce(j.income_used_source, '')                                as income_type,
  -- In months. Like `requested`, replaced by the plan's tenure once one is chosen.
  a.loan_tenure || case when a.loan_tenure = 1 then ' month' else ' months' end as loan_tenure
from reporting.applicant_journey j
join applicants a on a.id = j.id;

comment on view reporting.sheet_worklist is
  'Applicants for the Google Sheet worklist. Carries the mobile number, amounts and income since 0020/0021: the sheet holding it must be restricted to named staff.';
