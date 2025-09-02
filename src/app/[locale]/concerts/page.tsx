'use client';

import Link from "next/link";
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';

// Mock concert data
const concerts = [
  {
    id: "bach-evening",
    title: "Bach Organ Masterpieces",
    date: "2024-12-15T19:00:00",
    venue: "St. Mary's Cathedral",
    performer: "Dr. Michael Chen",
    description: "An evening of Johann Sebastian Bach's most beloved organ works performed on our historic 1892 organ.",
    image: "🎹",
    program: ["Toccata and Fugue in D minor", "Passacaglia in C minor", "Jesu, Joy of Man's Desiring"]
  },
  {
    id: "christmas-organ",
    title: "Christmas Organ Spectacular",
    date: "2024-12-22T20:00:00",
    venue: "Central Concert Hall",
    performer: "Sarah Williams",
    description: "Celebrate the holiday season with festive organ music from around the world.",
    image: "🎄",
    program: ["Christmas Fantasy", "Silent Night Variations", "Joy to the World"]
  },
  {
    id: "contemporary-organ",
    title: "Modern Organ Works",
    date: "2025-01-10T18:30:00",
    venue: "Contemporary Arts Center",
    performer: "Ensemble Nova",
    description: "Exploring the boundaries of organ music with contemporary compositions and experimental works.",
    image: "🎵",
    program: ["Digital Landscapes", "Urban Rhythms", "Electronic Organ Suite"]
  }
];

export default function ConcertsPage() {
  const t = useTranslations();
  const params = useParams();
  const locale = params.locale as string;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
                          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
              <span className="text-4xl">🎹</span>
              {t('concerts.title')}
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              {t('concerts.subtitle')}
            </p>
            </div>

          </div>
        </div>

        {/* Concerts Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {concerts.map((concert) => (
            <div key={concert.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
              {/* Concert Image/Icon */}
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-32 flex items-center justify-center">
                <span className="text-6xl">{concert.image}</span>
              </div>

              {/* Concert Details */}
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {concert.title}
                </h2>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-gray-600 dark:text-gray-300">
                    <span className="text-lg mr-2">📅</span>
                    <span className="text-sm">
                      {new Date(concert.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>

                  <div className="flex items-center text-gray-600 dark:text-gray-300">
                    <span className="text-lg mr-2">🕒</span>
                    <span className="text-sm">
                      {new Date(concert.date).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  <div className="flex items-center text-gray-600 dark:text-gray-300">
                    <span className="text-lg mr-2">📍</span>
                    <span className="text-sm">{concert.venue}</span>
                  </div>

                  <div className="flex items-center text-gray-600 dark:text-gray-300">
                    <span className="text-lg mr-2">🎤</span>
                    <span className="text-sm">{concert.performer}</span>
                  </div>
                </div>

                <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-3">
                  {concert.description}
                </p>

                {/* Program Preview */}
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Program Highlights:</h4>
                  <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    {concert.program.slice(0, 2).map((piece, index) => (
                      <li key={index} className="flex items-center">
                        <span className="mr-2">♪</span>
                        {piece}
                      </li>
                    ))}
                    {concert.program.length > 2 && (
                      <li className="text-gray-500">+{concert.program.length - 2} more pieces</li>
                    )}
                  </ul>
                </div>

                {/* View Concert Button */}
                <Link href={`/${locale}/concerts/${concert.id}`}>
                  <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg">
                    {t('concerts.viewDetails')}
                  </button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Call to Action */}
        <div className="mt-12 text-center">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              🎟️ {t('concerts.newsletter.title')}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {t('concerts.newsletter.description')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <input
                type="email"
                placeholder={t('concerts.newsletter.emailPlaceholder')}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <button className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg">
                {t('concerts.newsletter.subscribe')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
