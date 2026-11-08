import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiUrl } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import './reviews.css';

export default function ProductReviews({ productKey, onSummary }) {
  const { user, loading:authLoading } = useAuth();
  const [data,setData] = useState(null);
  const [page,setPage] = useState(1);
  const [refresh,setRefresh] = useState(0);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [submitted,setSubmitted] = useState(null);
  const [name,setName] = useState(user?.displayName || '');
  const [rating,setRating] = useState('');
  const [comment,setComment] = useState('');
  const [photos,setPhotos] = useState([]);
  const [consent,setConsent] = useState(false);
  const [message,setMessage] = useState('');
  useEffect(() => {
    let live=true; setData(null); setError('');
    api(`/api/reviews?product=${encodeURIComponent(productKey)}&page=${page}`).then((result) => {
      if(live) { setData(result); onSummary?.({count:result.count,average:result.average}); }
    }).catch((e) => {if(live) setError(e.message);});
    return () => {live=false;};
  },[productKey,page,refresh,onSummary]);
  useEffect(() => {
    let live=true; setSubmitted(null); setName(user?.displayName || '');
    if(user) user.getIdToken().then((token) => api(`/api/reviews/mine?product=${encodeURIComponent(productKey)}`,{headers:{Authorization:`Bearer ${token}`}}))
      .then((r) => {if(live) setSubmitted(r.submitted);}).catch(() => {if(live) setSubmitted(false);});
    return () => {live=false;};
  },[user,productKey,refresh]);
  useEffect(() => {
    const refreshOnFocus=()=>{setRefresh((n)=>n+1);setMessage('');};
    window.addEventListener('focus',refreshOnFocus);
    return ()=>window.removeEventListener('focus',refreshOnFocus);
  },[]);
  const submit = async (e) => {
    e.preventDefault(); if(!user) return;
    setBusy(true);setError('');setMessage('');
    try {
      const images=[];
      for(const file of photos) images.push(await new Promise((resolve,reject) => {const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read the selected photo.'));reader.readAsDataURL(file);}));
      const token=await user.getIdToken();
      await api('/api/reviews',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:{product:productKey,name,rating:Number(rating),comment,photos:images,consent}});
      setSubmitted(true);setPhotos([]);setPage(1);setRefresh((n)=>n+1);setMessage('Your review has been published. Thank you for sharing your experience.');
    } catch(err) {setError(err.message);} finally {setBusy(false);}
  };
  return <section className="product-reviews" aria-label="Customer reviews">
    <h2>Customer reviews</h2>
    <button type="button" className="btn" disabled={busy} onClick={()=>{setRefresh((n)=>n+1);setMessage('');}}>Refresh reviews</button>
    {data && <p>{data.count ? `${data.average} out of 5 · ${data.count} ${data.count===1?'review':'reviews'}` : 'No reviews yet. Share your experience with this product.'}</p>}
    {!data && !error && <p role="status">Loading reviews…</p>}
    {data?.reviews.map((r) => <article className="customer-review" key={r.id}>
      <header><strong>{r.name}</strong><time dateTime={r.createdAt}>{new Date(r.createdAt).toLocaleDateString('en-IN')}</time></header>
      <p className="review-stars" aria-label={`${r.rating} out of 5 stars`}>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</p>
      <p className="review-comment">{r.comment}</p>
      {!!r.photos.length && <div className="review-photos">{r.photos.map((src,i) => <a href={apiUrl(src)} key={src} target="_blank" rel="noreferrer" aria-label={`Open review photo ${i+1}`}><img src={apiUrl(src)} alt={`Photo ${i+1} shared by ${r.name}`} loading="lazy" /></a>)}</div>}
    </article>)}
    {data && (page>1 || data.hasMore) && <div className="review-pages"><button type="button" disabled={page===1} onClick={()=>setPage(page-1)}>Previous reviews</button><span>Page {page}</span><button type="button" disabled={!data.hasMore} onClick={()=>setPage(page+1)}>Next reviews</button></div>}
    {message && <p role="status">{message}</p>}
    {!authLoading && !user && <p><Link to="/login">Sign in</Link> to write a review and add photos.</p>}
    {user && submitted === null && <p role="status">Checking your review…</p>}
    {user && submitted === true && !message && <p>You have already submitted a review for this product.</p>}
    {user && submitted === false && <form className="review-form" onSubmit={submit}>
      <h3>Write a review</h3>
      <fieldset disabled={busy}>
        <label>Public display name<input value={name} onChange={(e)=>setName(e.target.value)} maxLength={60} required autoComplete="nickname" /></label>
        <label>Your rating<select value={rating} required onChange={(e)=>setRating(e.target.value)}><option value="">Choose a rating</option>{[5,4,3,2,1].map((n)=><option value={n} key={n}>{n} {n===1?'star':'stars'}</option>)}</select></label>
        <label>Your experience<textarea value={comment} onChange={(e)=>setComment(e.target.value)} minLength={3} maxLength={2000} required rows={5} /></label>
        <label>Photos (optional)<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e)=>{
          const files=[...e.target.files];
          if(files.length>3 || files.some((f)=>f.size>3*1024*1024 || !['image/png','image/jpeg','image/webp'].includes(f.type))) {setError('Choose up to three JPG, PNG or WebP photos, each under 3 MB.');setPhotos([]);e.target.value='';return;}
          setError('');setPhotos(files);
        }} /><small>Up to 3 photos, 3 MB each. Photos are resized and location metadata is removed. Avoid sharing personal information.</small></label>
        {!!photos.length && <div className="review-selected">{photos.map((f,i)=><span key={`${f.name}-${i}`}>{f.name} <button type="button" onClick={()=>setPhotos(photos.filter((_,n)=>n!==i))} aria-label={`Remove selected photo ${i+1}`}>Remove</button></span>)}</div>}
        <label className="review-consent"><input type="checkbox" checked={consent} required onChange={(e)=>setConsent(e.target.checked)} />I agree to publish my display name, review and photos. My review reflects my own experience.</label>
        <button className="btn btn-lime-solid" disabled={!consent}>{busy?'Publishing…':'Publish review'}</button>
      </fieldset>
    </form>}
    {error && <div role="alert"><p>{error}</p>{!data && <button type="button" onClick={()=>setRefresh((n)=>n+1)}>Retry loading reviews</button>}</div>}
  </section>;
}
