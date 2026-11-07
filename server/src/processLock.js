import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.js';

const processStart = (pid) => {
  if (process.platform !== 'linux') return null;
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    return stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19];
  } catch { return null; }
};

// The JSON store supports one writer. Do not run replicas against the same data directory.
export function acquireStoreLock() {
  const file = path.join(DATA_DIR, '.writer.lock');
  const identity = JSON.stringify({ pid: process.pid, start: processStart(process.pid) });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = fs.openSync(file, 'wx');
      fs.writeFileSync(fd, identity);
      fs.closeSync(fd);
      return () => {
        if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === identity) fs.unlinkSync(file);
      };
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      const record = JSON.parse(fs.readFileSync(file, 'utf8'));
      const pid = typeof record === 'number' ? record : record.pid;
      if (!Number.isInteger(pid) || pid <= 0) throw new Error('The database writer lock needs inspection before startup.');
      // Container restarts often reuse PID 1. Compare Linux process start times, too.
      if (record.start && processStart(pid) && record.start !== processStart(pid)) { fs.unlinkSync(file); continue; }
      try { process.kill(pid, 0); }
      catch (probeError) {
        if (probeError.code === 'ESRCH') { fs.unlinkSync(file); continue; }
        throw probeError;
      }
      throw new Error('Another server already owns this data directory. Run only one server instance.');
    }
  }
  throw new Error('Could not acquire the database writer lock.');
}
