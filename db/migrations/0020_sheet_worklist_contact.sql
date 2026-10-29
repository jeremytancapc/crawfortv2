-- The Google Sheet worklist, second version: the mobile number and the two
-- credit limits, so staff can call from the sheet instead of looking every row
-- up in AirConnect first.
--
-- 0019 deliberately kept personal data out, because the sheet lives in Google,
-- outside our systems. That is no longer true of this view: it now carries the
-- mobile number and what Ascend was willing to lend. The protection has to come
-- from the sheet instead, and docs/sheet-worklist.md states the rules the sheet
-- must follow before this is applied (named users only, no link sharing, no
-- copies, no download). Applying this migration without them copies customer
-- contact details into an openly shared spreadsheet.
--
-- The reader role is unchanged: `sheet_worklist_reader` still reads this one
-- view and nothing else, so a leaked Apps Script password reaches these columns
-- and no others - not the name, the NRIC, the email or MyInfo.
--
-- Three columns are added at the end, which is the only place a view can gain
-- them, so the 0019 column numbers stay as they were:
--   mobile            the number as the applicant gave it, usually 8 local digits
--   acard_limit       the A-Card Limit: what Ascend is willing to lend, blank until
--                     Ascend has answered with a pass and a figure. This is the
--                     amount this app (`cf_h5_v2`) sends on to AirConnect.
--   max_loan_quantum  the Maximum Loan Quantum from MLCB: the regulatory ceiling
--                     across all licensed moneylenders, which is what the offer
--                     screen shows as the "pre-approved amount". Not an offer.
--
-- The first H5's pre-approved amount (`cf_h5_v1`) is not here and cannot be: it
-- was never sent to this database. It lives in AirConnect's
-- `t3gallery_credit_limits`, and docs/sheet-worklist.md has the read-only view
-- to create there and how the sync fills that column.
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
  j.max_eligible                                                    as max_loan_quantum
from reporting.applicant_journey j
join applicants a on a.id = j.id;

comment on view reporting.sheet_worklist is
  'Applicants for the Google Sheet worklist. Carries the mobile number and the A-Card Limit since 0020: the sheet holding it must be restricted to named staff.';
