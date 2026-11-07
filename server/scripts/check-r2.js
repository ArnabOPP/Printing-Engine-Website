import crypto from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const env = process.env;
if (!env.R2_BUCKET || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !(env.R2_ACCOUNT_ID || env.R2_ENDPOINT)) {
  console.error('R2 settings are incomplete. Set R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_ACCOUNT_ID or R2_ENDPOINT in server/.env.');
  process.exitCode = 1;
} else {
  const client = new S3Client({
    region: 'auto', endpoint: env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
    forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
  });
  const Key = `storage-check/${crypto.randomUUID()}.txt`;
  const payload = 'Printing Engine R2 connection test';
  let uploaded = false;
  try {
    await client.send(new PutObjectCommand({ Bucket: env.R2_BUCKET, Key, Body: payload, ContentType: 'text/plain' }));
    uploaded = true;
    const result = await client.send(new GetObjectCommand({ Bucket: env.R2_BUCKET, Key }));
    if (await result.Body.transformToString() !== payload) throw new Error('Read-back did not match.');
    console.log('R2 upload and private download passed.');
  } catch (err) {
    console.error(`R2 connection test failed (${err.name || 'unknown error'}). Check the endpoint, bucket and token permissions.`);
    process.exitCode = 1;
  } finally {
    if (uploaded) {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key }));
        console.log('R2 deletion passed; test object removed.');
      } catch {
        console.error(`Could not remove test object: ${Key}. Check delete permission and bucket locks.`);
        process.exitCode = 1;
      }
    }
    client.destroy();
  }
}
