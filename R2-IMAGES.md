# R2 image storage

The shop uses R2 for built-in product photos, home-page photos, logos, size charts, blank mockup templates, admin image uploads, reviews, original customer artwork, generated product mockups and transparent print-only exports. Original customer uploads are preserved unchanged. Image file bytes live in R2; order/product references remain in the application database.

## Public bucket setup

1. Create a Standard R2 bucket named `printing-engine-public`. Keep the existing `R2_BUCKET` private.
2. Attach `images.printingengine.in` in the new bucket's Settings → Custom Domains. Cloudflare requires the domain's zone in the same account. If DNS is not managed by Cloudflare, continue using the API image route until DNS setup is arranged; preserve all existing website, API, mail and verification records during any DNS move.
3. Give the R2 access token Object Read & Write access to both buckets. Update its access and secret keys in Railway if replaced.
4. Add Railway variables `R2_PUBLIC_BUCKET=printing-engine-public` and `R2_PUBLIC_BASE_URL=https://images.printingengine.in`. Keep `R2_BUCKET` unchanged. Leave `R2_PUBLIC_DELIVERY` unset until the domain and CORS are ready; unset means public images use the existing private bucket and API route regardless of these optional variables.
5. In the PUBLIC bucket Settings → CORS policy, save:

```json
[
  {
    "AllowedOrigins": ["https://printingengine.in", "https://www.printingengine.in"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

6. After DNS, domain and CORS are working, set `R2_PUBLIC_DELIVERY=true`. Open `/admin/image-storage`, run Sync images to R2 and refresh status. Verify a product photo and the design studio. Public images use redirects to the custom domain after migration; the API remains the fallback when direct delivery is disabled. Never attach a public domain to the private customer bucket.

## Layout and migration

Public images use `public/assets/`, `public/uploads/`, and `public/catalog/`. Customer files use private `artwork/<order ID>/`. Review files use private `artwork/review-<review ID>/` so deletion can revoke access immediately without CDN copies.

The backend image sync runs after startup and hourly. It copies the bundled public images and existing disk uploads, migrates earlier catalogue objects and public objects from the private bucket when a separate public bucket is enabled, and copies older local private order/review files. It verifies public writes and skips unchanged source files using hashes. Original local files are retained as a migration safety copy; normal order cleanup still deletes both local and R2 order files. Standalone command: `npm run r2:sync --workspace server` with no other process using the same DATA_DIR.

Orders accepted after this release can include transparent print-only PNGs for each design side, alongside mockups and original source uploads. Raster exports target up to 300 DPI but are capped at 4,096 pixels per side and roughly 12 megapixels. Admins see actual pixel dimensions and estimated DPI and must check physical dimensions before production. Older saved carts/orders can still be accepted without print-only exports; re-open the studio and add a fresh design to generate them. Source text/layer geometry stays with the order. Device drafts remain in the browser until checkout; only accepted-order files are retained in private cloud storage.

Product/template photos remain while used. Review deletion removes review photos with durable retry. Courier-confirmed dispatch deletes customer originals, mockups and print-only files together. Unattached failed-checkout files older than 7 days are removed daily. Sync failures leave source files intact and retry on the next run; inspect Image storage status and Railway logs for failures. Back up DATA_DIR because R2 alone does not contain the shop's order metadata.

No Cloudflare image transformation service is enabled. R2 Standard storage/request pricing and any Railway proxy usage still apply. Public CDN delivery needs the separate bucket/domain/CORS steps above. A zero bill is not guaranteed.
