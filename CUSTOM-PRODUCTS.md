# Managing custom products

Open `/custom-admin/products` and sign in using an approved Firebase admin account. Existing products remain available without re-entry; stock tracking starts only when explicitly enabled.

1. Open a product, duplicate one, or choose **New product**. Use a unique SKU and URL ID. Keep new products in Draft until the configuration is ready.
2. Under **Colours & stock**, enter available colours, materials and size ranges. Enable stock tracking, generate the combinations, then enter quantities for each colour/material/size. Missing combinations have zero stock. Regenerate combinations after changing options. Quantities represent available units, excluding orders already reserved.
3. Under **Price & discount**, choose garment print rates, sheet pricing, a fixed unit price, or quotation after review. Set a percentage or rupee discount, optional start/end times, and whether coupons may stack with it. Individual product settings take precedence over Global print rates.
4. Under **Mockup images**, upload blank PNG, JPG, WebP or GIF templates under 8 MB. Set default images or separate images for each colour and garment side. Adjust the printable rectangle and full-image width scale in inches. Use untinted photos for pre-coloured templates. Preview the customer studio before taking orders.
5. Publish immediately or schedule a launch. The category must also be enabled in Global print rates. Set the New badge expiry, production lead time and minimum/maximum order quantities as needed. Archive a product to remove it from sale while preserving past orders.

Checkout validates current options, price and stock on the server. Changing a product requires customers with older designs to reopen the studio. Stock reservations are serialized within the existing single-process database service. Cancelling an undispatched order restores reserved quantities once; cancel an active courier shipment first. Do not scale this JSON database service to multiple replicas.

Product photos and blank mockup templates use the permanent R2 `catalog/` prefix. They are public storefront assets and must contain no customer artwork or private information. Replacing an image does not delete its old file. Customer uploads and generated order mockups remain private order assets and follow the existing courier-confirmed dispatch deletion policy.

Print prices use shared browser/server geometry calculations. Text dimensions are estimates; inspect artwork and print dimensions before production. This panel does not supply stock quantities, original mockup photographs, or launch prices automatically; enter the shop's actual values.

Validation: `npm test --workspace server` and `npm run build --workspace client`. Automated tests use isolated local data and fake courier/storage integrations; they do not book real shipments.
