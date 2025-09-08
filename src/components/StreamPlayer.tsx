'use client';

import { useEffect, useRef, useState } from 'react';
import type HlsType from 'hls.js';

interface StreamPlayerProps {
	concertId: string;
}

export default function StreamPlayer({ concertId }: StreamPlayerProps) {
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const initializedRef = useRef(false);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	// Debug logging
	useEffect(() => {
		console.log(`StreamPlayer: Mounted for concert ${concertId}`);
		return () => {
			console.log(`StreamPlayer: Unmounted for concert ${concertId}`);
		};
	}, [concertId]);

	useEffect(() => {
		let hls: HlsType | null = null;

		async function setup() {
			if (initializedRef.current) return; // Avoid double-init in React Strict Mode
			initializedRef.current = true;
			try {
				setLoading(true);
				let playbackUrl: string | null = null;
				try {
					playbackUrl = sessionStorage.getItem(`playbackUrl:${concertId}`);
				} catch {}
				if (!playbackUrl) {
					const res = await fetch(`/api/concerts/${concertId}?stream=true`, { cache: 'no-store' });
					if (!res.ok) {
						const data = await res.json().catch(() => ({}));
						throw new Error(data?.error || 'Stream unavailable');
					}
					const body = await res.json();
					playbackUrl = (body?.playbackUrl as string) || null;
					if (!playbackUrl) throw new Error('Missing playback URL');
					try { sessionStorage.setItem(`playbackUrl:${concertId}`, playbackUrl); } catch {}
				}

				const video = videoRef.current;
				if (!video) return;

				// Clear any existing source to prevent conflicts
				video.src = '';
				video.load();

				// Prefer native HLS if supported (Safari/iOS), otherwise use hls.js
				const canPlayNatively = video.canPlayType('application/vnd.apple.mpegurl');
				if (canPlayNatively) {
					video.src = playbackUrl;
					video.load();
					setLoading(false);
					return;
				}

				const hlsModule = await import('hls.js');
				const Hls = hlsModule.default;
				if (Hls.isSupported()) {
					hls = new Hls({
						lowLatencyMode: true,
						enableWorker: true,
						maxBufferLength: 30,
						maxMaxBufferLength: 600,
						levelLoadingMaxRetry: 4,
						levelLoadingMaxRetryTimeout: 4000,
						fragLoadingMaxRetry: 6,
						fragLoadingMaxRetryTimeout: 4000
					});

					hls.loadSource(playbackUrl);
					hls.attachMedia(video);

					hls.on(Hls.Events.MANIFEST_PARSED, async () => {
						console.log('HLS manifest parsed successfully');
						setLoading(false);
						setError(null);
						// Try to unmute after a short delay if user hasn't interacted yet
						setTimeout(() => {
							if (video.muted && video.volume === 0) {
								video.volume = 0.5;
							}
						}, 1000);
					});

					hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
						if (!hls) return;
						const isFatal = Boolean(data?.fatal);
						const details = data?.details;
						const type = data?.type;
						const label = `HLS ${details || type || 'error'}`;

						if (isFatal) {
							console.error(label, data);
							switch (type) {
								case Hls.ErrorTypes.NETWORK_ERROR:
									console.log('Network error, attempting to recover...');
									hls.startLoad();
									break;
								case Hls.ErrorTypes.MEDIA_ERROR:
									console.log('Media error, attempting to recover...');
									hls.recoverMediaError();
									break;
								default:
									console.error('Fatal HLS error, destroying instance');
									hls.destroy();
									setError('Stream error occurred');
							}
						} else {
							// Non-fatal errors are common when the stream isn't live yet. Be gentle and retry.
							if (
								details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
								details === Hls.ErrorDetails.LEVEL_LOAD_ERROR ||
								details === Hls.ErrorDetails.FRAG_LOAD_ERROR
							) {
								setError((prev) => prev || 'Stream not live yet. Retrying...');
								const instance = hls;
								setTimeout(() => {
									try { instance?.startLoad(); } catch {}
								}, 5000);
							}
							console.warn(label, data);
						}
					});

					hls.on(Hls.Events.LEVEL_SWITCHED, (_event: any, data: any) => {
						console.log('HLS level switched:', data);
					});
				} else {
					throw new Error('HLS not supported in this browser');
				}
			} catch (e) {
				setError(e instanceof Error ? e.message : 'Failed to start stream');
			} finally {
				setLoading(false);
			}
		}

		setup();

		return () => {
			if (hls) {
				try { hls.destroy(); } catch {}
			}
		};
	}, [concertId]);

	return (
		<div className="w-full">
			<div className="aspect-video rounded-xl overflow-hidden bg-black relative">
				<video
					ref={videoRef}
					controls
					playsInline
					autoPlay
					muted
					className="w-full h-full"
				/>
				{loading && (
					<div className="absolute inset-0 flex items-center justify-center bg-black text-white">
						<div className="text-center">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
							<div className="text-sm">Loading stream…</div>
						</div>
					</div>
				)}
			</div>
			{error && (
				<div className="mt-3 text-sm text-red-600">{error}</div>
			)}
		</div>
	);
}


