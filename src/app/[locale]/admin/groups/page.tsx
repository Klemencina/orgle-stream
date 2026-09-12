'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { getGroupName } from '@/lib/group-name';
import AdminGuard from '@/components/admin/AdminGuard';

type Group = { id?: string; name: string; nameEn?: string | null; nameIt?: string | null; stripePriceId: string; salesEnabled: boolean; concertIds: string[]; membershipLocked?: boolean };
type Concert = { id: string; title: string; subtitle?: string | null; date: string; isVisible: boolean };
const emptyGroup = (): Group => ({ name: '', nameEn: '', nameIt: '', stripePriceId: '', salesEnabled: false, concertIds: [] });

export default function GroupsPage() {
  return <AdminGuard><Groups /></AdminGuard>;
}

function Groups() {
  const t = useTranslations('concertGroups');
  const locale = useLocale();
  const [groups, setGroups] = useState<Group[]>([]);
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [editing, setEditing] = useState<Group | null>(null);
  const [originalIds, setOriginalIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [futureOnly, setFutureOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/admin/concert-groups?locale=${encodeURIComponent(locale)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error(t('loadError'));
        const data = await response.json();
        if (!controller.signal.aborted) { setGroups(data.groups); setConcerts(data.concerts); }
      })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [locale, attempt, t]);

  function edit(group: Group) {
    setEditing({ ...group, concertIds: [...group.concertIds] });
    setOriginalIds(group.concertIds);
    setQuery(''); setError(''); setSaved(false);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing || saving) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      const response = await fetch('/api/admin/concert-groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('saveError'));
      setEditing(null); setSaved(true); setAttempt(value => value + 1);
    } catch (error) { setError(error instanceof Error ? error.message : t('saveError')); }
    finally { setSaving(false); }
  }

  const now = Date.now();
  const filteredConcerts = concerts.filter(concert =>
    [concert.title, concert.subtitle || ''].some(text => text.toLocaleLowerCase().includes(query.toLocaleLowerCase())) &&
    (!futureOnly || new Date(concert.date).getTime() > now)
  );
  const hiddenSelectedCount = editing
    ? editing.concertIds.filter(id => !filteredConcerts.some(concert => concert.id === id)).length
    : 0;

  const field = 'w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-3';
  const button = 'rounded bg-orange-500 px-4 py-2 text-white disabled:opacity-50';
  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <Link href={`/${locale}/admin`} className="text-orange-600 underline">{t('back')}</Link>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <button className={button} disabled={saving || loading} onClick={() => edit(emptyGroup())}>{t('create')}</button>
      </div>
      <p className="mt-3 text-gray-600 dark:text-gray-300">{t('intro')}</p>
      {error && <div role="alert" className="mt-4 text-red-600"><p>{error}</p>{!editing && <button className="underline" onClick={() => { setError(''); setAttempt(value => value + 1); }}>{t('retry')}</button>}</div>}
      {saved && <p role="status" className="mt-4 text-green-600">{t('saved')}</p>}
      {loading && <p role="status" className="mt-6">{t('loading')}</p>}
      {editing ? (
        <form onSubmit={save} className="mt-6 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <fieldset disabled={saving} className="space-y-5">
            <legend className="mb-4 text-xl font-semibold">{editing.id ? t('edit') : t('create')}</legend>
            <fieldset className="space-y-3">
              <legend className="font-semibold">{t('name')}</legend>
              {([
                ['name', 'Slovenščina'],
                ['nameEn', 'English'],
                ['nameIt', 'Italiano'],
              ] as const).map(([key, label]) => (
                <label key={key} className="block">{label}{key === 'name' && ' *'}
                  <input required={key === 'name'} maxLength={160} value={editing[key] || ''} onChange={e => setEditing({ ...editing, [key]: e.target.value })} className={field} />
                </label>
              ))}
              <p className="text-sm text-gray-600 dark:text-gray-300">{t('nameTranslationsHelp')}</p>
            </fieldset>
            <label className="block">{t('priceId')}<input value={editing.stripePriceId} placeholder="price_..." onChange={e => setEditing({ ...editing, stripePriceId: e.target.value })} className={field} /></label>
            <p className="text-sm text-gray-600 dark:text-gray-300">{t('stripeHelp')} <a href="https://dashboard.stripe.com/products" target="_blank" rel="noreferrer" className="underline">{t('openStripe')}</a></p>
            <fieldset>
              <legend className="font-semibold">{t('concerts', { count: editing.concertIds.length })}</legend>
              <p className="mt-2 text-sm">{t('membershipHelp')}</p>
              {editing.membershipLocked && <p className="mt-2 text-sm text-orange-700 dark:text-orange-300">{t('locked')}</p>}
              <label className="mt-3 block">{t('search')}<input type="search" value={query} onChange={e => setQuery(e.target.value)} className={field} /></label>
              <label className="mt-3 flex items-center gap-3">
                <input type="checkbox" checked={futureOnly} onChange={e => setFutureOnly(e.target.checked)} />
                {t('futureOnly')}
              </label>
              {hiddenSelectedCount > 0 && <p role="status" className="mt-2 text-sm text-gray-600 dark:text-gray-300">{t('hiddenSelected', { count: hiddenSelectedCount })}</p>}
              <div className="mt-3 max-h-80 space-y-2 overflow-auto rounded border border-gray-200 dark:border-gray-700 p-3">
                {filteredConcerts.map(concert => (
                  <label key={concert.id} className="flex items-start gap-3 rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-700">
                    <input type="checkbox" className="mt-1" checked={editing.concertIds.includes(concert.id)} disabled={editing.membershipLocked && originalIds.includes(concert.id)} onChange={e => setEditing({ ...editing, concertIds: e.target.checked ? [...editing.concertIds, concert.id] : editing.concertIds.filter(id => id !== concert.id) })} />
                    <span className="min-w-0 break-words">
                      {concert.title}
                      {concert.subtitle?.trim() && <span className="block text-sm italic text-gray-600 dark:text-gray-300">{concert.subtitle}</span>}
                      <span className="block text-sm text-gray-600 dark:text-gray-300">{new Date(concert.date).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Ljubljana' })}{!concert.isVisible && ` · ${t('hidden')}`}</span>
                    </span>
                  </label>
                ))}
                {!filteredConcerts.length && <p>{t(concerts.length ? 'noMatches' : 'noConcerts')}</p>}
              </div>
            </fieldset>
            <label className="flex items-center gap-3"><input type="checkbox" checked={editing.salesEnabled} onChange={e => setEditing({ ...editing, salesEnabled: e.target.checked })} />{t('salesEnabled')}</label>
            <p className="text-sm">{t('salesHelp')}</p>
            <div className="flex gap-4"><button type="submit" className={button}>{t(saving ? 'saving' : 'save')}</button><button type="button" onClick={() => setEditing(null)} className="px-4 py-2 underline">{t('cancel')}</button></div>
          </fieldset>
        </form>
      ) : !loading && (
        <div className="mt-6 space-y-4">
          {!groups.length && <p>{t('empty')}</p>}
          {groups.map(group => <article key={group.id} className="rounded-xl border border-gray-300 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold">{getGroupName(group, locale)}</h2><button className={button} onClick={() => edit(group)}>{t('edit')}</button></div>
            <p className="mt-2">{t(group.salesEnabled ? 'onSale' : 'offSale')} · {t('concerts', { count: group.concertIds.length })}</p>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm">
              {concerts.filter(c => group.concertIds.includes(c.id)).map(c => (
                <li key={c.id} className="break-words">
                  {c.title}{!c.isVisible && ` · ${t('hidden')}`}
                  {c.subtitle?.trim() && <span className="ml-4 block text-xs italic text-gray-600 dark:text-gray-300">{c.subtitle}</span>}
                </li>
              ))}
            </ul>
          </article>)}
        </div>
      )}
    </main>
  );
}
