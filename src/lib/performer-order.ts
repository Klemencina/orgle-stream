// Entries map each new row to its previous index. Use the same order for every locale and upload.
export function reorderPerformerData<T extends { performers?: P[] }, P extends { name: string; img: string; opis: string }>(
  translations: Record<string, T>,
  files: Map<string, File>,
  order: number[],
) {
  const count = Math.max(0, ...Object.values(translations).map(t => t.performers?.length || 0));
  if (new Set(order).size !== order.length || order.some(i => !Number.isInteger(i) || i < 0 || i >= count)) {
    throw new Error('Invalid performer order');
  }
  const nextTranslations = Object.fromEntries(Object.entries(translations).map(([locale, translation]) => [locale, {
    ...translation,
    performers: order.map(index => {
      const performer = translation.performers?.[index];
      if (performer) return { ...performer };
      const shared = Object.values(translations).find(t => t.performers?.[index])!.performers![index];
      return { ...shared, opis: '' };
    }),
  }])) as Record<string, T>;
  const nextFiles = new Map<string, File>();
  order.forEach((oldIndex, newIndex) => {
    const file = files.get(`selected-${oldIndex}`);
    if (file) nextFiles.set(`selected-${newIndex}`, file);
  });
  return { translations: nextTranslations, files: nextFiles };
}
