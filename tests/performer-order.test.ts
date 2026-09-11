import assert from 'node:assert/strict';
import test from 'node:test';
import { reorderPerformerData } from '../src/lib/performer-order';

function fixture() {
  const translations = Object.fromEntries(['sl', 'en', 'it'].map(locale => [locale, {
    title: `Concert ${locale}`,
    performers: ['Ana', 'Boris', 'Cene'].map(name => ({ name, opis: `${locale}: ${name}`, img: `${name}.png` })),
  }]));
  const ana = new File(['ana'], 'ana.png');
  const cene = new File(['cene'], 'cene.png');
  const files = new Map([['selected-0', ana], ['selected-2', cene]]);
  return { translations, files, ana, cene };
}

test('removing a performer keeps each language biography and shifts pending uploads', () => {
  const { translations, files, cene } = fixture();
  const result = reorderPerformerData(translations, files, [1, 2]);
  for (const locale of ['sl', 'en', 'it']) {
    assert.deepEqual(result.translations[locale].performers.map(p => p.opis), [`${locale}: Boris`, `${locale}: Cene`]);
    assert.equal(result.translations[locale].title, `Concert ${locale}`);
  }
  assert.deepEqual([...result.files], [['selected-1', cene]]);
  assert.equal(translations.sl.performers.length, 3);
  assert.equal(files.size, 2);
});

test('moving performers keeps uploaded and pending images with their owners in both directions', () => {
  const { translations, files, ana, cene } = fixture();
  const result = reorderPerformerData(translations, files, [2, 0, 1]);
  assert.deepEqual(result.translations.en.performers.map(p => [p.name, p.img]), [['Cene', 'Cene.png'], ['Ana', 'Ana.png'], ['Boris', 'Boris.png']]);
  assert.equal(result.files.get('selected-0'), cene);
  assert.equal(result.files.get('selected-1'), ana);
  const restored = reorderPerformerData(result.translations, result.files, [1, 2, 0]);
  assert.deepEqual(restored.translations, translations);
  assert.deepEqual(restored.files, files);
});

test('removing a row after dragging does not upload its selected image to another performer', () => {
  const { translations, files, ana } = fixture();
  const moved = reorderPerformerData(translations, files, [2, 0, 1]);
  const removed = reorderPerformerData(moved.translations, moved.files, [1, 2]);
  assert.deepEqual([...removed.files], [['selected-0', ana]]);
  assert.deepEqual(removed.translations.it.performers.map(p => p.opis), ['it: Ana', 'it: Boris']);
});

test('missing language rows use shared identity without copying another language biography', () => {
  const { translations, files } = fixture();
  translations.it.performers = [];
  const result = reorderPerformerData(translations, files, [2, 0, 1]);
  assert.deepEqual(result.translations.it.performers.map(p => [p.name, p.opis]), [['Cene', ''], ['Ana', ''], ['Boris', '']]);
  result.translations.en.performers[0].opis = 'Edited biography';
  assert.equal(translations.en.performers[2].opis, 'en: Cene');
});

test('removing all performers clears uploads, and invalid drag indices are rejected', () => {
  const { translations, files } = fixture();
  const result = reorderPerformerData(translations, files, []);
  assert.equal(result.files.size, 0);
  assert.deepEqual(result.translations.sl.performers, []);
  for (const order of [[NaN], [-1], [3], [0, 0], [0.5]]) {
    assert.throws(() => reorderPerformerData(translations, files, order), /Invalid performer order/);
  }
});
