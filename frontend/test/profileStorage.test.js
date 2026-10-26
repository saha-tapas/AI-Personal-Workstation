import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_PROFILE,
  getProfileInitials,
  loadProfile,
  PROFILE_STORAGE_KEY,
  saveProfile,
} from '../src/features/profile/profileStorage.js'

function createStorage(initial = {}, options = {}) {
  const values = new Map(Object.entries(initial))
  let setCalls = 0

  return {
    getItem(key) {
      if (options.readThrows) throw new Error('read failed')
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      setCalls += 1
      if (options.writeThrows) throw new Error('write failed')
      values.set(key, value)
    },
    removeItem(key) {
      values.delete(key)
    },
    getSetCalls() {
      return setCalls
    },
    get(key) {
      return values.get(key)
    },
  }
}

function useStorage(storage) {
  globalThis.window = { localStorage: storage }
}

test('loads the default profile when storage is missing', () => {
  const storage = createStorage()
  useStorage(storage)

  assert.deepEqual(loadProfile(), DEFAULT_PROFILE)
})

test('loads valid saved profile data', () => {
  const storage = createStorage({ [PROFILE_STORAGE_KEY]: JSON.stringify({ displayName: 'Ada Lovelace' }) })
  useStorage(storage)

  assert.deepEqual(loadProfile(), { displayName: 'Ada Lovelace' })
})

test('falls back safely for malformed and unexpected stored values', () => {
  for (const stored of ['{bad json', 'null', '[]', '"name"', '42', JSON.stringify({ displayName: null }), JSON.stringify({ displayName: '' }), JSON.stringify({ displayName: '   ' })]) {
    useStorage(createStorage({ [PROFILE_STORAGE_KEY]: stored }))
    assert.deepEqual(loadProfile(), DEFAULT_PROFILE, `expected fallback for ${stored}`)
  }
})

test('normalizes leading and trailing whitespace', () => {
  const storage = createStorage()
  useStorage(storage)

  assert.deepEqual(saveProfile({ displayName: '  Ada Lovelace  ' }), { profile: { displayName: 'Ada Lovelace' }, saved: true })
  assert.equal(storage.get(PROFILE_STORAGE_KEY), JSON.stringify({ displayName: 'Ada Lovelace' }))
})

test('derives safe initials for one-word, multi-word, and Unicode names', () => {
  useStorage(createStorage())

  assert.equal(getProfileInitials('Ada'), 'AD')
  assert.equal(getProfileInitials('Ada Lovelace'), 'AL')
  assert.equal(getProfileInitials('李 小龙'), '李小')
})

test('handles storage read failures without throwing', () => {
  useStorage(createStorage({}, { readThrows: true }))

  assert.deepEqual(loadProfile(), DEFAULT_PROFILE)
})

test('reports storage write failures without claiming persistence', () => {
  const storage = createStorage({}, { writeThrows: true })
  useStorage(storage)

  assert.deepEqual(saveProfile({ displayName: 'Grace Hopper' }), { profile: { displayName: 'Grace Hopper' }, saved: false })
  assert.equal(storage.getSetCalls(), 1)
})

test('does not modify unrelated localStorage entries', () => {
  const storage = createStorage({ unrelated: 'keep me' })
  useStorage(storage)

  saveProfile({ displayName: 'Katherine Johnson' })

  assert.equal(storage.get('unrelated'), 'keep me')
  assert.equal(storage.get(PROFILE_STORAGE_KEY), JSON.stringify({ displayName: 'Katherine Johnson' }))
})
