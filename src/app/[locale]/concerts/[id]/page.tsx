'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

// Mock concert data - in a real app, this would come from an API
const concerts = [
  {
    id: "bach-evening",
    title: "Bach Organ Masterpieces",
    date: "2024-12-15T19:00:00",
    venue: "St. Mary's Cathedral",
    performer: "Dr. Michael Chen",
    description: "An evening of Johann Sebastian Bach's most beloved organ works performed on our historic 1892 organ.",
    image: "🎹",
    program: [
      { title: "Toccata and Fugue in D minor, BWV 565", composer: "J.S. Bach", duration: "8:30" },
      { title: "Passacaglia in C minor, BWV 582", composer: "J.S. Bach", duration: "12:45" },
      { title: "Jesu, Joy of Man's Desiring, BWV 147", composer: "J.S. Bach", duration: "6:20" },
      { title: "Prelude and Fugue in C major, BWV 531", composer: "J.S. Bach", duration: "7:15" },
      { title: "Intermission", composer: "", duration: "15:00" },
      { title: "Fantasia in G major, BWV 572", composer: "J.S. Bach", duration: "9:30" },
      { title: "Chorale Prelude 'Wachet auf', BWV 645", composer: "J.S. Bach", duration: "4:45" }
    ],
    streamUrl: "#", // Placeholder for streaming URL
    venueDetails: "Historic cathedral with stunning acoustics and a 1892 organ by Cavaillé-Coll"
  },
  {
    id: "christmas-organ",
    title: "Christmas Organ Spectacular",
    date: "2024-12-22T20:00:00",
    venue: "Central Concert Hall",
    performer: "Sarah Williams",
    description: "Celebrate the holiday season with festive organ music from around the world.",
    image: "🎄",
    program: [
      { title: "Christmas Fantasy", composer: "Traditional", duration: "10:00" },
      { title: "Silent Night Variations", composer: "Franz Gruber arr. Williams", duration: "8:15" },
      { title: "Joy to the World", composer: "G.F. Handel", duration: "6:30" },
      { title: "O Holy Night", composer: "Adolphe Adam", duration: "7:45" },
      { title: "Intermission", composer: "", duration: "15:00" },
      { title: "Carols from Around the World", composer: "Various", duration: "12:20" },
      { title: "Hallelujah Chorus Organ Transcription", composer: "G.F. Handel", duration: "5:50" }
    ],
    streamUrl: "#",
    venueDetails: "Modern concert hall with state-of-the-art acoustics and lighting"
  },
  {
    id: "contemporary-organ",
    title: "Modern Organ Works",
    date: "2025-01-10T18:30:00",
    venue: "Contemporary Arts Center",
    performer: "Ensemble Nova",
    description: "Exploring the boundaries of organ music with contemporary compositions and experimental works.",
    image: "🎵",
    program: [
      { title: "Digital Landscapes", composer: "Maria Rodriguez", duration: "11:30" },
      { title: "Urban Rhythms", composer: "James Thompson", duration: "9:45" },
      { title: "Electronic Organ Suite", composer: "Ensemble Nova", duration: "15:20" },
      { title: "Minimalist Meditation", composer: "Sarah Chen", duration: "7:10" },
      { title: "Intermission", composer: "", duration: "15:00" },
      { title: "Experimental Soundscapes", composer: "Various Artists", duration: "13:40" },
      { title: "Contemporary Chorale", composer: "Michael Park", duration: "8:25" }
    ],
    streamUrl: "#",
    venueDetails: "Cutting-edge arts center featuring experimental music and multimedia performances"
  }
];

interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export default function ConcertPage() {
  const params = useParams();
  const concertId = params.id as string;
  const t = useTranslations();

  const [timeLeft, setTimeLeft] = useState<CountdownTime>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isLive, setIsLive] = useState(false);

  const concert = concerts.find(c => c.id === concertId);

  useEffect(() => {
    if (!concert) return;

    const targetDate = new Date(concert.date).getTime();

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000)
        });
        setIsLive(false);
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setIsLive(true);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [concert]);

  if (!concert) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">{t('concert.notFound')}</h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">{t('concert.notFoundMessage')}</p>
          <Link href="/concerts">
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl">
              {t('concert.viewAllConcerts')}
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const totalDuration = concert.program.reduce((total, piece) => {
    if (piece.composer === "") return total; // Skip intermission
    const [minutes, seconds] = piece.duration.split(':').map(Number);
    return total + minutes * 60 + seconds;
  }, 0);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/concerts">
            <button className="mb-4 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200">
              ← Back to Concerts
            </button>
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
            <span className="text-4xl">{concert.image}</span>
            {concert.title}
          </h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Concert Info Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="text-6xl">{concert.image}</div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {concert.title}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">{concert.description}</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center text-gray-600 dark:text-gray-300">
                      <span className="text-lg mr-2">📅</span>
                      <span>{new Date(concert.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}</span>
                    </div>
                    <div className="flex items-center text-gray-600 dark:text-gray-300">
                      <span className="text-lg mr-2">🕒</span>
                      <span>{new Date(concert.date).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</span>
                    </div>
                    <div className="flex items-center text-gray-600 dark:text-gray-300">
                      <span className="text-lg mr-2">📍</span>
                      <span>{concert.venue}</span>
                    </div>
                    <div className="flex items-center text-gray-600 dark:text-gray-300">
                      <span className="text-lg mr-2">🎤</span>
                      <span>{concert.performer}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Countdown Timer */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 text-center">
                {isLive ? t('concert.liveNow') : t('concert.countdown')}
              </h3>

              {isLive ? (
                <div className="text-center">
                  <div className="bg-red-500 text-white text-2xl font-bold py-8 px-4 rounded-lg mb-4">
                    🎹 CONCERT IS LIVE! 🎹
                  </div>
                  <button
                    onClick={() => window.open(concert.streamUrl, '_blank')}
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl text-lg"
                  >
                    🎥 {t('concert.watchLive')}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="bg-blue-100 dark:bg-blue-900 p-4 rounded-lg">
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{timeLeft.days}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">{t('concert.days')}</div>
                  </div>
                  <div className="bg-green-100 dark:bg-green-900 p-4 rounded-lg">
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">{timeLeft.hours}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">{t('concert.hours')}</div>
                  </div>
                  <div className="bg-yellow-100 dark:bg-yellow-900 p-4 rounded-lg">
                    <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{timeLeft.minutes}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">{t('concert.minutes')}</div>
                  </div>
                  <div className="bg-purple-100 dark:bg-purple-900 p-4 rounded-lg">
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{timeLeft.seconds}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">{t('concert.seconds')}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Venue Details */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">📍 {t('concert.venue')}</h3>
              <p className="text-gray-600 dark:text-gray-300">{concert.venueDetails}</p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Concert Program */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span>🎼</span>
                {t('concert.program')}
              </h3>

              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-900 dark:text-white">{t('concert.totalDuration')}:</span>
                  <span className="text-gray-600 dark:text-gray-300">{formatDuration(totalDuration)}</span>
                </div>
              </div>

              <div className="space-y-3">
                {concert.program.map((piece, index) => (
                  <div key={index} className={`flex justify-between items-center py-2 px-3 rounded-lg ${
                    piece.composer === "" ? "bg-gray-100 dark:bg-gray-700 italic" : "hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}>
                    <div className="flex-1">
                      <div className={`font-medium ${piece.composer === "" ? "text-gray-500 dark:text-gray-400" : "text-gray-900 dark:text-white"}`}>
                        {piece.title}
                      </div>
                      {piece.composer && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {piece.composer}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                      {piece.duration}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{t('concert.quickActions')}</h3>
              <div className="space-y-3">
                <button className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200">
                  {t('concert.setReminder')}
                </button>
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200">
                  {t('concert.shareConcert')}
                </button>
                <button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200">
                  {t('concert.getTickets')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
