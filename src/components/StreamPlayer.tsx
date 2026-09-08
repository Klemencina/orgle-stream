'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PlaybackAccessError, startPlayback, type PlaybackError, type PlaybackState } from '@/lib/playback-controller';

export default function StreamPlayer({ concertId, adminPreview = false }: { concertId: string; adminPreview?: boolean }) {
  const t = useTranslations('player');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controllerRef = useRef<ReturnType<typeof startPlayback> | null>(null);
  const [state, setState] = useState<PlaybackState>({ status: 'loading' });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const controller = startPlayback(video, {
      onState: setState,
      loadHls: async () => (await import('hls.js')).default,
      getAccess: async (signal) => {
        const response = await fetch(`/api/concerts/${encodeURIComponent(concertId)}?stream=true${adminPreview ? '&admin=true' : ''}`, {
          cache: 'no-store', signal,
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const codes: PlaybackError[] = ['signIn', 'purchaseRequired', 'outsideWindow', 'notFound', 'notConfigured'];
          if (codes.includes(body.code)) throw new PlaybackAccessError(body.code);
          throw new Error('Playback request failed');
        }
        const body = await response.json();
        if (typeof body.playbackUrl !== 'string' || !body.playbackUrl) throw new PlaybackAccessError('notConfigured');
        return { playbackUrl: body.playbackUrl };
      },
    });
    controllerRef.current = controller;
    return () => {
      controllerRef.current = null;
      controller.dispose();
    };
  }, [concertId, adminPreview]);

  const busy = state.status === 'loading' || state.status === 'reconnecting';
  return (
    <div className="w-full">
      <div className="aspect-video rounded-xl overflow-hidden bg-black relative">
        <video ref={videoRef} controls playsInline crossOrigin="anonymous" aria-label={t('videoLabel')} className="w-full h-full" />
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white pointer-events-none" role="status">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2" />
              <div className="text-sm">{t(state.status)}</div>
            </div>
          </div>
        )}
      </div>
      {state.status === 'ready' && (
        <button type="button" onClick={() => void controllerRef.current?.play()} className="mt-3 rounded-lg bg-orange-500 px-5 py-2 font-semibold text-white">
          {t('play')}
        </button>
      )}
      {state.status === 'error' && (
        <div className="mt-3" role="alert">
          <p className="text-sm text-red-600">{t(state.error || 'connection')}</p>
          <button type="button" onClick={() => controllerRef.current?.retry()} className="mt-2 rounded-lg bg-orange-500 px-5 py-2 font-semibold text-white">
            {t('retry')}
          </button>
        </div>
      )}
    </div>
  );
}
