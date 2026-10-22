'use client';
import { useEffect, useState } from 'react';
import { fmtDate, timeAgo } from './ui';

/** Relative time, rendered on the client so it uses the viewer's clock and timezone. */
export function TimeAgo({ iso }: { iso: string }) {
  const [text, setText] = useState('');
  useEffect(() => { setText(timeAgo(iso)); }, [iso]);
  return <time dateTime={iso} title={text ? fmtDate(iso) : undefined}>{text}</time>;
}
