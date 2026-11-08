import { acquireStoreLock } from '../src/processLock.js';
import { syncAllImages, mediaStatus } from '../src/mediaStorage.js';
const release=acquireStoreLock();
try{
  if(!mediaStatus().enabled)throw new Error('R2 settings are incomplete.');
  await syncAllImages();
  const status=mediaStatus();
  console.log(JSON.stringify(status));
  if(status.lastSync?.errorCount)process.exitCode=1;
}catch(err){console.error(`Image sync failed (${err.name}): ${err.message}`);process.exitCode=1;}
finally{release();}
