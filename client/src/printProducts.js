import { applyCatalog as apply, allGroups, printGroups, printProducts } from '../../shared/customCatalog.js';
import { assetUrl } from './api.js';
export * from '../../shared/customCatalog.js';
export function applyCatalog(c = {}) {
  apply(c);
  for (const p of [...allGroups.flatMap((g) => g.items), ...printProducts]) {
    if (p.img) p.img = assetUrl(p.img);
    for (const photos of [p.mockups?.photos, ...Object.values(p.mockups?.colourPhotos || {})]) {
      if (photos) Object.keys(photos).forEach((side) => { photos[side] = assetUrl(photos[side]); });
    }
  }
}
applyCatalog();
