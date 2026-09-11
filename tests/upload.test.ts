import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { PutObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { NextRequest } from 'next/server';
import { POST, DELETE } from '../src/app/api/upload/route';

const config = {
  R2_ACCOUNT_ID: 'test-account',
  R2_ACCESS_KEY_ID: 'test-key',
  R2_SECRET_ACCESS_KEY: 'test-secret',
  R2_BUCKET_NAME: 'performer-images',
  R2_PUBLIC_URL: 'https://images.example.com/',
};
let previous: Record<string, string | undefined>;
beforeEach(() => {
  previous = Object.fromEntries(Object.keys(config).map(key => [key, process.env[key]]));
  Object.assign(process.env, config);
  mock.method(console, 'error', () => {});
});
afterEach(() => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  mock.restoreAll();
});
function upload(file: File | string = new File(['image'], 'portrait.png', { type: 'image/png' })) {
  const body = new FormData();
  body.set('file', file);
  return POST(new NextRequest('http://localhost/api/upload', { method: 'POST', body }));
}

test('uploads to the configured bucket without an ACL and returns its public URL', async () => {
  const send = mock.method(S3Client.prototype, 'send', async (command: PutObjectCommand) => {
    assert.ok(command instanceof PutObjectCommand);
    assert.equal(command.input.Bucket, config.R2_BUCKET_NAME);
    assert.equal(command.input.ACL, undefined);
    assert.equal(command.input.ContentType, 'image/png');
    assert.equal(Buffer.from(command.input.Body as Uint8Array).toString(), 'image');
    return {};
  });
  const response = await upload();
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.match(data.fileName, /^performers\/.+\.png$/);
  assert.equal(data.url, `https://images.example.com/${data.fileName}`);
  assert.equal(send.mock.callCount(), 1);
});

test('requires both a bucket name and a public URL before uploading', async () => {
  const send = mock.method(S3Client.prototype, 'send', async () => ({}));
  for (const key of ['R2_BUCKET_NAME', 'R2_PUBLIC_URL'] as const) {
    delete process.env[key];
    const response = await upload();
    assert.equal(response.status, 500);
    assert.match((await response.json()).error, new RegExp(key));
    process.env[key] = config[key];
  }
  assert.equal(send.mock.callCount(), 0);
});

test('rejects text fields, non-images, and oversized files before writing to R2', async () => {
  const send = mock.method(S3Client.prototype, 'send', async () => ({}));
  for (const file of ['text', new File(['text'], 'note.txt', { type: 'text/plain' }), new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })]) {
    assert.equal((await upload(file)).status, 400);
  }
  assert.equal(send.mock.callCount(), 0);
});

test('explains storage authentication failures', async () => {
  for (const status of [401, 403]) {
    mock.method(S3Client.prototype, 'send', async () => {
      throw Object.assign(new Error('Unauthorized'), { $metadata: { httpStatusCode: status } });
    });
    const response = await upload();
    assert.equal(response.status, 500);
    assert.match((await response.json()).error, /R2 S3 credentials/);
  }
});

test('deletes images from the configured bucket', async () => {
  mock.method(S3Client.prototype, 'send', async (command: DeleteObjectCommand) => {
    assert.ok(command instanceof DeleteObjectCommand);
    assert.equal(command.input.Bucket, config.R2_BUCKET_NAME);
    assert.equal(command.input.Key, 'performers/portrait.png');
    return {};
  });
  const response = await DELETE(new NextRequest('http://localhost/api/upload?fileName=performers%2Fportrait.png', { method: 'DELETE' }));
  assert.equal(response.status, 200);
});
