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

function harness({ action = 'clockIn', resume = false, opened = true, url, fetchFails = false, background = resume, notificationFailure } = {}) {
  const values = new Map(), calls = []
  let active = true, visible = true, onResume, config
  // Scripting exports Notification from its module, rather than as a global.
  const notifications = {
    removeAllPendingsOfCurrentScript: async () => { if (notificationFailure === 'clear') throw new Error('Notifications unavailable'); calls.push({ kind: 'clear' }) },
    removeAllDeliveredsOfCurrentScript: async () => { if (notificationFailure === 'delivered') throw new Error('Notification cleanup failed') },
    schedule: async () => { if (notificationFailure === 'schedule') throw new Error('Notifications denied'); calls.push({ kind: 'schedule' }) },
  }
  const context = vm.createContext({
    exports: {}, console: { log() {} },
    Storage: { get: (key) => values.get(key), set: (key, value) => values.set(key, value), remove: (key) => values.delete(key) },
    Keychain: { get: () => 'existing-token' },
    TimeIntervalNotificationTrigger: class {},
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
    scripting: { Script: script, Notification: notifications, LiveActivity: {
      getAllActivities: async () => active ? [{ id: 'fixture', state: 'active' }] : [],
      from: async () => ({ update: async (state) => calls.push({ kind: 'update', state }) }),
      endAllActivities: async (options) => { active = false; if (options?.dismissTimeInterval <= 0) visible = false; calls.push({ kind: 'end' }) },
    } },
    './config': config,
    './zeus-flow': {
      openZeusObserved: async (action) => {
        calls.push({ kind: 'zeus', action, clockInPending: config.clockInPending(), clockOutPending: config.clockOutPending(), active })
        if (opened instanceof Error) throw opened
        return opened
      },
      copyZeusObservation: async () => calls.push({ kind: 'copy' }),
    },
    './api': { callApi: async () => { calls.push({ kind: 'fetch' }); return fetchFails ? { ok: false, message: 'offline' } : { ok: true, state } } },
    './audio': { startSilentAudio: async () => async () => {} },
    './live_activity': { ChaxterActivity: () => ({ start: async (state) => { active = true; visible = true; calls.push({ kind: 'start', state }); return true }, update: async () => {} }) },
  })[name]
  vm.runInContext(compile('index.tsx').replace(/\nmain\(\)[\s\S]*$/, ''), context)
  return { calls, config, values, run: async () => {
    await vm.runInContext('main()', context)
    if (resume) await onResume({ queryParameters: { [action]: '1' } })
  }, isActive: () => active, isVisible: () => visible }
}

for (const resume of [false, true]) {
  test(`clock-in observes ZeusX before hiding the button (${resume ? 'resume' : 'fresh'})`, async () => {
    const h = harness({ resume })
    await h.run()
    const opening = h.calls.find(call => call.kind === 'zeus')
    assert.equal(opening.clockInPending, true)
    assert.equal(opening.clockOutPending, false)
    assert.ok(h.calls.some(call => call.kind === 'update' && call.state.clockIn === '' && call.state.clockOut === ''))
    assert.equal(h.isActive(), true)
  })
  test(`clock-out closes the activity after the embedded ZeusX flow completes (${resume ? 'resume' : 'fresh'})`, async () => {
    const h = harness({ action: 'clockOut', resume })
    await h.run()
    assert.equal(h.calls.find(call => call.kind === 'zeus').active, true)
    assert.equal(h.isActive(), false)
    assert.equal(h.isVisible(), false, 'clock-out must remove the ended activity from the Lock Screen immediately')
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
  test(`${action} keeps its button if the embedded flow is cancelled`, async () => {
    const h = harness({ action, opened: false })
    await h.run()
    assert.equal(action === 'clockIn' ? h.config.clockInPending() : h.config.clockOutPending(), true)
    assert.equal(h.isActive(), true)
    assert.equal(h.calls.some(call => call.kind === 'clear'), false)
  })
}

test('a plain shortcut start shows clock-in and sets fresh single-run links', async () => {
  const h = harness({ action: null })
  await h.run()
  const start = h.calls.find(call => call.kind === 'start')
  assert.match(start.state.clockIn, /run_single\/ChaxterLog\?clockIn=1/)
  assert.equal(h.calls.filter(call => call.kind === 'schedule').length, 3)
  assert.equal(h.calls.filter(call => call.kind === 'zeus').length, 0)
})


for (const resume of [false, true]) {
  test(`leaving reveals clock-out (${resume ? 'resume' : 'fresh'})`, async () => {
    const h = harness({ action: 'leave', resume })
    h.config.markClockedIn()
    await h.run()
    assert.equal(h.isActive(), true)
    const update = h.calls.find(call => call.kind === 'update')
    assert.ok(update, 'the existing Live Activity must be updated')
    assert.equal(update.state.clockIn, '')
    assert.equal(update.state.clockOut, h.config.clockOutLink())
    assert.equal(h.config.arrivedToday(), false)
    assert.equal(h.calls.filter(call => call.kind === 'zeus').length, 0)
  })
}

test('a fresh clock-in link keeps the count polling loop alive', async () => {
  const h = harness({ background: true })
  await h.run()
  assert.ok(h.calls.findIndex(call => call.kind === 'keepAlive') > h.calls.findIndex(call => call.kind === 'zeus'))
})

test('starting again after clock-out creates a new clock-in reminder', async () => {
  const h = harness({ action: null })
  h.config.markClockedIn()
  h.config.markClockedOut()
  h.config.clearArrival()
  await h.run()
  assert.equal(h.config.clockInPending(), true)
})

test('observation export neither opens ZeusX nor starts an arrival', async () => {
  const h = harness({ action: 'zeusLog' })
  await h.run()
  assert.equal(h.calls.filter(call => call.kind === 'copy').length, 1)
  assert.equal(h.calls.filter(call => ['zeus', 'fetch', 'schedule', 'clear'].includes(call.kind)).length, 0)
})

for (const notificationFailure of ['clear', 'schedule']) {
  test(`notification ${notificationFailure} failure does not prevent Live Activity startup`, async () => {
    const h = harness({ action: null, notificationFailure })
    await h.run()
    assert.ok(h.calls.some(call => call.kind === 'start' && call.state.clockIn))
    assert.equal(h.isActive(), true)
  })
}

for (const resume of [false, true]) {
  for (const notificationFailure of ['clear', 'schedule']) {
    test(`leaving still shows clock-out when notifications ${notificationFailure} fails (${resume ? 'resume' : 'fresh'})`, async () => {
      const h = harness({ action: 'leave', resume, notificationFailure })
      h.config.markClockedIn()
      await h.run()
      assert.equal(h.isActive(), true)
      assert.ok(h.calls.some(call => call.kind === 'update' && call.state.clockOut && !call.state.clockIn))
    })
  }
}

for (const notificationFailure of ['clear', 'delivered']) {
  test(`clock-out immediately dismisses the activity even if ${notificationFailure} notifications cannot be cleared`, async () => {
    const h = harness({ action: 'clockOut', notificationFailure })
    await h.run()
    assert.equal(h.isVisible(), false)
    assert.equal(h.config.clockOutPending(), false)
  })
}
