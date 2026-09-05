import React from 'react';

/**
 * Skeleton — shimmering placeholder shapes shown while a trace block is
 * "running", sized to roughly match the real content that replaces them so
 * the reveal doesn't visually jump.
 */

export function SkeletonLine({ width = '70%' }) {
  return <div className="skel skel-line" style={{ width }} />;
}

export function SkeletonGrid({ cells = 4 }) {
  return (
    <div className="skel-grid">
      {Array.from({ length: cells }).map((_, i) => (
        <div className="skel skel-cell" key={i} />
      ))}
    </div>
  );
}

export function SkeletonBar() {
  return <div className="skel skel-bar" />;
}

export function SkeletonCircle({ size = 84 }) {
  return <div className="skel skel-circle" style={{ width: size, height: size, borderRadius: '50%' }} />;
}

export function SkeletonBlock({ height = 120 }) {
  return <div className="skel skel-block" style={{ height }} />;
}

export function SkeletonRow() {
  return (
    <div className="skel-row">
      <div className="skel skel-line" style={{ width: '40%', margin: 0 }} />
      <div className="skel skel-line" style={{ width: '20%', margin: 0 }} />
    </div>
  );
}
