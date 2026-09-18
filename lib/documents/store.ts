/**
 * Where an applicant's uploaded payslips are kept.
 *
 * Until now they were kept nowhere: the file went straight to Ascend and, when
 * that call failed, was gone - the applicant had to find and upload it again,
 * and support had nothing to look at. A copy here is worth having whatever
 * Ascend's upload does.
 *
 * The bucket blocks all public access and the credentials reach nothing else
 * in the account. Files are read back only by the server, for the endpoint
 * that streams them.
 */

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type StoredDocument = {
  objectKey: string;
  bytes: number;
};

let client: S3Client | null = null;

function config() {
  const bucket = process.env.DOCUMENTS_S3_BUCKET?.trim();
  const region = process.env.DOCUMENTS_S3_REGION?.trim();
  const secret = process.env.DOCUMENTS_URL_SECRET?.trim();
  // All three or none: a half-configured deploy that stored files it could
  // not serve would lose them just as surely as not storing them.
  return bucket && region && secret ? { bucket, region, secret } : null;
}

export function documentsConfigured(): boolean {
  return config() !== null;
}

/** The signing secret, or null when document storage is switched off. */
export function documentsSecret(): string | null {
  return config()?.secret ?? null;
}

function s3(region: string): S3Client {
  // One client per process: each one holds its own connection pool, and a new
  // one per request is a slow way to exhaust sockets.
  client ??= new S3Client({ region });
  return client;
}

export async function putDocument(input: {
  objectKey: string;
  contentType: string;
  bytes: Buffer;
}): Promise<StoredDocument> {
  const cfg = config();
  if (!cfg) throw new Error("Document storage is not configured");

  await s3(cfg.region).send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: input.objectKey,
      Body: input.bytes,
      ContentType: input.contentType,
      ServerSideEncryption: "AES256",
    }),
  );

  return { objectKey: input.objectKey, bytes: input.bytes.byteLength };
}

export type FetchedDocument = {
  body: ReadableStream;
  contentType: string;
  bytes: number | undefined;
};

/** Streams an object back. Returns null when it is not there. */
export async function getDocument(objectKey: string): Promise<FetchedDocument | null> {
  const cfg = config();
  if (!cfg) return null;

  try {
    const result = await s3(cfg.region).send(
      new GetObjectCommand({ Bucket: cfg.bucket, Key: objectKey }),
    );
    if (!result.Body) return null;

    return {
      body: result.Body.transformToWebStream(),
      contentType: result.ContentType ?? "application/octet-stream",
      bytes: result.ContentLength,
    };
  } catch (err) {
    // A missing object is an ordinary answer - a stale link, a deleted file -
    // not something to throw over.
    if ((err as { name?: string })?.name === "NoSuchKey") return null;
    throw err;
  }
}
