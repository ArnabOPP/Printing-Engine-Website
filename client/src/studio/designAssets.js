// Immutable cart snapshots belong in IndexedDB, not the small localStorage autosave.
function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('printing-engine-designs', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('designs');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction(mode, run) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('designs', mode);
      const request = run(tx.objectStore('designs'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Design storage was interrupted.'));
    });
  } finally { db.close(); }
}

export const saveDesignAsset = (id, value) => transaction('readwrite', (store) => store.put(value, id));
export const loadDesignAsset = (id) => transaction('readonly', (store) => store.get(id));
export const removeDesignAsset = (id) => transaction('readwrite', (store) => store.delete(id));
