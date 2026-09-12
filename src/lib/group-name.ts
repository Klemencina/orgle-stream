type GroupName = { name: string; nameEn?: string | null; nameIt?: string | null }

export function getGroupName(group: GroupName, locale: string): string {
  const translated = locale === 'en' ? group.nameEn : locale === 'it' ? group.nameIt : group.name
  return translated?.trim() || group.name
}
