// A transparent white-tee photo, tinted to the chosen colour: the colour fills the tee's silhouette
// (via the photo's own alpha as a mask) and the photo is multiplied on top to keep the folds and shading.
export default function TeePhoto({ src, colour, alt }) {
  return (
    <div className="tee-photo" style={{ '--tint': colour, '--mask': `url("${src}")` }}>
      <i className="tee-tint" />
      <img src={src} alt={alt} />
    </div>
  );
}
