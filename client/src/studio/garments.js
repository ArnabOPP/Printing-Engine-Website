// The garment photos and where printing goes on them, for each garment shape.
// Areas are % of the photo box: { left, top, width, height }. The sleeve areas sit on the outer face of the sleeve.
export const GARMENTS = {
  tee: {
    photos: { front: '/tee-front.png', back: '/tee-back.png', left: '/tee-left.png', right: '/tee-right.png' },
    areas: {
      front: { left: 28, top: 18, width: 44, height: 66 },
      back: { left: 26, top: 12, width: 48, height: 74 },
      left: { left: 47, top: 27, width: 12.5, height: 22 },
      right: { left: 46, top: 27, width: 12.5, height: 22 },
    },
  },
  polo: {
    photos: { front: '/polo-front.png', back: '/polo-back.png', left: '/polo-left.png', right: '/polo-right.png' },
    areas: {
      // below the buttons on the front, between the collar and the cuff on the sleeves
      front: { left: 28, top: 32, width: 44, height: 56 },
      back: { left: 28, top: 14, width: 44, height: 72 },
      left: { left: 43.5, top: 27, width: 12, height: 17 },
      right: { left: 44, top: 27.5, width: 12, height: 17 },
    },
  },
};

// A product picks its shape with `garment` in printProducts.js; anything else uses the tee.
export const garmentFor = (product) => GARMENTS[product?.garment] || GARMENTS.tee;
