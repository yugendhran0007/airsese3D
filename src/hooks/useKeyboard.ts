import { useEffect, useRef } from 'react';

/** Live key-state map (no re-renders). Arrow keys + WASD. */
export function useKeyboard() {
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Don't steal keys from form fields
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      keys.current[e.code] = true;
      // Arrow keys drive the avatar — stop them scrolling the page. Ctrl + A/D
      // turn the avatar, so they must not reach the browser as select-all and
      // add-bookmark; the arrow form of the same turn needs no such rescue.
      if (e.code.startsWith('Arrow') || (e.ctrlKey && (e.code === 'KeyA' || e.code === 'KeyD'))) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  return keys;
}
