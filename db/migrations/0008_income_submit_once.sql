-- Submitting income must happen once per reading, and each document must go to
-- Ascend once. Ascend's income/credit can take longer than the browser is
-- willing to wait; the applicant tapped Submit again, and the second request
-- re-uploaded every file and called income/credit a second time while the
-- first was still waiting.

alter table income_readings
  -- Taken before anything is sent to Ascend; a stale lock (a request that
  -- died) is taken over after two minutes.
  add column submitting_at timestamptz,
  add column submitted_at  timestamptz,
  -- The documents that actually fed the months. Files outside the months we
  -- need are kept with the reading but are not sent to Ascend. Null on a
  -- reading taken before this column existed, meaning all of them.
  add column used_document_ids uuid[];

alter table income_documents
  -- The URL Ascend (or our own link) gave this file, so a retry reuses it
  -- instead of uploading the file again.
  add column ascend_file_url text;
