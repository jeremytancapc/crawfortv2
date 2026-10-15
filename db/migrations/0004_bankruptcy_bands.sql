-- Ascend's six bankruptcy declarations, not our three.
--
-- The form asked one question - discharged less than five years ago - and
-- Ascend splits that span into three bands. Without knowing which, an
-- applicant had to be presented as though discharged in the most recent one,
-- so someone discharged four years ago looked like someone discharged last
-- year, and may have been refused for it.
--
-- Our own slugs rather than Ascend's wording: a vendor rephrasing an option
-- should not need a migration, and the mapping to their strings lives in
-- lib/ascend/borrower-info.ts.
--
-- `clear` and `active` already meant NOT BANKRUPTCY and Bankrupted, so they
-- stay and the eighteen rows holding `clear` need no backfill.
-- `discharged_lt5` is kept only so the enum can still read rows written
-- before this; nothing writes it now.

alter type bankruptcy_declaration add value if not exists 'discharged_gt5';
alter type bankruptcy_declaration add value if not exists 'discharged_4_5';
alter type bankruptcy_declaration add value if not exists 'discharged_1_3';
alter type bankruptcy_declaration add value if not exists 'discharged_lt1';
