'use client';

import { useState, useEffect } from 'react';
import { LocalizedConcert } from '@/types/concert';
import { locales } from '@/i18n';
import { useTranslations } from 'next-intl';

interface ConcertFormProps {
  concert?: LocalizedConcert | null;
  onConcertCreated: (concert: LocalizedConcert) => void;
  onConcertUpdated: (concert: LocalizedConcert) => void;
  onCancel: () => void;
  locale: string;
}

interface ProgramPiece {
  title: string;
  composer: string;
}

interface TranslationData {
  title: string;
  subtitle?: string;
  venue: string;
  description: string;
  performers?: Array<{name: string, img: string, opis: string}>;
}

const localeNames = {
  en: 'English',
  sl: 'Slovenščina',
  it: 'Italiano'
};

export default function ConcertForm({ 
  concert, 
  onConcertCreated, 
  onConcertUpdated, 
  onCancel,
  locale 
}: ConcertFormProps) {
  const t = useTranslations('admin.form');
  const isEditing = Boolean(concert && concert.id);
  // Non-translatable fields
  const [basicData, setBasicData] = useState({
    date: '',
    time: '',
    isVisible: true,
  });

  // Translatable fields for each locale
  const [translations, setTranslations] = useState<Record<string, TranslationData>>({
    en: { title: '', subtitle: '', venue: '', description: '', performers: [] },
    sl: { title: '', subtitle: '', venue: '', description: '', performers: [] },
    it: { title: '', subtitle: '', venue: '', description: '', performers: [] }
  });

  // Program pieces: only two versions, Slovenian and Original
  const [program, setProgram] = useState<Record<string, ProgramPiece[]>>({
    sl: [{ title: '', composer: '' }],
    original: [{ title: '', composer: '' }]
  });

  const [activeTab, setActiveTab] = useState('en');
  const [programActiveTab, setProgramActiveTab] = useState<'sl' | 'original'>('sl');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Store original data for change detection
  const [originalData, setOriginalData] = useState<{
    basicData: typeof basicData;
    translations: typeof translations;
    program: typeof program;
  } | null>(null);

  // Function to check if there are any changes
  const hasChanges = (): boolean => {
    if (!concert || !originalData) return true; // New concert always has changes
    
    // Deep comparison of basic data
    const basicDataChanged = JSON.stringify(basicData) !== JSON.stringify(originalData.basicData);
    if (basicDataChanged) return true;
    
    // Deep comparison of translations
    const translationsChanged = JSON.stringify(translations) !== JSON.stringify(originalData.translations);
    if (translationsChanged) return true;
    
    // Deep comparison of program
    const programChanged = JSON.stringify(program) !== JSON.stringify(originalData.program);
    if (programChanged) return true;

    return false;
  };

  useEffect(() => {
    if (concert) {
      const concertDate = new Date(concert.date);
      setBasicData({
        date: concertDate.toISOString().split('T')[0],
        time: concertDate.toTimeString().split(' ')[0].substring(0, 5),
        isVisible: concert.isVisible !== false, // Default to true if not set
      });

      // Load all translations for editing
      if (concert.id) {
        fetchAllTranslations(concert.id);
      } else {
        // For new concerts, just populate current locale
        setTranslations(prev => ({
          ...prev,
          [locale]: {
            title: concert.title,
            subtitle: concert.subtitle || '',
            venue: concert.venue,
            description: concert.description,
            performers: concert.performers || []
          }
        }));

        setProgram(prev => ({
          ...prev,
          [locale]: concert.program.map(piece => ({
            title: piece.title,
            composer: piece.composer,
          }))
        }));
        
        // Store original data for change detection
        if (concert) {
          setOriginalData({
            basicData: {
              date: concertDate.toISOString().split('T')[0],
              time: concertDate.toTimeString().split(' ')[0].substring(0, 5),
              isVisible: concert.isVisible !== false,
            },
            translations: {
              ...translations,
              [locale]: {
                title: concert.title,
                subtitle: concert.subtitle || '',
                venue: concert.venue,
                description: concert.description,
                performers: concert.performers || []
              }
            },
            program: {
              ...program,
              [locale]: concert.program.map(piece => ({
                title: piece.title,
                composer: piece.composer,
              }))
            },
          });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concert, locale]);

  const fetchAllTranslations = async (concertId: string) => {
    try {
      const response = await fetch(`/api/concerts/${concertId}?allTranslations=true`);
      if (!response.ok) {
        throw new Error(t('failedToFetch'));
      }
      const data = await response.json();
      
      // Populate all translations for i18n locales
      const newTranslations: Record<string, TranslationData> = {};
      locales.forEach(loc => {
        const translation = data.translations.find((t: { locale: string; title: string; subtitle?: string; venue: string; description: string; performers?: Array<{name: string, img: string, opis: string}> }) => t.locale === loc);
        newTranslations[loc] = translation ? {
          title: translation.title,
          subtitle: translation.subtitle || '',
          venue: translation.venue,
          description: translation.description,
          performers: translation.performers || []
        } : { title: '', subtitle: '', venue: '', description: '', performers: [] };
      });
      setTranslations(newTranslations);

      // Build program only for 'sl' and 'original'
      const buildProgramFor = (loc: string): ProgramPiece[] => {
        const pieces = (data.program || []).map((piece: { translations: { locale: string; title: string; composer: string }[] }) => {
          const tr = piece.translations.find((t: { locale: string }) => t.locale === loc);
          return { title: tr?.title || '', composer: tr?.composer || '' };
        });
        return pieces.length > 0 ? pieces : [{ title: '', composer: '' }];
      };
        setProgram({
          sl: buildProgramFor('sl'),
          original: buildProgramFor('original')
        });


        // Store original data for change detection
      if (concert) {
        const concertDate = new Date(concert.date);
        setOriginalData({
          basicData: {
            date: concertDate.toISOString().split('T')[0],
            time: concertDate.toTimeString().split(' ')[0].substring(0, 5),
            isVisible: concert.isVisible !== false,
          },
          translations: newTranslations,
          program: (() => {
            const sl = (data.program || []).map((piece: { translations: { locale: string; title: string; composer: string }[] }) => {
              const tr = piece.translations.find((t: { locale: string }) => t.locale === 'sl');
              return { title: tr?.title || '', composer: tr?.composer || '' };
            });
            const original = (data.program || []).map((piece: { translations: { locale: string; title: string; composer: string }[] }) => {
              const tr = piece.translations.find((t: { locale: string }) => t.locale === 'original');
              return { title: tr?.title || '', composer: tr?.composer || '' };
            });
            const maxLen = Math.max(sl.length, original.length);
            const pad = (arr: ProgramPiece[]) => arr.concat(Array(Math.max(0, maxLen - arr.length)).fill({ title: '', composer: '' }));
            return { sl: pad(sl), original: pad(original) };
          })()
        });
      }
    } catch (error) {
      console.error('Error fetching all translations:', error);
      // Fallback to current locale only
      setTranslations(prev => ({
        ...prev,
        [locale]: {
          title: concert?.title || '',
          subtitle: concert?.subtitle || '',
          venue: concert?.venue || '',
          description: concert?.description || '',
          performers: concert?.performers || []
        }
      }));
    }
  };

  const handleBasicDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setBasicData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTranslationChange = (locale: string, field: keyof TranslationData, value: string) => {
    setTranslations(prev => ({
      ...prev,
      [locale]: {
        ...prev[locale],
        [field]: value
      }
    }));
  };

  const handleProgramChange = (locale: string, index: number, field: keyof ProgramPiece, value: string) => {
    setProgram(prev => {
      const next = { ...prev };
      // Ensure paired index exists in both locales
      const maxLen = Math.max(next.sl.length, next.original.length, index + 1);
      const ensureLen = (arr: ProgramPiece[]) => arr.concat(Array(Math.max(0, maxLen - arr.length)).fill({ title: '', composer: '' }));
      next.sl = ensureLen(next.sl);
      next.original = ensureLen(next.original);
      // Update the value
      next[locale] = next[locale].map((piece, i) => (i === index ? { ...piece, [field]: value } : piece));
      return next;
    });
  };

  const addProgramPiece = () => {
    setProgram(prev => {
      const next = { ...prev };
      const newLength = Math.max(next.sl.length, next.original.length) + 1;
      const padTo = (arr: ProgramPiece[], len: number) => arr.concat(Array(Math.max(0, len - arr.length)).fill({ title: '', composer: '' }));
      next.sl = padTo(next.sl, newLength);
      next.original = padTo(next.original, newLength);
      return next;
    });
  };

  const removeProgramPiece = (_locale: string, index: number) => {
    // Remove at the same index in both locales, ensure at least one row remains
    setProgram(prev => {
      const minLen = Math.min(prev.sl.length, prev.original.length);
      if (minLen <= 1) return prev;
      const removeAt = (arr: ProgramPiece[]) => arr.filter((_, i) => i !== index);
      const next = { sl: removeAt(prev.sl), original: removeAt(prev.original) };
      if (next.sl.length === 0) next.sl = [{ title: '', composer: '' }];
      if (next.original.length === 0) next.original = [{ title: '', composer: '' }];
      return next;
    });
  };

  const copyToAllLocales = (sourceLocale: string) => {
    const sourceTranslation = translations[sourceLocale];
    const sourceProgram = program[sourceLocale];
    
    locales.forEach(loc => {
      if (loc !== sourceLocale) {
        setTranslations(prev => ({
          ...prev,
          [loc]: { ...sourceTranslation }
        }));
        setProgram(prev => ({
          ...prev,
          [loc]: sourceProgram.map(piece => ({ ...piece }))
        }));
      }
    });
  };

  const randomFill = () => {
    // Random basic data
    const today = new Date();
    const randomDate = new Date(today.getTime() + Math.random() * 30 * 24 * 60 * 60 * 1000); // Random date within next 30 days
    const randomTime = `${Math.floor(Math.random() * 12) + 1}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')} ${Math.random() > 0.5 ? 'PM' : 'AM'}`;
    
    setBasicData({
      date: randomDate.toISOString().split('T')[0],
      time: randomTime,
      isVisible: Math.random() > 0.3, // 70% chance of being visible
    });

    // Random concert data for each locale
    const concertTemplates = {
      sl: [
        {
          title: "Simfonija zvezd",
          venue: "Velika koncertna dvorana",
          performer: "Dr. Sarah Johnson",
          description: "Večer klasičnih mojstrovin, ki jih izvajajo svetovno priznani glasbeniki v intimnem okolju."
        },
        {
          title: "Jazz pod mesecem",
          venue: "Blue Note Lounge",
          performer: "The Midnight Quartet",
          description: "Doživite čarovnijo jazza v intimnem okolju z našim rezidenčnim kvartetom."
        },
        {
          title: "Večer komorne glasbe",
          venue: "Kapela sv. Cecilije",
          performer: "Ensemble Aurora",
          description: "Rafiniran večer komorne glasbe z deli Mozarta, Beethovna in sodobnih skladateljev."
        }
      ],
      original: [
        {
          title: "Sinfonia delle Stelle",
          venue: "Gran Sala da Concerto",
          performer: "Dr. Sarah Johnson",
          description: "Una serata di capolavori classici eseguiti da musicisti di fama mondiale in un ambiente intimo."
        },
        {
          title: "Jazz Sotto la Luna",
          venue: "Blue Note Lounge",
          performer: "The Midnight Quartet",
          description: "Vivi la magia del jazz in un ambiente intimo con il nostro quartetto residente."
        },
        {
          title: "Serata di Musica da Camera",
          venue: "Cappella di Santa Cecilia",
          performer: "Ensemble Aurora",
          description: "Una serata raffinata di musica da camera con opere di Mozart, Beethoven e compositori contemporanei."
        }
      ]
    };

    const programTemplates = {
      sl: [
        { title: "Predigra v C-duru", composer: "J.S. Bach" },
        { title: "Sonata št. 14 'Mesečina'", composer: "L. van Beethoven" },
        { title: "Intermezzo", composer: "J. Brahms" },
        { title: "Nokturno v Es-duru", composer: "F. Chopin" },
        { title: "Odmor", composer: "" },
        { title: "Rapsodija v modrem", composer: "G. Gershwin" },
        { title: "Mesečina", composer: "C. Debussy" }
      ],
      original: [
        { title: "Prélude en Do Majeur", composer: "J.S. Bach" },
        { title: "Sonata No. 14 'Moonlight'", composer: "L. van Beethoven" },
        { title: "Intermezzo", composer: "J. Brahms" },
        { title: "Nocturne en Mi bémol majeur", composer: "F. Chopin" },
        { title: "Intermission", composer: "" },
        { title: "Rhapsody in Blue", composer: "G. Gershwin" },
        { title: "Clair de Lune", composer: "C. Debussy" }
      ]
    };

    // Select random templates for 'sl' and use 'original' program for original
    const randomSlTemplate = concertTemplates.sl[Math.floor(Math.random() * concertTemplates.sl.length)];
    setTranslations(prev => ({
      ...prev,
      sl: { ...randomSlTemplate }
    }));
    setProgram({
      sl: programTemplates.sl.map(piece => ({ ...piece })),
      original: programTemplates.original.map(piece => ({ ...piece }))
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Combine date and time
      const dateTime = new Date(`${basicData.date}T${basicData.time}`);
      
      const concertData = {
        date: dateTime.toISOString(),

        isVisible: basicData.isVisible,
        translations: Object.entries(translations).map(([locale, translation]) => ({
          locale,
          ...translation
        })),
        program: [
          { locale: 'sl', pieces: program.sl },
          { locale: 'original', pieces: program.original }
        ],
      };


      const url = isEditing ? `/api/concerts/${concert?.id}` : '/api/concerts';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(concertData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error Response:', errorData);
        const errorMessage = errorData.error || `Failed to ${concert ? 'update' : 'create'} concert`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      setSuccess(concert ? 'Concert updated successfully!' : 'Concert created successfully!');
      
      if (isEditing) {
        onConcertUpdated(result);
      } else {
        onConcertCreated(result);
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          <div className="flex items-center">
            <span className="text-green-500 mr-2">✓</span>
            {success}
          </div>
        </div>
      )}

      {/* Basic Information (Non-translatable) */}
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('basicInfo')}</h3>
          <button
            type="button"
            onClick={() => {
              const today = new Date();
              const randomDate = new Date(today.getTime() + Math.random() * 30 * 24 * 60 * 60 * 1000);
              const randomTime = `${Math.floor(Math.random() * 12) + 1}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')} ${Math.random() > 0.5 ? 'PM' : 'AM'}`;

              setBasicData({
                date: randomDate.toISOString().split('T')[0],
                time: randomTime,
                isVisible: Math.random() > 0.3, // 70% chance of being visible
              });

              // Add some sample performers
              const samplePerformers = [
                { name: 'Dr. Sarah Johnson', img: 'https://example.com/sarah.jpg', opis: 'Renowned pianist specializing in contemporary classical music' },
                { name: 'The Midnight Quartet', img: 'https://example.com/quartet.jpg', opis: 'String quartet known for their innovative interpretations' },
                { name: 'Ensemble Aurora', img: 'https://example.com/ensemble.jpg', opis: 'Chamber ensemble featuring both traditional and experimental works' }
              ];
              setPerformersJson(Math.random() > 0.5 ? samplePerformers.slice(0, Math.floor(Math.random() * 3) + 1) : []);
            }}
            className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-sm w-full sm:w-auto"
          >
            🎲 {t('fillWithSample')}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('date')} *
            </label>
            <input
              type="date"
              name="date"
              value={basicData.date}
              onChange={handleBasicDataChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-600 dark:border-gray-500 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('time')} *
            </label>
            <input
              type="time"
              name="time"
              value={basicData.time}
              onChange={handleBasicDataChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-600 dark:border-gray-500 dark:text-white"
            />
          </div>

          

          <div className="md:col-span-2">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isVisible"
                name="isVisible"
                checked={basicData.isVisible}
                onChange={(e) => setBasicData(prev => ({ ...prev, isVisible: e.target.checked }))}
                className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
              />
              <label htmlFor="isVisible" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">{t('isVisible')}</span>
                <span className="text-gray-500 dark:text-gray-400 block text-xs">
                  {basicData.isVisible ? t('visibilityHelp') : t('visibilityHelpHidden')}
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Translation Tabs */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('translations')}</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={randomFill}
              className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-sm"
            >
              🎲 Random Fill
            </button>
            <button
              type="button"
              onClick={() => copyToAllLocales(activeTab)}
              className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
            >
              Copy to All Languages
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-600">
          <nav className="-mb-px flex space-x-8">
            {locales.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setActiveTab(loc)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === loc
                    ? 'border-orange-500 text-orange-500 dark:text-orange-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {localeNames[loc as keyof typeof localeNames]}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {locales.map((loc) => (
            <div key={loc} className={activeTab === loc ? 'block' : 'hidden'}>
              <div className="space-y-6">
                {/* Basic Translation Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('title')} *
                    </label>
                    <input
                      type="text"
                      value={translations[loc].title}
                      onChange={(e) => handleTranslationChange(loc, 'title', e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Subtitle
                    </label>
                    <input
                      type="text"
                      value={translations[loc].subtitle || ''}
                      onChange={(e) => handleTranslationChange(loc, 'subtitle', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('venue')} *
                  </label>
                  <input
                    type="text"
                    value={translations[loc].venue}
                    onChange={(e) => handleTranslationChange(loc, 'venue', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('description')}
                  </label>
                  <textarea
                    value={translations[loc].description}
                    onChange={(e) => handleTranslationChange(loc, 'description', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                {/* Performers Section */}
                <div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('performerInfo')}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const newPerformers = [...(translations[loc].performers || [])];
                        newPerformers.push({ name: '', img: '', opis: '' });
                        handleTranslationChange(loc, 'performers', newPerformers);
                      }}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-sm w-full sm:w-auto"
                    >
                      + Add Performer
                    </button>
                  </div>

                  <div className="space-y-4">
                    {(translations[loc].performers || []).map((performer, index) => (
                      <div key={index} className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg space-y-4">
                        {/* Name, Image URL, and Remove button in a row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Name
                            </label>
                            <input
                              type="text"
                              value={performer.name}
                              onChange={(e) => {
                                const newPerformers = [...(translations[loc].performers || [])];
                                newPerformers[index].name = e.target.value;
                                handleTranslationChange(loc, 'performers', newPerformers);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                              placeholder="Performer name"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Image URL
                            </label>
                            <input
                              type="text"
                              value={performer.img}
                              onChange={(e) => {
                                const newPerformers = [...(translations[loc].performers || [])];
                                newPerformers[index].img = e.target.value;
                                handleTranslationChange(loc, 'performers', newPerformers);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                              placeholder="Image URL"
                            />
                          </div>
                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() => {
                                const newPerformers = (translations[loc].performers || []).filter((_, i) => i !== index);
                                handleTranslationChange(loc, 'performers', newPerformers);
                              }}
                              className="w-full md:w-auto bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded text-sm"
                            >
                              Remove Performer
                            </button>
                          </div>
                        </div>

                        {/* Full-width description textarea */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Description
                          </label>
                          <textarea
                            value={performer.opis}
                            onChange={(e) => {
                              const newPerformers = [...(translations[loc].performers || [])];
                              newPerformers[index].opis = e.target.value;
                              handleTranslationChange(loc, 'performers', newPerformers);
                            }}
                            rows={8}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-vertical min-h-[120px]"
                            placeholder="Detailed biography and description (1-2 paragraphs)"
                          />
                        </div>
                      </div>
                    ))}
                    {(translations[loc].performers || []).length === 0 && (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        No performers added yet. Click &quot;Add Performer&quot; to add one.
                      </div>
                    )}
                  </div>
                </div>

                
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Program Editor (Slovenian & Original) */}
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mt-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('program')}</h3>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setProgramActiveTab('sl')}
                className={`px-3 py-1 text-sm flex-1 sm:flex-none ${programActiveTab === 'sl' ? 'bg-orange-500 text-white' : 'bg-transparent text-gray-700 dark:text-gray-300'}`}
              >
                Slovensko
              </button>
              <button
                type="button"
                onClick={() => setProgramActiveTab('original')}
                className={`px-3 py-1 text-sm flex-1 sm:flex-none ${programActiveTab === 'original' ? 'bg-orange-500 text-white' : 'bg-transparent text-gray-700 dark:text-gray-300'}`}
              >
                Original
              </button>
            </div>
            <button
              type="button"
              onClick={() => addProgramPiece()}
              className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-sm w-full sm:w-auto"
            >
              + {t('addPiece')}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {program[programActiveTab].map((piece, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('title')}
                </label>
                <input
                  type="text"
                  value={piece.title}
                  onChange={(e) => handleProgramChange(programActiveTab, index, 'title', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('composer')}
                </label>
                <input
                  type="text"
                  value={piece.composer}
                  onChange={(e) => handleProgramChange(programActiveTab, index, 'composer', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => removeProgramPiece(programActiveTab, index)}
                  disabled={program[programActiveTab].length === 1}
                  className="bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-3 py-2 rounded text-sm"
                >
                  {t('removePiece')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex flex-col sm:flex-row sm:justify-end sm:space-x-4 space-y-3 sm:space-y-0 pt-6 border-t border-gray-200 dark:border-gray-600">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 order-2 sm:order-1"
        >
          {t('cancel')}
        </button>
        <button
          type="submit"
          disabled={loading || (isEditing ? !hasChanges() : false)}
          className={`px-6 py-2 rounded-lg transition-colors duration-200 order-1 sm:order-2 ${
            loading || (isEditing ? !hasChanges() : false)
              ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
              : 'bg-orange-500 hover:bg-orange-600 text-white'
          }`}
        >
          {loading ? t('saving') : (isEditing ? t('updateConcert') : t('createConcert'))}
        </button>
      </div>
    </form>
  );
}