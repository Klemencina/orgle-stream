'use client';

import { useTranslations } from 'next-intl';
import { LocalizedConcert } from '@/types/concert';

export default function ConcertGroupBadges({ groups }: Pick<LocalizedConcert, 'groups'>) {
  const t = useTranslations('concertGroups');
  if (!groups?.length) return null;

  return (
    <ul aria-label={t('title')} className="mb-2 space-y-1 whitespace-normal">
      {groups.map(group => (
        <li key={group.id} className="text-xs font-medium text-orange-700 dark:text-orange-400 break-words">
          {group.name}
        </li>
      ))}
    </ul>
  );
}
