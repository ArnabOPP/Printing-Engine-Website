import { useEffect, useState } from 'react';
import { api, fileUrl } from '../api.js';
import { Loading, PageHead, useLoad, fmtDate } from './ui.jsx';

function Photo({id,index}) {
  const [url,setUrl]=useState('');
  useEffect(()=>{let live=true;let objectUrl='';fileUrl(`/api/admin/reviews/${id}/photos/photo-${index+1}.webp`).then((src)=>{objectUrl=src;if(live)setUrl(src);else URL.revokeObjectURL(src);}).catch(()=>{});return()=>{live=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};},[id,index]);
  return url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Customer review photo ${index+1}`} width="100" height="100" style={{objectFit:'cover',borderRadius:6}} /></a> : <span className="ad-muted">Photo unavailable</span>;
}
function Review({review:r,reload}) {
  const [reason,setReason]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const moderate=async()=>{
    const status=r.status==='removed'?'published':'removed';
    if(!window.confirm(status==='removed'?'Remove this review and its photos from the website? You can restore it later.':'Restore this review and its photos to the website?'))return;
    setBusy(true);setError('');
    try {await api(`/api/admin/reviews/${r.id}`,{method:'PATCH',body:{status,reason}});reload();}
    catch(err){setError(err.message);}finally{setBusy(false);}
  };
  return <article className="ad-card">
    <h2>{r.productName}</h2><p><b>{r.name}</b> · {r.rating}/5 · {fmtDate(r.createdAt)} · {r.status==='published'?'Visible':'Removed'}</p>
    <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{r.comment}</p>
    <div className="ad-rowtools">{r.photos.map((_,i)=><Photo key={i} id={r.id} index={i}/>)}</div>
    {r.moderation && <p className="ad-muted">Last moderated by {r.moderation.by}{r.moderation.reason ? `: ${r.moderation.reason}`:''}</p>}
    <label className="ad-field">Internal moderation reason (optional)<input maxLength={300} value={reason} disabled={busy} onChange={(e)=>setReason(e.target.value)}/></label>
    <button className={`ad-btn ${r.status==='published'?'danger':''}`} disabled={busy} onClick={moderate}>{busy?'Saving…':r.status==='published'?'Remove review':'Restore review'}</button>
    {error && <p className="ad-error" role="alert">{error}</p>}
  </article>;
}
export default function Reviews(){
  const [q,setQ]=useState('');const [status,setStatus]=useState('published');const [page,setPage]=useState(1);
  const {data,error,loading,reload}=useLoad(`/api/admin/reviews?q=${encodeURIComponent(q)}&status=${status}&page=${page}`);
  return <><PageHead title="Product reviews"><button className="ad-btn" onClick={reload}>Refresh reviews</button></PageHead>
    <p className="ad-muted">Moderate customer reviews for shop and custom products. Removing a review also hides its photos and excludes its rating from the public average. Removed reviews can be restored.</p>
    <div className="ad-filters"><input aria-label="Search reviews" placeholder="Product, reviewer or comment" value={q} onChange={(e)=>{setQ(e.target.value);setPage(1);}}/><select aria-label="Review visibility" value={status} onChange={(e)=>{setStatus(e.target.value);setPage(1);}}><option value="published">Visible reviews</option><option value="removed">Removed reviews</option><option value="">All reviews</option></select></div>
    {loading || error ? <Loading loading={loading} error={error}/> : <><p className="ad-muted">{data.total} reviews</p>{data.reviews.map((r)=><Review key={`${r.id}-${r.status}`} review={r} reload={reload}/>)}{!data.total && <p>No reviews match these filters.</p>}<div className="ad-rowtools"><button className="ad-btn" disabled={page===1} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page}</span><button className="ad-btn" disabled={!data.hasMore} onClick={()=>setPage(page+1)}>Next</button></div></>}
  </>;
}
