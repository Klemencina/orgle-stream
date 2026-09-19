'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatDescription } from '@/lib/description';

export default function ConcertDescription({ description }: { description: string }) {
  const t = useTranslations('concert');
  const id = useId();
  const contentRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const text = formatDescription(description);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const measure = () => {
      const lineHeight = parseFloat(getComputedStyle(content).lineHeight);
      setOverflows(content.scrollHeight > lineHeight * 8 + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [text]);

  if (!text) return null;

  return (
    <div className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-700">
      <p
        id={id}
        ref={contentRef}
        className={`max-w-prose whitespace-pre-line [overflow-wrap:anywhere] leading-7 text-gray-600 dark:text-gray-300 ${expanded ? '' : 'max-h-56 overflow-hidden'}`}
      >
        {text}
      </p>
      {overflows && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded(value => !value)}
          className="mt-3 rounded text-sm font-semibold text-orange-700 underline underline-offset-4 hover:text-orange-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500 dark:text-orange-400 dark:hover:text-orange-300"
        >
          {t(expanded ? 'readLess' : 'readMore')}
        </button>
      )}
    </div>
  );
}
