# R2 image uploads

Set all five variables in `.env.local` and in the deployment environment:

```dotenv
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_s3_access_key_id
R2_SECRET_ACCESS_KEY=your_s3_secret_access_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=https://pub-your_bucket_id.r2.dev
```

`R2_BUCKET_NAME` is required for uploads and deletions, even when the bucket has a public URL. `R2_PUBLIC_URL` is the bucket's public development URL or custom domain. A bucket name cannot be used to infer its public URL.

1. Create or select the bucket in Cloudflare R2.
2. Create R2 S3 credentials with Object Read & Write permission for that bucket. Use the Access Key ID and Secret Access Key, not the Cloudflare API token value.
3. Enable a public development URL or connect a custom domain in the bucket settings. Copy that URL to `R2_PUBLIC_URL`.
4. Set the variables above and restart the development server or redeploy.
5. Select a performer image in the admin concert form and save the concert. Files upload when the form is saved.

Public access is configured on the bucket. The upload request must not send an object ACL because [R2 does not support S3 ACLs](https://developers.cloudflare.com/r2/api/s3/api/).

If storage rejects access with 401 or 403, check the account ID, S3 credentials, bucket name, and token permissions. Replace expired or revoked credentials in the environment where the app runs.

If an upload succeeds but the image does not appear, check that `R2_PUBLIC_URL` serves the same bucket and public access is enabled. Rebuild after changing this URL so Next.js allows the image host.

Keep credentials out of version control. Images are stored under `performers/`.
