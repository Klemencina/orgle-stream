'use client';

import { useState, useEffect, useRef } from 'react';
import { LocalizedConcert } from '@/types/concert';
import { locales } from '@/i18n';
import { useTranslations } from 'next-intl';
import ImageUpload from '@/components/ui/ImageUpload';
import { reorderPerformerData } from '@/lib/performer-order';

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

const defaultTitles = {
  en: 'Organ concert',
  sl: 'Orgelski koncert',
  it: "Concerto d'organo"
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

  const [activeTab, setActiveTab] = useState(locales.includes(locale as typeof locales[number]) ? locale : 'sl');
  const [editorSection, setEditorSection] = useState<'details' | 'performers' | 'program' | 'tickets'>('details');
  const [programActiveTab, setProgramActiveTab] = useState<'sl' | 'original'>('sl');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [detailsLoaded, setDetailsLoaded] = useState(!isEditing);

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

  const unsavedChanges = touched && hasChanges();
  useEffect(() => {
    if (!unsavedChanges) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const warnBeforeNavigation = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || link.hasAttribute('download') || link.href === window.location.href || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (!window.confirm(t('discardChanges'))) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    document.addEventListener('click', warnBeforeNavigation, true);
    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload);
      document.removeEventListener('click', warnBeforeNavigation, true);
    };
  }, [unsavedChanges, t]);

  useEffect(() => {
    // Clear images to delete and selected files when concert changes or component mounts
    setImagesToDelete(new Set());
    setSelectedFiles(new Map());
    setTouched(false);
    setDetailsLoaded(!isEditing);

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
            program: { sl: buildProgramFor('sl'), original: buildProgramFor('original') }
          });
        }
      setDetailsLoaded(true);
    } catch (error) {
      console.error('Error fetching all translations:', error);
      setError(t('loadAllDetailsFailed'));
      setDetailsLoaded(false);
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
    setTouched(true);
    setTranslations(prev => ({
      ...prev,
      [locale]: {
        ...prev[locale],
        performers
      }
    }));
  };

  const getPerformerOrder = () => Array.from({
    length: Math.max(0, ...Object.values(translations).map(t => t.performers?.length || 0)),
  }, (_, index) => index);

  const applyPerformerOrder = (order: number[]) => {
    if (loading || !detailsLoaded) return;
    const next = reorderPerformerData<TranslationData, Performer>(translations, selectedFiles, order);
    setTranslations(next.translations);
    setSelectedFiles(next.files);
    setTouched(true);
  };

  const handleImageSelected = (performerIndex: number, file: File) => {
    if (loading || !detailsLoaded) return;
    setTouched(true);
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
    if (loading || !detailsLoaded) return;
    setTouched(true);
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
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || (response.status === 413
            ? 'The image is too large for the server. Try a smaller image.'
            : `Image upload failed (${response.status}). Please try again.`));
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

  const moveProgramPiece = (index: number, direction: -1 | 1) => {
    setTouched(true);
    setProgram(prev => {
      const target = index + direction;
      if (target < 0 || target >= prev.sl.length || target >= prev.original.length) return prev;
      return Object.fromEntries(Object.entries(prev).map(([locale, pieces]) => {
        const next = [...pieces];
        [next[index], next[target]] = [next[target], next[index]];
        return [locale, next];
      }));
    });
  };

  const addProgramPiece = () => {
    setTouched(true);
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
    setTouched(true);
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

  const addSubtitle = (_localeKey: 'sl' | 'original', pieceIndex: number) => {
    setTouched(true);
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
    setTouched(true);
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
    if (!detailsLoaded || loading) return;
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

      setTouched(false);
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
    <form noValidate onSubmit={(event) => {
      event.preventDefault();
      const invalid = Array.from(event.currentTarget.elements).find(element =>
        (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) && element.willValidate && !element.validity.valid
      ) as HTMLInputElement | HTMLTextAreaElement | undefined;
      if (invalid) {
        const section = invalid.closest<HTMLElement>('[data-editor-section]')?.dataset.editorSection;
        const language = invalid.closest<HTMLElement>('[data-editor-locale]')?.dataset.editorLocale;
        if (section) setEditorSection(section as typeof editorSection);
        if (language) setActiveTab(language);
        requestAnimationFrame(() => { invalid.focus(); invalid.reportValidity(); });
        return;
      }
      void handleSubmit(event);
    }} onChangeCapture={() => setTouched(true)} className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-700 dark:bg-gray-800">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('editorHelp')}</p>
        <nav aria-label={t('editorSections')} className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(['details', 'performers', 'program', 'tickets'] as const).map((section, index) => (
            <button key={section} type="button" aria-current={editorSection === section ? 'step' : undefined}
              onClick={() => setEditorSection(section)}
              className={`rounded-lg border px-3 py-3 text-left text-sm font-medium transition-colors ${editorSection === section ? 'border-orange-500 bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200' : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'}`}>
              <span className="mr-2 opacity-60">{index + 1}.</span>{t(`section_${section}`)}
            </button>
          ))}
        </nav>
      </div>
      {error && (
        <div role="alert" className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
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

      <fieldset disabled={loading || !detailsLoaded} className="space-y-6">
      {/* Basic Information (Non-translatable) */}
      <div hidden={editorSection !== 'details'} data-editor-section="details" className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('basicInfo')}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="concert-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('date')} *
            </label>
            <input
              id="concert-date"
              type="date"
              name="date"
              value={basicData.date ? formatDateForStorage(basicData.date) : ''}
              onChange={(e) => {
                const [year, month, day] = e.target.value.split('-');
                setBasicData(prev => ({ ...prev, date: year && month && day ? `${day}.${month}.${year}` : '' }));
              }}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-600 dark:border-gray-500 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="concert-time" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('time')} *
            </label>
            <input
              id="concert-time"
              type="time"
              name="time"
              value={basicData.time}
              onChange={handleBasicDataChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-500 dark:text-white"
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
      <div hidden={editorSection !== 'tickets'} data-editor-section="tickets" className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('section_tickets')}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('ticketSetupHelp')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="stripe-product" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Stripe Product ID
            </label>
            <input
              type="text"
              id="stripe-product"
              name="stripeProductId"
              value={basicData.stripeProductId}
              onChange={handleBasicDataChange}
              placeholder="prod_..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-600 dark:border-gray-500 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="stripe-price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Stripe Price ID
            </label>
            <input
              type="text"
              id="stripe-price"
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
      <div hidden={editorSection !== 'details' && editorSection !== 'performers'} className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{editorSection === 'performers' ? t('section_performers') : t('translations')}</h3>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-600">
          <nav aria-label={t('translations')} className="-mb-px flex gap-4 overflow-x-auto">
            {locales.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setActiveTab(loc)}
                aria-pressed={activeTab === loc}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === loc
                    ? 'border-orange-500 text-orange-500 dark:text-orange-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {localeNames[loc as keyof typeof localeNames]}
                <span className="block text-xs font-normal mt-1">
                  {editorSection === 'performers'
                    ? getPerformerOrder().length > 0
                      ? t('biographyProgress', {
                          filled: (translations[loc].performers || []).filter(performer => performer.opis.trim()).length,
                          total: getPerformerOrder().length,
                        })
                      : t('noPerformersShort')
                    : translations[loc].title.trim() && translations[loc].venue.trim()
                      ? t('detailsComplete')
                      : t('detailsMissing')}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {locales.map((loc) => (
            <div key={loc} data-editor-locale={loc} className={activeTab === loc ? 'block' : 'hidden'}>
              <div className="space-y-6">
                {/* Basic Translation Fields */}
                <div hidden={editorSection !== 'details'} data-editor-section="details" className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor={`concert-title-${loc}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('title')} *
                    </label>
                    <input
                      type="text"
                      id={`concert-title-${loc}`}
                      list={`concert-title-options-${loc}`}
                    aria-label={`${t('title')} (${localeNames[loc as keyof typeof localeNames]})`}
                    value={translations[loc].title}
                      onChange={(e) => handleTranslationChange(loc, 'title', e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <datalist id={`concert-title-options-${loc}`}>
                      <option value={defaultTitles[loc]} />
                    </datalist>
                    <button
                      type="button"
                      onClick={() => { handleTranslationChange(loc, 'title', defaultTitles[loc]); setTouched(true); }}
                      className="mt-2 text-sm text-orange-600 hover:underline dark:text-orange-400"
                    >
                      {t('useOrganConcert')}
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('concertSubtitle')}
                    </label>
                    <input
                      type="text"
                      aria-label={t('concertSubtitle')}
                    value={translations[loc].subtitle || ''}
                      onChange={(e) => handleTranslationChange(loc, 'subtitle', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor={`concert-venue-${loc}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('venue')} *
                  </label>
                  <input
                    type="text"
                    id={`concert-venue-${loc}`}
                    aria-label={`${t('venue')} (${localeNames[loc as keyof typeof localeNames]})`}
                    value={translations[loc].venue}
                    onChange={(e) => handleTranslationChange(loc, 'venue', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                  <button type="button" onClick={() => { handleTranslationChange(loc, 'venue', getDefaultVenue(loc)); setTouched(true); }} className="mt-2 text-sm text-orange-600 hover:underline dark:text-orange-400">{t('useCathedral')}</button>
                </div>

                <div>
                  <label htmlFor={`concert-description-${loc}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('description')}
                  </label>
                  <textarea
                    id={`concert-description-${loc}`}
                    aria-label={`${t('description')} (${localeNames[loc as keyof typeof localeNames]})`}
                    value={translations[loc].description}
                    onChange={(e) => handleTranslationChange(loc, 'description', e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                </div>
                {/* Performers Section */}
                <div hidden={editorSection !== 'performers'} data-editor-section="performers">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('performerInfo')}
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t('performerHelp')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
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
                      + {t('addPerformer')}
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
                            const source = e.dataTransfer.getData('application/x-concert-performer');
                            if (!source) return;
                            const draggedIndex = Number(source);
                            const order = getPerformerOrder();
                            if (!Number.isInteger(draggedIndex) || draggedIndex < 0 || draggedIndex >= order.length) return;
                            order.splice(index, 0, order.splice(draggedIndex, 1)[0]);
                            applyPerformerOrder(order);
                          }}
                        >
                          {/* Header with Drag Handle, Name and Remove button */}
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                              <div draggable onDragStart={(event) => event.dataTransfer.setData('application/x-concert-performer', index.toString())} className="cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title={t('dragToReorder')}>
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
                                </svg>
                              </div>
                              <h4 className="text-base font-semibold text-gray-900 dark:text-white">{performer.name || `${t('performer')} ${index + 1}`}</h4>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {([-1, 1] as const).map(direction => (
                                <button key={direction} type="button" aria-label={t(direction === -1 ? 'moveUp' : 'moveDown')}
                                  disabled={index + direction < 0 || index + direction >= getPerformerOrder().length}
                                  onClick={() => {
                                    const order = getPerformerOrder();
                                    [order[index], order[index + direction]] = [order[index + direction], order[index]];
                                    applyPerformerOrder(order);
                                  }} className="rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-30 dark:border-gray-600">{direction === -1 ? '↑' : '↓'}</button>
                              ))}
                            <button
                              type="button"
                              onClick={() => {
                                applyPerformerOrder(getPerformerOrder().filter(i => i !== index));
                              }}
                              className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded text-sm"
                            >
                              {t('removePerformer')}
                            </button>
                            </div>
                          </div>

                          {/* Compact vertical layout */}
                          <div className="space-y-4">
                            {/* Name and Image in a compact row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  {t('performerName')}
                                </label>
                                <input
                                  type="text"
                                  id={`performer-name-${loc}-${index}`}
                                  aria-label={t('performerName')}
                                  value={performer.name}
                                  onChange={(e) => {
                                    // Update name across all locales since it's shared
                                    const allLocales = Object.keys(translations);
                                    allLocales.forEach(locale => {
                                      const newPerformers = [...(translations[locale].performers || [])];
                                      if (newPerformers[index]) {
                                        newPerformers[index] = { ...newPerformers[index], name: e.target.value };
                                        handlePerformersChange(locale, newPerformers);
                                      }
                                    });
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                  placeholder={t('performerName')}
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  {t('performerImage')}
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
                                {t('biography')}
                              </label>
                              <textarea
                                aria-label={`${t('biography')} (${localeNames[loc as keyof typeof localeNames]})`}
                                value={performer.opis}
                                onChange={(e) => {
                                  // Update description only for current locale since it's language-specific
                                  const newPerformers = [...(translations[loc].performers || [])];
                                  newPerformers[index] = { ...newPerformers[index], opis: e.target.value };
                                  handlePerformersChange(loc, newPerformers);
                                }}
                                rows={4}
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-vertical min-h-[80px]"
                                placeholder={t('biographyHelp')}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {(translations[loc].performers || []).length === 0 && (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        {t('noPerformers')}
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
      <div hidden={editorSection !== 'program'} data-editor-section="program" className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 dark:border-gray-700 dark:bg-gray-800">
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
              <div className="md:col-span-3 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-gray-500">{t('programEntry')} {index + 1}</span>
                <div className="flex gap-2">
                  {([-1, 1] as const).map(direction => (
                    <button key={direction} type="button" aria-label={t(direction === -1 ? 'moveUp' : 'moveDown')}
                      disabled={index + direction < 0 || index + direction >= program[programActiveTab].length}
                      onClick={() => moveProgramPiece(index, direction)} className="rounded border border-gray-300 px-3 py-1 disabled:opacity-30 dark:border-gray-600">{direction === -1 ? '↑' : '↓'}</button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <label htmlFor={`program-title-${programActiveTab}-${index}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('programTitles')}
                </label>
                <textarea
                  id={`program-title-${programActiveTab}-${index}`}
                  rows={3}
                  aria-describedby={`program-title-help-${programActiveTab}-${index}`}
                  value={piece.title}
                  onChange={(e) => handleProgramChange(programActiveTab, index, 'title', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <p id={`program-title-help-${programActiveTab}-${index}`} className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t('programTitlesHelp')}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('composer')}
                </label>
                <input
                  type="text"
                  aria-label={t('composer')}
                  value={piece.composer}
                  onChange={(e) => handleProgramChange(programActiveTab, index, 'composer', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div className="md:col-span-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => removeProgramPiece(programActiveTab, index)}
                  disabled={program[programActiveTab].length === 1}
                  className="bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-3 py-2 rounded text-sm"
                >
                  {t('removePiece')}
                </button>
              </div>
              <details open={(piece.subtitles || []).length > 0 || undefined} className="md:col-span-3">
                <summary className="cursor-pointer text-sm text-gray-500 mb-3">{t('subtitlesOptional')}</summary>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('subtitles')}</span>
                  <button
                    type="button"
                    onClick={() => addSubtitle(programActiveTab, index)}
                    className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
                  >
                    + {t('addSubtitle')}
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
                        placeholder={`${t('subtitle')} ${sIdx + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeSubtitle(programActiveTab, index, sIdx)}
                        className="bg-red-500 hover:bg-red-600 text-white px-2 rounded"
                        aria-label={t('removeSubtitle')}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          ))}
        </div>
        <button type="button" onClick={addProgramPiece} className="mt-4 w-full rounded-lg border-2 border-dashed border-orange-300 py-3 text-sm font-medium text-orange-600 hover:bg-orange-50 dark:hover:bg-gray-700">+ {t('addPiece')}</button>
      </div>

      <details open hidden={editorSection !== 'program'} className="rounded-xl border border-orange-200 bg-orange-50/40 p-4 sm:p-6 dark:border-gray-600 dark:bg-gray-800">
        <summary className="cursor-pointer font-medium">{t('programPreview')}</summary>
        <p className="mt-2 text-sm text-gray-500">{programActiveTab === 'sl' ? 'Slovensko' : 'Original'}</p>
        <div className="mt-3 space-y-4">
          {program[programActiveTab].map((piece, index) => (
            <div key={index}>
              <div className="whitespace-pre-line break-words font-medium">{piece.title}</div>
              {(piece.subtitles || []).filter(Boolean).map((subtitle, subtitleIndex) => (
                <div key={subtitleIndex} className="ml-4 text-sm italic text-gray-500">{subtitle}</div>
              ))}
              <div className="text-xs text-gray-600 dark:text-gray-400">{piece.composer}</div>
            </div>
          ))}
        </div>
      </details>

      </fieldset>

      {/* Form Actions */}
      <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur dark:border-gray-600 dark:bg-gray-800/95">
        <span role="status" className="mr-auto text-sm text-gray-500 dark:text-gray-400">{loading ? t('saving') : !detailsLoaded ? t('loadingDetails') : unsavedChanges ? t('unsavedChanges') : t('noUnsavedChanges')}</span>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            if (!unsavedChanges || window.confirm(t('discardChanges'))) onCancel();
          }}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 order-2 sm:order-1"
        >
          {t('cancel')}
        </button>
        <button
          type="submit"
          disabled={loading || !detailsLoaded || (isEditing ? !hasChanges() : false)}
          className={`px-6 py-2 rounded-lg transition-colors duration-200 order-1 sm:order-2 ${
            loading || !detailsLoaded || (isEditing ? !hasChanges() : false)
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
