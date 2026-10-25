import { useCallback, useState } from 'react';

const LIMIT = 60;

// State with undo/redo. `set(updater)` records an undo step; `set(updater, false)` changes the
// present without one (used while dragging, after one `checkpoint()` at the start of the drag).
export function useHistory(initial) {
  const [h, setH] = useState(() => ({ present: initial, past: [], future: [] }));

  const set = useCallback((updater, push = true) => {
    setH((s) => {
      const next = typeof updater === 'function' ? updater(s.present) : updater;
      if (next === s.present) return s;
      if (!push) return { ...s, present: next };
      return { present: next, past: [...s.past.slice(-(LIMIT - 1)), s.present], future: [] };
    });
  }, []);

  const checkpoint = useCallback(() => {
    setH((s) => ({ ...s, past: [...s.past.slice(-(LIMIT - 1)), s.present], future: [] }));
  }, []);

  const undo = useCallback(() => {
    setH((s) => (s.past.length
      ? { present: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.present, ...s.future] }
      : s));
  }, []);

  const redo = useCallback(() => {
    setH((s) => (s.future.length
      ? { present: s.future[0], past: [...s.past, s.present], future: s.future.slice(1) }
      : s));
  }, []);

  return { design: h.present, set, checkpoint, undo, redo, canUndo: h.past.length > 0, canRedo: h.future.length > 0 };
}
