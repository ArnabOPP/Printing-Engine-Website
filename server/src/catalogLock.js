let pending = Promise.resolve();
export function withCatalogLock(action) {
  const task = pending.then(action);
  pending = task.catch(() => {});
  return task;
}
