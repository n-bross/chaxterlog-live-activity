const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const ts = require('typescript')
const root = join(__dirname, '..')
const compile = (file) => ts.transpileModule(readFileSync(join(root, file), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function harness({ action = 'clockIn', resume = false, opened = true, url, fetchFails = false, background = resume } = {}) {
  const values = new Map(), calls = []
  let active = true, onResume, config
  const context = vm.createContext({
    exports: {}, console: { log() {} },
    Storage: { get: (key) => values.get(key), set: (key, value) => values.set(key, value), remove: (key) => values.delete(key) },
    Keychain: { get: () => 'existing-token' },
    Notification: {
      removeAllPendingsOfCurrentScript: async () => calls.push({ kind: 'clear' }),
      removeAllDeliveredsOfCurrentScript: async () => {},
      schedule: async () => calls.push({ kind: 'schedule' }),
    },
    TimeIntervalNotificationTrigger: class {},
    Safari: { openURL: async (url) => {
      calls.push({ kind: 'open', url, clockInPending: config.clockInPending(), clockOutPending: config.clockOutPending(), active })
      if (opened instanceof Error) throw opened
      return opened
    } },
    Dialog: { alert: async () => calls.push({ kind: 'alert' }) },
    BackgroundKeeper: { keepAlive: async () => { calls.push({ kind: 'keepAlive' }); return true }, stopKeepAlive: async () => {} },
    setTimeout: (callback) => { values.set('chaxterlog.runner', ''); callback() },
  })
  vm.runInContext(compile('config.ts'), context)
  config = { ...context.exports, BACKGROUND_POLLING: background, CLOCK_IN_URL: url ?? context.exports.CLOCK_IN_URL }
  config.markArrived('old-clock-in-link', 'old-clock-out-link')
  if (action === 'clockOut') config.markClockedIn()
  const state = { u15: 1, o15: 2, total: 3, changedAt: '', refreshedAt: '', message: '', flash: '' }
  values.set(config.LAST_STATE_KEY, state)
  const script = {
    queryParameters: resume ? {} : action ? { [action]: '1' } : {}, name: 'ChaxterLog',
    createRunSingleURLScheme: (_name, params) => 'scripting://run_single/ChaxterLog?' + new URLSearchParams(params),
    createRunURLScheme: (_name, params) => 'scripting://run/ChaxterLog?' + new URLSearchParams(params),
    onResume: (callback) => { onResume = callback; return () => {} },
  }
  context.require = (name) => ({
    scripting: { Script: script, LiveActivity: {
      getAllActivities: async () => active ? [{ id: 'fixture', state: 'active' }] : [],
      from: async () => ({ update: async (state) => calls.push({ kind: 'update', state }) }),
      endAllActivities: async () => { active = false; calls.push({ kind: 'end' }) },
    } },
    './config': config,
    './api': { callApi: async () => { calls.push({ kind: 'fetch' }); return fetchFails ? { ok: false, message: 'offline' } : { ok: true, state } } },
    './audio': { startSilentAudio: async () => async () => {} },
    './live_activity': { ChaxterActivity: () => ({ start: async (state) => { active = true; calls.push({ kind: 'start', state }); return true }, update: async () => {} }) },
  })[name]
  vm.runInContext(compile('index.tsx').replace('main().finally(() => scripting_1.Script.exit());', ''), context)
  return { calls, config, values, run: async () => {
    await vm.runInContext('main()', context)
    if (resume) await onResume({ queryParameters: { [action]: '1' } })
  }, isActive: () => active }
}

for (const resume of [false, true]) {
  test(`clock-in updates the visible button before leaving Scripting (${resume ? 'resume' : 'fresh'})`, async () => {
    const h = harness({ resume })
    await h.run()
    const opening = h.calls.find(call => call.kind === 'open')
    assert.equal(opening.clockInPending, false)
    assert.equal(opening.clockOutPending, true)
    assert.ok(h.calls.some(call => call.kind === 'update' && call.state.clockIn === '' && call.state.clockOut === ''))
    assert.equal(h.isActive(), true)
  })
  test(`clock-out closes the activity before leaving Scripting (${resume ? 'resume' : 'fresh'})`, async () => {
    const h = harness({ action: 'clockOut', resume })
    await h.run()
    assert.equal(h.calls.find(call => call.kind === 'open').active, false)
    assert.equal(h.isActive(), false)
    assert.equal(h.config.clockOutPending(), false)
    assert.equal(h.config.arrivedToday(), false)
  })
}

test('clock links do not depend on a successful count API request', async () => {
  const h = harness({ fetchFails: true })
  await h.run()
  assert.equal(h.config.clockInPending(), false)
  assert.equal(h.calls.filter(call => call.kind === 'fetch').length, 0)
})

for (const action of ['clockIn', 'clockOut']) {
  test(`${action} restores its previous button if the website cannot open`, async () => {
    const h = harness({ action, opened: false })
    await h.run()
    assert.equal(action === 'clockIn' ? h.config.clockInPending() : h.config.clockOutPending(), true)
    assert.equal(h.isActive(), true)
    assert.ok(h.calls.some(call => call.kind === 'alert'))
  })
}

test('a plain shortcut start shows clock-in and sets fresh single-run links', async () => {
  const h = harness({ action: null })
  await h.run()
  const start = h.calls.find(call => call.kind === 'start')
  assert.match(start.state.clockIn, /run_single\/ChaxterLog\?clockIn=1/)
  assert.equal(h.calls.filter(call => call.kind === 'schedule').length, 3)
  assert.equal(h.calls.filter(call => call.kind === 'open').length, 0)
})


test('clock-out appears only after leaving the workplace', async () => {
  const h = harness({ action: 'leave' })
  h.config.markClockedIn()
  await h.run()
  assert.equal(h.isActive(), true)
  const update = h.calls.find(call => call.kind === 'update')
  assert.equal(update.state.clockIn, '')
  assert.equal(update.state.clockOut, 'old-clock-out-link')
  assert.equal(h.calls.filter(call => call.kind === 'open').length, 0)
})

test('a fresh clock-in link keeps the count polling loop alive', async () => {
  const h = harness({ background: true })
  await h.run()
  assert.ok(h.calls.findIndex(call => call.kind === 'keepAlive') > h.calls.findIndex(call => call.kind === 'open'))
})

test('starting again after clock-out creates a new clock-in reminder', async () => {
  const h = harness({ action: null })
  h.config.markClockedIn()
  h.config.markClockedOut()
  h.config.clearArrival()
  await h.run()
  assert.equal(h.config.clockInPending(), true)
})
