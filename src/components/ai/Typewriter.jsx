import React, { useEffect, useMemo, useRef, useState } from 'react';

const REDUCED =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Typewriter — progressively reveals text (streaming feel).
 * Props:
 *  - text: a single string, OR
 *  - lines: an array of strings (revealed sequentially, joined by "\n")
 *  - speed: ms per tick (default 24)
 *  - showCaret: boolean (default true)
 *  - onDone: callback when fully revealed
 * Click anywhere on the element to instantly finish.
 */
export default function Typewriter({ text, lines, speed = 24, showCaret = true, onDone }) {
  const full = useMemo(() => {
    if (Array.isArray(lines)) return lines.join('\n');
    return text || '';
  }, [text, lines]);

  const [shown, setShown] = useState(REDUCED ? full : '');
  const [done, setDone] = useState(REDUCED);
  const idx = useRef(0);
  const timer = useRef(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    idx.current = 0;
    setShown(REDUCED ? full : '');
    setDone(REDUCED);

    if (REDUCED) {
      onDoneRef.current?.();
      return undefined;
    }

    const step = Math.max(1, Math.ceil(full.length / 60));
    const tick = () => {
      idx.current += step;
      const slice = full.slice(0, idx.current);
      setShown(slice);
      if (idx.current >= full.length) {
        setDone(true);
        onDoneRef.current?.();
        return;
      }
      timer.current = window.setTimeout(tick, speed);
    };
    timer.current = window.setTimeout(tick, speed);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [full, speed]);

  function finish() {
    if (done) return;
    if (timer.current) window.clearTimeout(timer.current);
    setShown(full);
    setDone(true);
    onDoneRef.current?.();
  }

  return (
    <span className="tw" onClick={finish}>
      {shown}
      {showCaret && !done ? <span className="tw__caret">▍</span> : null}
    </span>
  );
}
