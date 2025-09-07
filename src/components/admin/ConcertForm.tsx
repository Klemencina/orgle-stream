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
  duration: string;
}

interface TranslationData {
  title: string;
  venue: string;
  performer: string;
  description: string;
  venueDetails: string;
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
  // Non-translatable fields
  const [basicData, setBasicData] = useState({
    date: '',
    time: '',
    image: '🎹',
    streamUrl: '',
    isVisible: true,
  });

  // Translatable fields for each locale
  const [translations, setTranslations] = useState<Record<string, TranslationData>>({
    en: { title: '', venue: '', performer: '', description: '', venueDetails: '' },
    sl: { title: '', venue: '', performer: '', description: '', venueDetails: '' },
    it: { title: '', venue: '', performer: '', description: '', venueDetails: '' }
  });

  // Program pieces with translations
  const [program, setProgram] = useState<Record<string, ProgramPiece[]>>({
    en: [{ title: '', composer: '', duration: '' }],
    sl: [{ title: '', composer: '', duration: '' }],
    it: [{ title: '', composer: '', duration: '' }]
  });

  const [activeTab, setActiveTab] = useState('en');
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
        image: concert.image,
        streamUrl: concert.streamUrl || '',
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
            venue: concert.venue,
            performer: concert.performer,
            description: concert.description,
            venueDetails: concert.venueDetails || ''
          }
        }));

        setProgram(prev => ({
          ...prev,
          [locale]: concert.program.map(piece => ({
            title: piece.title,
            composer: piece.composer,
            duration: piece.duration,
          }))
        }));
        
        // Store original data for change detection
        if (concert) {
          setOriginalData({
            basicData: {
              date: concertDate.toISOString().split('T')[0],
              time: concertDate.toTimeString().split(' ')[0].substring(0, 5),
              image: concert.image,
              streamUrl: concert.streamUrl || '',
              isVisible: concert.isVisible !== false,
            },
            translations: {
              ...translations,
              [locale]: {
                title: concert.title,
                venue: concert.venue,
                performer: concert.performer,
                description: concert.description,
                venueDetails: concert.venueDetails || ''
              }
            },
            program: {
              ...program,
              [locale]: concert.program.map(piece => ({
                title: piece.title,
                composer: piece.composer,
                duration: piece.duration,
              }))
            }
          });
        }
      }
    }
  }, [concert, locale]);

  const fetchAllTranslations = async (concertId: string) => {
    try {
      const response = await fetch(`/api/concerts/${concertId}?allTranslations=true`);
      if (!response.ok) {
        throw new Error(t('failedToFetch'));
      }
      const data = await response.json();
      
      // Populate all translations
      const newTranslations: Record<string, TranslationData> = {};
      const newProgram: Record<string, ProgramPiece[]> = {};
      
      locales.forEach(loc => {
        const translation = data.translations.find((t: any) => t.locale === loc);
        if (translation) {
          newTranslations[loc] = {
            title: translation.title,
            venue: translation.venue,
            performer: translation.performer,
            description: translation.description,
            venueDetails: translation.venueDetails || ''
          };
        } else {
          newTranslations[loc] = { title: '', venue: '', performer: '', description: '', venueDetails: '' };
        }
        
        // Group program pieces by locale
        const programPieces = data.program.map((piece: any) => {
          const pieceTranslation = piece.translations.find((t: any) => t.locale === loc);
          return {
            title: pieceTranslation?.title || '',
            composer: pieceTranslation?.composer || '',
            duration: piece.duration
          };
        });
        newProgram[loc] = programPieces.length > 0 ? programPieces : [{ title: '', composer: '', duration: '' }];
      });
      
      setTranslations(newTranslations);
      setProgram(newProgram);
      
      // Store original data for change detection
      if (concert) {
        const concertDate = new Date(concert.date);
        setOriginalData({
          basicData: {
            date: concertDate.toISOString().split('T')[0],
            time: concertDate.toTimeString().split(' ')[0].substring(0, 5),
            image: concert.image,
            streamUrl: concert.streamUrl || '',
            isVisible: concert.isVisible !== false,
          },
          translations: newTranslations,
          program: newProgram
        });
      }
    } catch (error) {
      console.error('Error fetching all translations:', error);
      // Fallback to current locale only
      setTranslations(prev => ({
        ...prev,
        [locale]: {
          title: concert?.title || '',
          venue: concert?.venue || '',
          performer: concert?.performer || '',
          description: concert?.description || '',
          venueDetails: concert?.venueDetails || ''
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
    setProgram(prev => ({
      ...prev,
      [locale]: prev[locale].map((piece, i) => 
        i === index ? { ...piece, [field]: value } : piece
      )
    }));
  };

  const addProgramPiece = (locale: string) => {
    setProgram(prev => ({
      ...prev,
      [locale]: [...prev[locale], { title: '', composer: '', duration: '' }]
    }));
  };

  const removeProgramPiece = (locale: string, index: number) => {
    if (program[locale].length > 1) {
      setProgram(prev => ({
        ...prev,
        [locale]: prev[locale].filter((_, i) => i !== index)
      }));
    }
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
      image: ['🎹', '🎵', '🎼', '🎶', '🎤', '🎧', '🎺', '🎷', '🎸', '🎻'][Math.floor(Math.random() * 10)],
      streamUrl: Math.random() > 0.5 ? 'https://example.com/stream' : '',
      isVisible: Math.random() > 0.3, // 70% chance of being visible
    });

    // Random concert data for each locale
    const concertTemplates = {
      en: [
        {
          title: "Symphony of the Stars",
          venue: "Grand Concert Hall",
          performer: "Dr. Sarah Johnson",
          description: "An evening of classical masterpieces performed by world-renowned musicians in an intimate setting.",
          venueDetails: "Historic venue with exceptional acoustics and elegant architecture."
        },
        {
          title: "Jazz Under the Moon",
          venue: "Blue Note Lounge",
          performer: "The Midnight Quartet",
          description: "Experience the magic of jazz in an intimate setting with our resident quartet.",
          venueDetails: "Cozy underground venue with dim lighting and vintage decor."
        },
        {
          title: "Chamber Music Evening",
          venue: "St. Cecilia's Chapel",
          performer: "Ensemble Aurora",
          description: "A refined evening of chamber music featuring works by Mozart, Beethoven, and contemporary composers.",
          venueDetails: "Sacred space with natural acoustics and beautiful stained glass windows."
        }
      ],
      sl: [
        {
          title: "Simfonija zvezd",
          venue: "Velika koncertna dvorana",
          performer: "Dr. Sarah Johnson",
          description: "Večer klasičnih mojstrovin, ki jih izvajajo svetovno priznani glasbeniki v intimnem okolju.",
          venueDetails: "Zgodovinski prostor z izjemno akustiko in elegantno arhitekturo."
        },
        {
          title: "Jazz pod mesecem",
          venue: "Blue Note Lounge",
          performer: "The Midnight Quartet",
          description: "Doživite čarovnijo jazza v intimnem okolju z našim rezidenčnim kvartetom.",
          venueDetails: "Udobno podzemno mesto z prigušenim osvetlitvijo in vintage dekorjem."
        },
        {
          title: "Večer komorne glasbe",
          venue: "Kapela sv. Cecilije",
          performer: "Ensemble Aurora",
          description: "Rafiniran večer komorne glasbe z deli Mozarta, Beethovna in sodobnih skladateljev.",
          venueDetails: "Svet prostor z naravno akustiko in lepimi vitražnimi okni."
        }
      ],
      it: [
        {
          title: "Sinfonia delle Stelle",
          venue: "Gran Sala da Concerto",
          performer: "Dr. Sarah Johnson",
          description: "Una serata di capolavori classici eseguiti da musicisti di fama mondiale in un ambiente intimo.",
          venueDetails: "Spazio storico con acustica eccezionale e architettura elegante."
        },
        {
          title: "Jazz Sotto la Luna",
          venue: "Blue Note Lounge",
          performer: "The Midnight Quartet",
          description: "Vivi la magia del jazz in un ambiente intimo con il nostro quartetto residente.",
          venueDetails: "Locale sotterraneo accogliente con illuminazione soffusa e arredamento vintage."
        },
        {
          title: "Serata di Musica da Camera",
          venue: "Cappella di Santa Cecilia",
          performer: "Ensemble Aurora",
          description: "Una serata raffinata di musica da camera con opere di Mozart, Beethoven e compositori contemporanei.",
          venueDetails: "Spazio sacro con acustica naturale e belle vetrate colorate."
        }
      ]
    };

    const programTemplates = {
      en: [
        { title: "Prelude in C Major", composer: "J.S. Bach", duration: "3:45" },
        { title: "Sonata No. 14 'Moonlight'", composer: "L. van Beethoven", duration: "15:30" },
        { title: "Intermezzo", composer: "J. Brahms", duration: "4:20" },
        { title: "Nocturne in E-flat Major", composer: "F. Chopin", duration: "6:15" },
        { title: "Intermission", composer: "", duration: "15:00" },
        { title: "Rhapsody in Blue", composer: "G. Gershwin", duration: "12:45" },
        { title: "Clair de Lune", composer: "C. Debussy", duration: "5:30" }
      ],
      sl: [
        { title: "Predigra v C-duru", composer: "J.S. Bach", duration: "3:45" },
        { title: "Sonata št. 14 'Mesečina'", composer: "L. van Beethoven", duration: "15:30" },
        { title: "Intermezzo", composer: "J. Brahms", duration: "4:20" },
        { title: "Nokturno v Es-duru", composer: "F. Chopin", duration: "6:15" },
        { title: "Odmor", composer: "", duration: "15:00" },
        { title: "Rapsodija v modrem", composer: "G. Gershwin", duration: "12:45" },
        { title: "Mesečina", composer: "C. Debussy", duration: "5:30" }
      ],
      it: [
        { title: "Preludio in Do Maggiore", composer: "J.S. Bach", duration: "3:45" },
        { title: "Sonata n. 14 'Chiaro di Luna'", composer: "L. van Beethoven", duration: "15:30" },
        { title: "Intermezzo", composer: "J. Brahms", duration: "4:20" },
        { title: "Notturno in Mi bemolle Maggiore", composer: "F. Chopin", duration: "6:15" },
        { title: "Intervallo", composer: "", duration: "15:00" },
        { title: "Rapsodia in Blu", composer: "G. Gershwin", duration: "12:45" },
        { title: "Chiaro di Luna", composer: "C. Debussy", duration: "5:30" }
      ]
    };

    // Select random template for each locale
    locales.forEach(locale => {
      const randomTemplate = concertTemplates[locale as keyof typeof concertTemplates][Math.floor(Math.random() * concertTemplates[locale as keyof typeof concertTemplates].length)];
      const randomProgram = programTemplates[locale as keyof typeof programTemplates];
      
      setTranslations(prev => ({
        ...prev,
        [locale]: { ...randomTemplate }
      }));
      
      setProgram(prev => ({
        ...prev,
        [locale]: randomProgram.map(piece => ({ ...piece }))
      }));
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
        image: basicData.image,
        streamUrl: basicData.streamUrl,
        isVisible: basicData.isVisible,
        translations: Object.entries(translations).map(([locale, translation]) => ({
          locale,
          ...translation
        })),
        program: Object.entries(program).map(([locale, pieces]) => ({
          locale,
          pieces: pieces.filter(piece => piece.title.trim() !== '')
        }))
      };


      const url = concert ? `/api/concerts/${concert.id}` : '/api/concerts';
      const method = concert ? 'PUT' : 'POST';

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
      
      if (concert) {
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
        <div className="flex justify-between items-center mb-4">
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
                image: ['🎹', '🎵', '🎼', '🎶', '🎤', '🎧', '🎺', '🎷', '🎸', '🎻'][Math.floor(Math.random() * 10)],
                streamUrl: Math.random() > 0.5 ? 'https://example.com/stream' : '',
                isVisible: Math.random() > 0.3, // 70% chance of being visible
              });
            }}
            className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded text-sm"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-600 dark:border-gray-500 dark:text-white"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-600 dark:border-gray-500 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('image')}
            </label>
            <input
              type="text"
              name="image"
              value={basicData.image}
              onChange={handleBasicDataChange}
              placeholder="🎹"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-600 dark:border-gray-500 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('streamUrl')}
            </label>
            <input
              type="url"
              name="streamUrl"
              value={basicData.streamUrl}
              onChange={handleBasicDataChange}
              placeholder="https://example.com/stream"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-600 dark:border-gray-500 dark:text-white"
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
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
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
              className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded text-sm"
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
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('performer')} *
                    </label>
                    <input
                      type="text"
                      value={translations[loc].performer}
                      onChange={(e) => handleTranslationChange(loc, 'performer', e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('description')} *
                  </label>
                  <textarea
                    value={translations[loc].description}
                    onChange={(e) => handleTranslationChange(loc, 'description', e.target.value)}
                    required
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('venueDetails')}
                  </label>
                  <textarea
                    value={translations[loc].venueDetails}
                    onChange={(e) => handleTranslationChange(loc, 'venueDetails', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                {/* Program Section */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-md font-semibold text-gray-900 dark:text-white">{t('program')}</h4>
                    <button
                      type="button"
                      onClick={() => addProgramPiece(loc)}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                    >
                      + {t('addPiece')}
                    </button>
                  </div>

                  <div className="space-y-4">
                    {program[loc].map((piece, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('title')}
                          </label>
                          <input
                            type="text"
                            value={piece.title}
                            onChange={(e) => handleProgramChange(loc, index, 'title', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('composer')}
                          </label>
                          <input
                            type="text"
                            value={piece.composer}
                            onChange={(e) => handleProgramChange(loc, index, 'composer', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('duration')}
                          </label>
                          <input
                            type="text"
                            value={piece.duration}
                            onChange={(e) => handleProgramChange(loc, index, 'duration', e.target.value)}
                            placeholder="e.g., 5:30"
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => removeProgramPiece(loc, index)}
                            disabled={program[loc].length === 1}
                            className="bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-3 py-2 rounded text-sm"
                          >
                            {t('removePiece')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-600">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
        >
          {t('cancel')}
        </button>
        <button
          type="submit"
          disabled={loading || (concert ? !hasChanges() : false)}
          className={`px-6 py-2 rounded-lg transition-colors duration-200 ${
            loading || (concert ? !hasChanges() : false)
              ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {loading ? t('saving') : (concert ? t('updateConcert') : t('createConcert'))}
        </button>
      </div>
    </form>
  );
}