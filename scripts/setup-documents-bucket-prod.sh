#!/usr/bin/env bash
#
# Creates the PRODUCTION bucket for applicants' income documents, and a user that
# can do nothing except read, write and delete objects in it.
#
#   AWS_PROFILE=<production-admin> bash scripts/setup-documents-bucket-prod.sh
#       Dry run: shows which AWS account you are signed in to and what would be
#       created. Changes nothing.
#
#   AWS_PROFILE=<production-admin> bash scripts/setup-documents-bucket-prod.sh \
#       --apply --account 123456789012
#       Creates everything. The account number must match the account you are
#       signed in to, so it cannot run against the wrong one by accident.
#
# The new access key is written straight into .env.vercel-production and never
# printed. Needs the AWS CLI and an administrator on the production account.

set -euo pipefail

BUCKET="${DOCUMENTS_S3_BUCKET:-crawfort-applicant-documents-prod}"
REGION="ap-southeast-1"
POLICY_NAME="crawfort-applicant-documents-rw-prod"
USER_NAME="crawfort-documents-prod"
ENV_FILE=".env.vercel-production"

APPLY=0
EXPECTED_ACCOUNT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) APPLY=1 ;;
    --account) EXPECTED_ACCOUNT="${2:-}"; shift ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

command -v aws >/dev/null || { echo "The AWS CLI is not installed." >&2; exit 1; }

IDENTITY=$(aws sts get-caller-identity --output json)
ACCOUNT=$(printf '%s' "$IDENTITY" | python3 -c 'import json,sys; print(json.load(sys.stdin)["Account"])')
ARN=$(printf '%s' "$IDENTITY" | python3 -c 'import json,sys; print(json.load(sys.stdin)["Arn"])')

echo "Signed in to AWS account $ACCOUNT as $ARN"
echo "Region: $REGION"
echo
echo "Would create:"
echo "  1. bucket        $BUCKET (all public access blocked, versioning on, encrypted)"
echo "  2. lifecycle     IA after 90 days, Glacier after 365, NO expiry of current files;"
echo "                   deleted files are really removed 14 days after the delete"
echo "  3. policy        $POLICY_NAME (read, write, delete objects in this bucket only)"
echo "  4. user + key    $USER_NAME, key saved to $ENV_FILE"
echo "  5. a check       writes, reads and deletes a test file with the new key"
echo

if [[ $APPLY -ne 1 ]]; then
  echo "Dry run. Nothing was changed."
  echo "To create it: add  --apply --account $ACCOUNT  (only if $ACCOUNT is the PRODUCTION account)."
  exit 0
fi

if [[ "$EXPECTED_ACCOUNT" != "$ACCOUNT" ]]; then
  echo "Refusing: --account '$EXPECTED_ACCOUNT' does not match the signed-in account '$ACCOUNT'." >&2
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Refusing: $ENV_FILE not found, so the new key would have nowhere to go." >&2
  exit 1
fi

echo "1/5 Bucket"
aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
  --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket "$BUCKET" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

echo "2/5 Lifecycle"
# The first rule keeps current files for good (they are credit records). The
# second makes a deleted file really go: with versioning on, a delete only hides
# the file, so without it the bytes of a document the applicant removed, or that
# was never submitted, would stay in the bucket for ever.
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --lifecycle-configuration '{
  "Rules": [
    {
      "ID": "archive-old-documents",
      "Status": "Enabled",
      "Filter": {},
      "Transitions": [
        {"Days": 90, "StorageClass": "STANDARD_IA"},
        {"Days": 365, "StorageClass": "GLACIER"}
      ]
    },
    {
      "ID": "remove-deleted-documents",
      "Status": "Enabled",
      "Filter": {},
      "NoncurrentVersionExpiration": {"NoncurrentDays": 14},
      "Expiration": {"ExpiredObjectDeleteMarker": true},
      "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 7}
    }
  ]
}'

echo "3/5 Policy"
POLICY_DOC=$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadWriteApplicantDocuments",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::$BUCKET/*"
    },
    {
      "Sid": "ListOwnBucketOnly",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::$BUCKET"
    }
  ]
}
JSON
)
POLICY_ARN=$(aws iam create-policy --policy-name "$POLICY_NAME" --policy-document "$POLICY_DOC" \
  --query 'Policy.Arn' --output text)

echo "4/5 User and key"
aws iam create-user --user-name "$USER_NAME" >/dev/null
aws iam attach-user-policy --user-name "$USER_NAME" --policy-arn "$POLICY_ARN"
KEY_JSON=$(aws iam create-access-key --user-name "$USER_NAME" --output json)

# Written into the env file, never shown.
KEY_JSON="$KEY_JSON" BUCKET="$BUCKET" ENV_FILE="$ENV_FILE" python3 - <<'PY'
import json, os, re
key = json.loads(os.environ["KEY_JSON"])["AccessKey"]
path = os.environ["ENV_FILE"]
values = {
    "DOCUMENTS_S3_BUCKET": os.environ["BUCKET"],
    "AWS_ACCESS_KEY_ID": key["AccessKeyId"],
    "AWS_SECRET_ACCESS_KEY": key["SecretAccessKey"],
}
text = open(path).read()
for name, value in values.items():
    text, n = re.subn(rf"^{name}=.*$", f"{name}={value}", text, flags=re.M)
    if n != 1:
        raise SystemExit(f"{name} not found exactly once in {path}")
open(path, "w").write(text)
PY

echo "5/5 Check (a new key can take a few seconds to work)"
ACCESS=$(grep '^AWS_ACCESS_KEY_ID=' "$ENV_FILE" | cut -d= -f2-)
SECRET=$(grep '^AWS_SECRET_ACCESS_KEY=' "$ENV_FILE" | cut -d= -f2-)
TESTKEY="setup-check/$(date +%s).txt"
ok=0
for attempt in 1 2 3 4 5 6; do
  if printf 'setup check' | env -u AWS_PROFILE AWS_ACCESS_KEY_ID="$ACCESS" AWS_SECRET_ACCESS_KEY="$SECRET" \
       aws s3 cp - "s3://$BUCKET/$TESTKEY" --region "$REGION" >/dev/null 2>&1; then ok=1; break; fi
  sleep 5
done
if [[ $ok -ne 1 ]]; then
  echo "The new key could not write to the bucket. Check the policy is attached to $USER_NAME." >&2
  exit 1
fi
env -u AWS_PROFILE AWS_ACCESS_KEY_ID="$ACCESS" AWS_SECRET_ACCESS_KEY="$SECRET" \
  aws s3 cp "s3://$BUCKET/$TESTKEY" - --region "$REGION" >/dev/null
env -u AWS_PROFILE AWS_ACCESS_KEY_ID="$ACCESS" AWS_SECRET_ACCESS_KEY="$SECRET" \
  aws s3 rm "s3://$BUCKET/$TESTKEY" --region "$REGION" >/dev/null

echo
echo "Done. The bucket is private, and the key in $ENV_FILE can write, read and delete in it."
echo "DOCUMENTS_S3_BUCKET, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are filled in."
