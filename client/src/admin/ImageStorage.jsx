import { useState } from 'react';
import { api } from '../api.js';
import { Loading, PageHead, useLoad, fmtTime } from './ui.jsx';

export default function ImageStorage(){
  const {data,error,loading,reload}=useLoad('/api/admin/media-status');
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  const sync=async()=>{setBusy(true);setMessage('');try{await api('/api/admin/media-sync',{method:'POST'});setMessage('Image sync started. Refresh status in a moment.');reload();}catch(err){setMessage(err.message);}finally{setBusy(false);}};
  return <><PageHead title="Image storage"><button className="ad-btn" onClick={reload}>Refresh status</button></PageHead>
    {!data?<Loading loading={loading} error={error}/>:<section className="ad-card">
      <h2>Cloudflare R2</h2><p>Private artwork storage: <b>{data.enabled?'Connected':'Not configured'}</b></p>
      <p>Public shop-image delivery: <b>{data.directPublicDelivery?'Custom image domain configured':'Protected API route'}</b></p>
      <p className="ad-muted">Product photos, home-page images and blank mockups are stored separately from customer artwork. Review photos stay private behind the review service so deleted reviews cannot expose their photos.</p>
      {data.lastSync&&<p>Last sync: {fmtTime(data.lastSync.at)} · {data.lastSync.uploaded} files copied · {data.lastSync.errorCount} errors{data.lastSync.errors?.length?` (${data.lastSync.errors.join(', ')})`:''}</p>}
      <p className="ad-muted">New custom orders save originals, product mockups and transparent print-only exports. These private order files are deleted after courier-confirmed dispatch. Older orders may not contain print-only exports.</p>
      <button className="ad-btn primary" disabled={busy||!data.enabled||data.syncing} onClick={sync}>{data.syncing?'Syncing images…':'Sync images to R2'}</button>
      {message&&<p role="status">{message}</p>}
    </section>}
  </>;
}
