import test from 'node:test'
import assert from 'node:assert/strict'
import { getGroupName } from '../src/lib/group-name'
import { parseGroup } from '../src/lib/concert-groups'

test('group names use the requested language and fall back for existing groups', () => {
  const group = { name: 'Jesenski koncerti', nameEn: 'Autumn concerts', nameIt: 'Concerti autunnali' }
  assert.equal(getGroupName(group, 'sl'), group.name)
  assert.equal(getGroupName(group, 'en'), group.nameEn)
  assert.equal(getGroupName(group, 'it'), group.nameIt)
  assert.equal(getGroupName({ name: group.name }, 'en'), group.name)
  assert.equal(getGroupName({ ...group, nameIt: '  ' }, 'it'), group.name)
  assert.equal(getGroupName(group, 'de'), group.name)
})

test('group translations are trimmed, can be cleared, and are validated', () => {
  const input = { name: 'Jesenski koncerti', salesEnabled: false, concertIds: [] }
  const parsed = parseGroup({ ...input, nameEn: ' Autumn concerts ', nameIt: ' ' })
  assert.equal(parsed.nameEn, 'Autumn concerts')
  assert.equal(parsed.nameIt, null)
  assert.equal(Object.hasOwn(parseGroup(input), 'nameEn'), false)
  for (const invalid of [123, {}, [], 'x'.repeat(161)]) {
    assert.throws(() => parseGroup({ ...input, nameEn: invalid }))
    assert.throws(() => parseGroup({ ...input, nameIt: invalid }))
  }
})
