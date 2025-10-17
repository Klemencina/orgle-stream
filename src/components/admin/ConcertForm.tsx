'use client';

import { useState, useEffect, useRef } from 'react';
import { LocalizedConcert } from '@/types/concert';
import { locales } from '@/i18n';
import { useTranslations } from 'next-intl';
import ImageUpload from '@/components/ui/ImageUpload';

// Slovenian date formatting utilities
const formatDateForDisplay = (isoDate: string): string => {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

const formatDateForStorage = (displayDate: string): string => {
  if (!displayDate) return '';
  const [day, month, year] = displayDate.split('.');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

const formatTimeForDisplay = (isoDate: string): string => {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

interface ConcertFormProps {
  concert?: LocalizedConcert | null;
  onConcertCreated: (concert: LocalizedConcert) => void;
  onConcertUpdated: (concert: LocalizedConcert) => void;
  onCancel: () => void;
  locale: string;
}

interface Performer {
  name: string;
  img: string;
  fileName?: string;
  selectedFile?: File | null;
  opis: string;
}

interface ProgramPiece {
  title: string;
  composer: string;
  subtitles?: string[];
}

interface TranslationData {
  title: string;
  subtitle?: string;
  venue: string;
  description: string;
  performers?: Performer[];
}

const localeNames = {
  en: 'English',
  sl: 'Slovenščina',
  it: 'Italiano'
};

const defaultVenues = {
  en: 'Cathedral Church of the Assumption of the Virgin Mary, Koper',
  sl: 'Stolna cerkev Marijinega vnebovzetja, Koper',
  it: 'Chiesa Cattedrale dell\'Assunzione della Vergine Maria, Capodistria'
};

const getDefaultVenue = (locale: string): string => {
  return defaultVenues[locale as keyof typeof defaultVenues] || '';
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
    stripeProductId: '',
    stripePriceId: '',
  });

  // Translatable fields for each locale
  const [translations, setTranslations] = useState<Record<string, TranslationData>>({
    en: { title: '', subtitle: '', venue: '', description: '', performers: [] },
    sl: { title: '', subtitle: '', venue: '', description: '', performers: [] },
    it: { title: '', subtitle: '', venue: '', description: '', performers: [] }
  });

  // Program pieces: only two versions, Slovenian and Original
  const [program, setProgram] = useState<Record<string, ProgramPiece[]>>({
    sl: [{ title: '', composer: '', subtitles: [] }],
    original: [{ title: '', composer: '', subtitles: [] }]
  });

  // Track images that need to be deleted from R2
  const [imagesToDelete, setImagesToDelete] = useState<Set<string>>(new Set());

  // Track selected files that need to be uploaded
  const [selectedFiles, setSelectedFiles] = useState<Map<string, File>>(new Map());

  const [activeTab, setActiveTab] = useState('en');
  const [programActiveTab, setProgramActiveTab] = useState<'sl' | 'original'>('sl');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Deduplicate subtitle add/remove operations under React StrictMode
  const subtitleOpIdRef = useRef<string | null>(null);

  // Store original data for change detection
  const [originalData, setOriginalData] = useState<{
    basicData: typeof basicData;
    translations: typeof translations;
    program: typeof program;
  } | null>(null);


  // Function to check if there are any changes
  const hasChanges = (): boolean => {
    if (!concert || !originalData) return true; // New concert always has changes

    // Check basic data changes
    const basicDataChanged = JSON.stringify(basicData) !== JSON.stringify(originalData.basicData);
    if (basicDataChanged) return true;

    // Check program changes
    const programChanged = JSON.stringify(program) !== JSON.stringify(originalData.program);
    if (programChanged) return true;

    // Check if there are any selected files (new images to upload)
    if (selectedFiles.size > 0) {
      return true;
    }

    // Check translations changes
    const translationsChanged = Object.entries(translations).some(([locale, translation]) => {
      const originalTranslation = originalData.translations[locale];

      if (!originalTranslation) return true;

      // Compare basic fields
      if (translation.title !== originalTranslation.title) return true;
      if (translation.subtitle !== originalTranslation.subtitle) return true;
      if (translation.venue !== originalTranslation.venue) return true;
      if (translation.description !== originalTranslation.description) return true;

      // Compare performers
      if (havePerformersChanged(translation.performers, originalTranslation.performers)) {
        return true;
      }

      return false;
    });

    if (translationsChanged) return true;

    return false;
  };


  // Helper function to check if performers have changed (excluding non-serializable fields)
  const havePerformersChanged = (currentPerformers: Performer[] | undefined, originalPerformers: Performer[] | undefined) => {
    if (!currentPerformers && !originalPerformers) return false;
    if (!currentPerformers || !originalPerformers) return true;
    if (currentPerformers.length !== originalPerformers.length) return true;

    return currentPerformers.some((performer, index) => {
      const originalPerformer = originalPerformers[index];

      // Check if there's a selected file for this performer (indicates a new image was selected)
      const hasSelectedFile = selectedFiles.has(`selected-${index}`);

      return performer.name !== originalPerformer.name ||
             performer.img !== originalPerformer.img ||
             performer.opis !== originalPerformer.opis ||
             hasSelectedFile; // If there's a selected file, it's a change
    });
  };

  useEffect(() => {
    // Clear images to delete and selected files when concert changes or component mounts
    setImagesToDelete(new Set());
    setSelectedFiles(new Map());

    if (concert) {
      setBasicData({
        date: formatDateForDisplay(concert.date),
        time: formatTimeForDisplay(concert.date),
        isVisible: concert.isVisible !== false, // Default to true if not set
        stripeProductId: (concert as Partial<LocalizedConcert> & { stripeProductId?: string }).stripeProductId || '',
        stripePriceId: (concert as Partial<LocalizedConcert> & { stripePriceId?: string }).stripePriceId || '',
      });

      // For new concerts, just populate current locale
      if (!concert.id) {
        setTranslations(prev => ({
          ...prev,
          [locale]: {
            title: concert.title,
            subtitle: concert.subtitle || '',
            venue: concert.venue || getDefaultVenue(locale),
            description: concert.description,
            performers: (concert.performers || []).map(performer => ({
              ...performer,
              selectedFile: null // Initialize selectedFile as null
            }))
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
        setOriginalData({
          basicData: {
            date: formatDateForDisplay(concert.date),
            time: formatTimeForDisplay(concert.date),
            isVisible: concert.isVisible !== false,
            stripeProductId: (concert as Partial<LocalizedConcert> & { stripeProductId?: string }).stripeProductId || '',
            stripePriceId: (concert as Partial<LocalizedConcert> & { stripePriceId?: string }).stripePriceId || '',
          },
          translations: {
            ...translations,
            [locale]: {
              title: concert.title,
              subtitle: concert.subtitle || '',
              venue: concert.venue || getDefaultVenue(locale),
              description: concert.description,
              performers: (concert.performers || []).map(performer => ({
                ...performer,
                selectedFile: null // Initialize selectedFile as null
              }))
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
      } else {
        // For existing concerts, fetch data but don't set originalData yet
        fetchAllTranslations(concert.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concert, locale]);

  const fetchAllTranslations = async (concertId: string) => {
    try {
      const response = await fetch(`/api/concerts/${concertId}?allTranslations=true&admin=true`);
      if (!response.ok) {
        throw new Error(t('failedToFetch'));
      }
      const data = await response.json();
      
      // Populate Stripe fields if present
      setBasicData(prev => ({
        ...prev,
        stripeProductId: data.stripeProductId || '',
        stripePriceId: data.stripePriceId || '',
      }));

      // Populate all translations for i18n locales
      const newTranslations: Record<string, TranslationData> = {};
      locales.forEach(loc => {
        const translation = data.translations.find((t: { locale: string; title: string; subtitle?: string; venue: string; description: string; performers?: Performer[] }) => t.locale === loc);
        newTranslations[loc] = translation ? {
          title: translation.title,
          subtitle: translation.subtitle || '',
          venue: translation.venue || getDefaultVenue(loc),
          description: translation.description,
          performers: (translation.performers || []).map((performer: Performer) => ({
            ...performer,
            selectedFile: null // Initialize selectedFile as null
          }))
        } : { title: '', subtitle: '', venue: getDefaultVenue(loc), description: '', performers: [] };
      });
      setTranslations(newTranslations);

      // Build program only for 'sl' and 'original'
      const buildProgramFor = (loc: string): ProgramPiece[] => {
        const pieces = (data.program || []).map((piece: { translations: { locale: string; title: string; composer: string; subtitles?: string[] }[] }) => {
          const tr = piece.translations.find((t: { locale: string }) => t.locale === loc);
          return { title: tr?.title || '', composer: tr?.composer || '', subtitles: tr?.subtitles || [] };
        });
        return pieces.length > 0 ? pieces : [{ title: '', composer: '' }];
      };
        setProgram({
          sl: buildProgramFor('sl'),
          original: buildProgramFor('original')
        });


        // Store original data for change detection and track removed images
        if (concert) {
          setOriginalData({
            basicData: {
              date: formatDateForDisplay(concert.date),
              time: formatTimeForDisplay(concert.date),
              isVisible: concert.isVisible !== false,
              stripeProductId: data.stripeProductId || '',
              stripePriceId: data.stripePriceId || '',
            },
            translations: Object.entries(newTranslations).map(([locale, t]) => ({
              locale,
              title: t.title,
              subtitle: t.subtitle || '',
              venue: t.venue,
              description: t.description,
              performers: (t.performers || []).map((performer: Performer) => ({
                ...performer,
                selectedFile: null // Initialize selectedFile as null for original data
              }))
            })).reduce((acc: Record<string, {locale: string; title: string; subtitle?: string; venue: string; description: string; performers: Performer[]}>, curr) => {
              acc[curr.locale] = curr;
              return acc;
            }, {}),
            program: (() => {
              const sl = (data.program || []).map((piece: { translations: { locale: string; title: string; composer: string; subtitles?: string[] }[] }) => {
                const tr = piece.translations.find((t: { locale: string }) => t.locale === 'sl');
                return { title: tr?.title || '', composer: tr?.composer || '', subtitles: tr?.subtitles || [] };
              });
              const original = (data.program || []).map((piece: { translations: { locale: string; title: string; composer: string; subtitles?: string[] }[] }) => {
                const tr = piece.translations.find((t: { locale: string }) => t.locale === 'original');
                return { title: tr?.title || '', composer: tr?.composer || '', subtitles: tr?.subtitles || [] };
              });
              const maxLen = Math.max(sl.length, original.length);
              const pad = (arr: ProgramPiece[]) => arr.concat(Array(Math.max(0, maxLen - arr.length)).fill({ title: '', composer: '', subtitles: [] }));
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
          venue: concert?.venue || getDefaultVenue(locale),
          description: concert?.description || '',
          performers: (concert?.performers || []).map(performer => ({
            ...performer,
            selectedFile: null // Initialize selectedFile as null
          }))
        }
      }));

      // Set originalData for fallback case
      if (concert) {
        setOriginalData({
          basicData: {
            date: formatDateForDisplay(concert.date),
            time: formatTimeForDisplay(concert.date),
            isVisible: concert.isVisible !== false,
            stripeProductId: (concert as Partial<LocalizedConcert> & { stripeProductId?: string }).stripeProductId || '',
            stripePriceId: (concert as Partial<LocalizedConcert> & { stripePriceId?: string }).stripePriceId || '',
          },
          translations: {
            [locale]: {
              title: concert?.title || '',
              subtitle: concert?.subtitle || '',
              venue: concert?.venue || '',
              description: concert?.description || '',
              performers: (concert?.performers || []).map(performer => ({
                ...performer,
                selectedFile: null // Initialize selectedFile as null
              }))
            }
          },
          program: {
            [locale]: concert?.program?.map(piece => ({
              title: piece.title,
              composer: piece.composer,
            })) || []
          },
        });
      }
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

  const handlePerformersChange = (locale: string, performers: Array<{name: string, img: string, fileName?: string, selectedFile?: File | null, opis: string}>) => {
    setTranslations(prev => ({
      ...prev,
      [locale]: {
        ...prev[locale],
        performers
      }
    }));
  };

  const handleImageSelected = (performerIndex: number, file: File) => {
    // Store the selected file (use performer index as key since images are shared across locales)
    const fileKey = `selected-${performerIndex}`;
    setSelectedFiles(prev => new Map([...prev, [fileKey, file]]));

    // Update all locales with the selected file (since images are shared across languages)
    setTranslations(prev => {
      const updatedTranslations: Record<string, TranslationData> = {};

      Object.entries(prev).forEach(([locale, translation]) => {
        const updatedPerformers = [...(translation.performers || [])];
        if (updatedPerformers[performerIndex]) {
          updatedPerformers[performerIndex] = {
            ...updatedPerformers[performerIndex],
            selectedFile: file
          };
        }
        updatedTranslations[locale] = {
          ...translation,
          performers: updatedPerformers
        };
      });

      return updatedTranslations;
    });
  };

  const handleImageRemoved = (performerIndex: number) => {
    // Find the performer across all locales to get the fileName
    let fileNameToDelete = '';
    const performerName = Object.values(translations).find(t =>
      t.performers && t.performers[performerIndex]
    )?.performers?.[performerIndex]?.fileName;

    if (performerName) {
      fileNameToDelete = performerName;
      // Track this image for deletion when concert is updated
      setImagesToDelete(prev => new Set([...prev, fileNameToDelete]));
    }

    // Update all locales to remove the image (since images are shared across languages)
    setTranslations(prev => {
      const updatedTranslations: Record<string, TranslationData> = {};

      Object.entries(prev).forEach(([locale, translation]) => {
        const updatedPerformers = [...(translation.performers || [])];
        if (updatedPerformers[performerIndex]) {
          updatedPerformers[performerIndex] = {
            ...updatedPerformers[performerIndex],
            img: '',
            fileName: '',
            selectedFile: null
          };
        }
        updatedTranslations[locale] = {
          ...translation,
          performers: updatedPerformers
        };
      });

      return updatedTranslations;
    });

    // Clear selected files for this performer across all locales
    setSelectedFiles(prev => {
      const newMap = new Map(prev);
      // Remove any selected files for this performer index
      Array.from(newMap.keys()).forEach(key => {
        if (key.endsWith(`-${performerIndex}`)) {
          newMap.delete(key);
        }
      });
      return newMap;
    });
  };


  const deleteImagesFromR2 = async (fileNames: Set<string>) => {
    const deletePromises = Array.from(fileNames).map(async (fileName) => {
      try {
        const response = await fetch(`/api/upload?fileName=${encodeURIComponent(fileName)}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          console.error(`Failed to delete ${fileName} from R2`);
        }
      } catch (error) {
        console.error(`Error deleting ${fileName} from R2:`, error);
      }
    });

    await Promise.all(deletePromises);
  };

  const uploadFilesToR2 = async (files: Map<string, File>): Promise<Map<string, {url: string, fileName: string}>> => {
    const uploadPromises = Array.from(files.entries()).map(async ([key, file]) => {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Upload failed');
        }

        const data = await response.json();
        return [key, { url: data.url, fileName: data.fileName }];
      } catch (error) {
        console.error(`Error uploading file:`, error);
        throw error;
      }
    });

    const results = await Promise.all(uploadPromises);
    return new Map<string, {url: string, fileName: string}>(results as [string, {url: string, fileName: string}][]);
  };

  const handleProgramChange = (locale: string, index: number, field: keyof ProgramPiece, value: string) => {
    setProgram(prev => {
      const next = { ...prev };
      // Ensure paired index exists in both locales
      const maxLen = Math.max(next.sl.length, next.original.length, index + 1);
      const ensureLen = (arr: ProgramPiece[]) => arr.concat(Array(Math.max(0, maxLen - arr.length)).fill({ title: '', composer: '', subtitles: [] }));
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
      const padTo = (arr: ProgramPiece[], len: number) => arr.concat(Array(Math.max(0, len - arr.length)).fill({ title: '', composer: '', subtitles: [] }));
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
      if (next.sl.length === 0) next.sl = [{ title: '', composer: '', subtitles: [] }];
      if (next.original.length === 0) next.original = [{ title: '', composer: '', subtitles: [] }];
      return next;
    });
  };

  const ensureSubtitleParity = (targetLocale: 'sl' | 'original', pieceIndex: number) => {
    setProgram(prev => {
      const otherLocale = targetLocale === 'sl' ? 'original' : 'sl';
      const next = { ...prev } as Record<'sl' | 'original', ProgramPiece[]>;
      const target = next[targetLocale][pieceIndex] || { title: '', composer: '', subtitles: [] };
      const other = next[otherLocale][pieceIndex] || { title: '', composer: '', subtitles: [] };
      const targetLen = (target.subtitles || []).length;
      const otherLen = (other.subtitles || []).length;
      if (otherLen < targetLen) {
        const pad = Array(targetLen - otherLen).fill('');
        other.subtitles = (other.subtitles || []).concat(pad);
      } else if (targetLen < otherLen) {
        const pad = Array(otherLen - targetLen).fill('');
        target.subtitles = (target.subtitles || []).concat(pad);
      }
      next[targetLocale][pieceIndex] = { ...target };
      next[otherLocale][pieceIndex] = { ...other };
      return next;
    });
  };

  const addSubtitle = (_localeKey: 'sl' | 'original', pieceIndex: number) => {
    if (subtitleOpIdRef.current) return; // dedupe under StrictMode
    subtitleOpIdRef.current = 'add';

    setProgram(prev => {
      const slPieces = [...prev.sl];
      const originalPieces = [...prev.original];

      if (!slPieces[pieceIndex]) slPieces[pieceIndex] = { title: '', composer: '', subtitles: [] };
      if (!originalPieces[pieceIndex]) originalPieces[pieceIndex] = { title: '', composer: '', subtitles: [] };

      const addEmptySubtitle = (piece: ProgramPiece): ProgramPiece => ({
        ...piece,
        subtitles: [...(piece.subtitles || []), '']
      });

      slPieces[pieceIndex] = addEmptySubtitle(slPieces[pieceIndex]);
      originalPieces[pieceIndex] = addEmptySubtitle(originalPieces[pieceIndex]);

      return { sl: slPieces, original: originalPieces };
    });

    setTimeout(() => { subtitleOpIdRef.current = null; }, 0);
  };

  const removeSubtitle = (_localeKey: 'sl' | 'original', pieceIndex: number, subtitleIndex: number) => {
    if (subtitleOpIdRef.current) return; // dedupe under StrictMode
    subtitleOpIdRef.current = 'remove';

    setProgram(prev => {
      const slPieces = [...prev.sl];
      const originalPieces = [...prev.original];

      const updateFor = (pieces: ProgramPiece[]) => {
        const piece = pieces[pieceIndex] || { title: '', composer: '', subtitles: [] };
        const subs = [...(piece.subtitles || [])];
        if (subs[subtitleIndex] !== undefined) subs.splice(subtitleIndex, 1);
        pieces[pieceIndex] = { ...piece, subtitles: subs };
      };

      updateFor(slPieces);
      updateFor(originalPieces);

      return { sl: slPieces, original: originalPieces };
    });

    setTimeout(() => { subtitleOpIdRef.current = null; }, 0);
  };

  const updateSubtitle = (localeKey: 'sl' | 'original', pieceIndex: number, subtitleIndex: number, value: string) => {
    setProgram(prev => {
      const slPieces = [...prev.sl];
      const originalPieces = [...prev.original];

      const pieces = localeKey === 'sl' ? slPieces : originalPieces;
      const piece = pieces[pieceIndex] || { title: '', composer: '', subtitles: [] };
      const subs = [...(piece.subtitles || [])];
      subs[subtitleIndex] = value;
      pieces[pieceIndex] = { ...piece, subtitles: subs };

      return { sl: slPieces, original: originalPieces };
    });
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Upload selected files first
      const uploadResults = await uploadFilesToR2(selectedFiles);

      // Update performers with uploaded image URLs
      const updatedTranslations: Record<string, TranslationData> = {};

      Object.entries(translations).forEach(([locale, translation]) => {
        const updatedPerformers = translation.performers?.map((performer, index) => {
          const fileKey = `selected-${index}`;
          const uploadResult = uploadResults.get(fileKey);

          if (uploadResult) {
            // This performer had a file that was uploaded
            return {
              ...performer,
              img: uploadResult.url,
              fileName: uploadResult.fileName,
              selectedFile: null // Clear the selected file
            };
          } else {
            // This performer didn't have a new file upload
            return performer;
          }
        }) || [];

        updatedTranslations[locale] = {
          ...translation,
          performers: updatedPerformers
        };
      });

      // Combine date and time (convert from Slovenian format to ISO)
      const isoDate = formatDateForStorage(basicData.date);
      const dateTime = new Date(`${isoDate}T${basicData.time}`);

      const concertData = {
        date: dateTime.toISOString(),

        isVisible: basicData.isVisible,
        stripeProductId: basicData.stripeProductId.trim() || null,
        stripePriceId: basicData.stripePriceId.trim() || null,
        translations: Object.entries(updatedTranslations).map(([locale, translation]) => ({
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

      // Delete removed images from R2 after successful update
      if (imagesToDelete.size > 0) {
        await deleteImagesFromR2(imagesToDelete);
        // Clear the images to delete set
        setImagesToDelete(new Set());
      }

      // Clear selected files after successful upload
      setSelectedFiles(new Map());

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
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('date')} *
            </label>
            <input
              type="text"
              name="date"
              value={basicData.date}
              onChange={handleBasicDataChange}
              placeholder="DD.MM.YYYY"
              pattern="^(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[012])\.\d{4}$"
              title="Please enter date in DD.MM.YYYY format"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-600 dark:border-gray-500 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('time')} *
            </label>
            <input
              type="text"
              name="time"
              value={basicData.time}
              onChange={handleBasicDataChange}
              placeholder="HH:MM"
              pattern="^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$"
              title="Please enter time in 24-hour format (HH:MM)"
              maxLength={5}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-600 dark:border-gray-500 dark:text-white"
              onKeyDown={(e) => {
                const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'];
                const isNumber = /^[0-9]$/.test(e.key);
                const isColon = e.key === ':';

                if (!allowedKeys.includes(e.key) && !isNumber && !isColon) {
                  e.preventDefault();
                }

                // Auto-add colon
                const target = e.target as HTMLInputElement;
                if (isNumber && target.value.length === 2 && !target.value.includes(':')) {
                  setTimeout(() => {
                    target.value = target.value + ':';
                    // Trigger change event
                    const event = new Event('input', { bubbles: true });
                    target.dispatchEvent(event);
                  }, 0);
                }
              }}
              onBlur={(e) => {
                const value = e.target.value;
                if (value && !value.includes(':')) {
                  // If user didn't add colon, format it
                  if (value.length === 4) {
                    e.target.value = `${value.slice(0, 2)}:${value.slice(2)}`;
                  } else if (value.length === 3) {
                    e.target.value = `0${value.slice(0, 1)}:${value.slice(1)}`;
                  } else if (value.length === 2) {
                    e.target.value = `${value}:00`;
                  } else if (value.length === 1) {
                    e.target.value = `0${value}:00`;
                  }
                }

                // Ensure proper formatting
                const formattedValue = e.target.value;
                if (formattedValue) {
                  const [hours, minutes] = formattedValue.split(':');
                  const hour24 = parseInt(hours, 10);
                  const min24 = parseInt(minutes || '0', 10);
                  if (hour24 >= 0 && hour24 <= 23 && min24 >= 0 && min24 <= 59) {
                    e.target.value = `${hour24.toString().padStart(2, '0')}:${min24.toString().padStart(2, '0')}`;
                  }
                }
              }}
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

      {/* Stripe Settings */}
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Stripe</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">Link a Stripe Product/Price to make this concert purchasable.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Stripe Product ID
            </label>
            <input
              type="text"
              name="stripeProductId"
              value={basicData.stripeProductId}
              onChange={handleBasicDataChange}
              placeholder="prod_..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-600 dark:border-gray-500 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Stripe Price ID
            </label>
            <input
              type="text"
              name="stripePriceId"
              value={basicData.stripePriceId}
              onChange={handleBasicDataChange}
              placeholder="price_..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-600 dark:border-gray-500 dark:text-white"
              required={false}
            />
          </div>
        </div>
      </div>

      {/* Translation Tabs */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('translations')}</h3>
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
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('performerInfo')}
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Drag performers by the grip icon to reorder them
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newPerformers = [...(translations[loc].performers || [])];
                        newPerformers.push({ name: '', img: '', fileName: '', selectedFile: null, opis: '' });
                        
                        // Add performer to all locales - name and image are shared, but description is locale-specific
                        const allLocales = Object.keys(translations);
                        allLocales.forEach(locale => {
                          const currentPerformers = [...(translations[locale].performers || [])];
                          const newPerformer = { name: '', img: '', fileName: '', selectedFile: null, opis: '' };
                          currentPerformers.push(newPerformer);
                          handlePerformersChange(locale, currentPerformers);
                        });
                      }}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-sm w-full sm:w-auto"
                    >
                      + Add Performer
                    </button>
                  </div>

                  <div className="space-y-3">
                    {(translations[loc].performers || []).map((performer, index) => {
                      // Find the image URL from any locale (since images are shared)
                      const getSharedImageUrl = (performerIndex: number) => {
                        for (const locale of Object.keys(translations)) {
                          const otherPerformer = translations[locale].performers?.[performerIndex];
                          if (otherPerformer?.img) {
                            return otherPerformer.img;
                          }
                        }
                        return performer.img || '';
                      };

                      const sharedImageUrl = getSharedImageUrl(index);

                      return (
                        <div 
                          key={index} 
                          className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg space-y-4"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', index.toString());
                            e.currentTarget.style.opacity = '0.5';
                          }}
                          onDragEnd={(e) => {
                            e.currentTarget.style.opacity = '1';
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.currentTarget.style.borderColor = '#f97316';
                          }}
                          onDragLeave={(e) => {
                            e.currentTarget.style.borderColor = '';
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.style.borderColor = '';
                            const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
                            
                            // Update performers for all locales, preserving locale-specific descriptions
                            const allLocales = Object.keys(translations);
                            allLocales.forEach(locale => {
                              const currentPerformers = [...(translations[locale].performers || [])];
                              const draggedPerformer = currentPerformers[draggedIndex];
                              currentPerformers.splice(draggedIndex, 1);
                              currentPerformers.splice(index, 0, draggedPerformer);
                              handlePerformersChange(locale, currentPerformers);
                            });
                          }}
                        >
                          {/* Header with Drag Handle, Name and Remove button */}
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                              <div className="cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Drag to reorder">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
                                </svg>
                              </div>
                              <h4 className="text-base font-semibold text-gray-900 dark:text-white">Performer #{index + 1}</h4>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newPerformers = (translations[loc].performers || []).filter((_, i) => i !== index);
                                
                                // Remove performer from all locales since they are shared
                                const allLocales = Object.keys(translations);
                                allLocales.forEach(locale => {
                                  handlePerformersChange(locale, newPerformers);
                                });
                              }}
                              className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded text-sm"
                            >
                              Remove Performer
                            </button>
                          </div>

                          {/* Compact vertical layout */}
                          <div className="space-y-4">
                            {/* Name and Image in a compact row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Name
                                </label>
                                <input
                                  type="text"
                                  value={performer.name}
                                  onChange={(e) => {
                                    // Update name across all locales since it's shared
                                    const allLocales = Object.keys(translations);
                                    allLocales.forEach(locale => {
                                      const newPerformers = [...(translations[locale].performers || [])];
                                      if (newPerformers[index]) {
                                        newPerformers[index].name = e.target.value;
                                        handlePerformersChange(locale, newPerformers);
                                      }
                                    });
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                  placeholder="Performer name"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Performer Image
                                </label>
                                <ImageUpload
                                  currentImageUrl={sharedImageUrl}
                                  selectedFile={performer.selectedFile || null}
                                  onImageSelected={(file) => {
                                    handleImageSelected(index, file);
                                  }}
                                  onImageRemoved={() => {
                                    handleImageRemoved(index);
                                  }}
                                  label=""
                                  className="w-full"
                                />
                              </div>
                            </div>

                            {/* Description full width below */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Description
                              </label>
                              <textarea
                                value={performer.opis}
                                onChange={(e) => {
                                  // Update description only for current locale since it's language-specific
                                  const newPerformers = [...(translations[loc].performers || [])];
                                  newPerformers[index].opis = e.target.value;
                                  handlePerformersChange(loc, newPerformers);
                                }}
                                rows={4}
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-vertical min-h-[80px]"
                                placeholder="Detailed biography and description (1-2 paragraphs)"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
              <div className="md:col-span-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Subtitles</span>
                  <button
                    type="button"
                    onClick={() => addSubtitle(programActiveTab, index)}
                    className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
                  >
                    + Add subtitle
                  </button>
                </div>
                <div className="space-y-2">
                  {(piece.subtitles || []).map((sub, sIdx) => (
                    <div key={sIdx} className="flex gap-2">
                      <input
                        type="text"
                        value={sub}
                        onChange={(e) => updateSubtitle(programActiveTab, index, sIdx, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        placeholder={`Subtitle ${sIdx + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeSubtitle(programActiveTab, index, sIdx)}
                        className="bg-red-500 hover:bg-red-600 text-white px-2 rounded"
                        aria-label="Remove subtitle"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
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