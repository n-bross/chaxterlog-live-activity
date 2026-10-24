const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const ts = require('typescript')
const compile = (name) => ts.transpileModule(readFileSync(join(__dirname, '..', name), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function harness({ active = false, notificationFailure, updateFails = false, endFails = false } = {}) {
  const values = new Map(), notices = [], updates = [], ends = []
  let builderLoads = 0, cleanups = 0
  const context = vm.createContext({
    exports: {}, console: { log() {} },
    Storage: { get: (key) => values.get(key), set: (key, value) => values.set(key, value) },
    Keychain: {},
    TimeIntervalNotificationTrigger: class { constructor(options) { Object.assign(this, options) } },
  })
  const load = (file) => vm.runInContext('(function(exports, require) {' + compile(file) + '; return exports; })', context)({}, context.require)
  const config = load('config.ts')
  const last = { u15: 7, o15: 8, total: 15, changedAt: '', refreshedAt: '', message: '', flash: '' }
  values.set(config.LAST_STATE_KEY, last)
  values.set(config.RUNNER_KEY, 'polling-run')
  context.require = (name) => {
    if (name === './config') return config
    if (name === './live_activity') { builderLoads++; return {} }
    if (name !== 'scripting') throw new Error('Background automation must not fetch an API or open ZeusX: ' + name)
    return {
      Script: { name: 'Custom Name', env: 'intent', createRunSingleURLScheme: (name, params) => 'scripting://run_single/' + encodeURIComponent(name) + '?' + new URLSearchParams(params) },
      Notification: {
        removeAllPendingsOfCurrentScript: async () => { cleanups++; if (notificationFailure === 'clear') throw new Error('cleanup failed') },
        removeAllDeliveredsOfCurrentScript: async () => {},
        schedule: async (options) => { notices.push(options); if (notificationFailure === 'throw') throw new Error('permission denied'); return notificationFailure !== 'false' },
      },
      LiveActivity: {
        getAllActivities: async () => active ? [{ id: 'activity', state: 'active' }] : [],
        from: async () => ({ update: async (state) => { updates.push(state); if (updateFails) throw new Error('update unavailable'); return true } }),
        endAllActivities: async (options) => { ends.push(options); if (endFails) throw new Error('activity unavailable'); return true },
        start: () => { throw new Error('Cannot start a new activity in the background') },
      },
    }
  }
  const automation = load('automation.ts')
  return { automation, config, values, notices, updates, ends, builderLoads: () => builderLoads, cleanups: () => cleanups }
}

test('background arrival stores pending clock-in and immediately notifies without starting an activity', async () => {
  const h = harness()
  const result = await h.automation.arrive(true)
  assert.equal(h.config.clockInPending(), true)
  assert.equal(result.pending, true)
  assert.equal(result.updated, 0)
  assert.equal(result.notificationsScheduled, true)
  assert.equal(h.builderLoads(), 0)
  assert.equal(h.notices.length, 4)
  assert.equal(h.notices[0].trigger, undefined)
  assert.match(h.notices[0].tapAction.url, /Custom%20Name\?arrive=1/)
  assert.deepEqual(h.notices.slice(1).map(n => n.trigger.timeInterval), [600, 1200, 1800])
  assert.ok(h.notices.every(n => /arrive=1/.test(n.tapAction.url)), 'reminders must also allow creating a missing activity')
  assert.equal(h.values.get(h.config.RUNNER_KEY), 'polling-run')
})

test('background arrival can update an already running activity', async () => {
  const h = harness({ active: true })
  const result = await h.automation.arrive(true)
  assert.equal(result.updated, 1)
  assert.equal(h.updates[0].u15, 7)
  assert.match(h.updates[0].clockIn, /clockIn=1/)
  assert.equal(h.builderLoads(), 1)
})

test('background departure shows clock-out and sends a reminder while stopping polling', async () => {
  const h = harness({ active: true })
  await h.automation.arrive(true)
  h.config.markClockedIn()
  h.notices.length = 0
  const result = await h.automation.leave()
  assert.equal(h.config.arrivedToday(), false)
  assert.equal(h.config.clockOutPending(), true)
  assert.equal(h.values.get(h.config.RUNNER_KEY), '')
  assert.equal(result.updated, 1)
  assert.equal(h.updates.at(-1).clockIn, '')
  assert.match(h.updates.at(-1).clockOut, /clockOut=1/)
  assert.equal(h.notices.length, 1)
  assert.match(h.notices[0].tapAction.url, /clockOut=1/)
  assert.equal(h.ends.length, 0)
})

test('departure still offers clock-out when no Live Activity exists or update fails', async () => {
  for (const options of [{}, { active: true, updateFails: true }]) {
    const h = harness(options)
    h.config.markClockedIn()
    const result = await h.automation.leave()
    assert.equal(result.updated, 0)
    assert.equal(result.notificationsScheduled, true)
    assert.match(h.notices[0].tapAction.url, /Custom%20Name\?clockOut=1/)
  }
})

test('departure without a pending clock-out dismisses the activity immediately', async () => {
  const h = harness({ active: true })
  const result = await h.automation.leave()
  assert.equal(result.pending, false)
  assert.equal(h.ends[0].dismissTimeInterval, 0)
  assert.equal(h.notices.length, 0)
})

for (const notificationFailure of ['clear', 'throw', 'false']) {
  test(`notification ${notificationFailure} failure does not prevent arrival and departure state changes`, async () => {
    const h = harness({ active: true, notificationFailure })
    const arrival = await h.automation.arrive(true)
    assert.equal(h.config.clockInPending(), true)
    assert.match(h.updates[0].clockIn, /clockIn=1/)
    assert.equal(arrival.notificationsScheduled, notificationFailure === 'clear')
    h.config.markClockedIn()
    const departure = await h.automation.leave()
    assert.equal(h.config.arrivedToday(), false)
    assert.match(h.updates.at(-1).clockOut, /clockOut=1/)
    assert.equal(departure.notificationsScheduled, notificationFailure === 'clear')
  })
}

test('repeated arrival after clock-in does not create a second clock-in reminder', async () => {
  const h = harness({ active: true })
  await h.automation.arrive(true)
  h.config.markClockedIn()
  h.notices.length = 0
  const result = await h.automation.arrive(true)
  assert.equal(result.pending, false)
  assert.equal(h.notices.length, 0)
  assert.equal(h.updates.at(-1).clockIn, '')
})

// A failed system API must not leave the old arrival reminders scheduled after departure.
test('departure clears arrival reminders even when ending an activity throws', async () => {
  const h = harness({ endFails: true })
  await h.automation.leave()
  assert.equal(h.config.arrivedToday(), false)
  assert.equal(h.cleanups(), 1)
})
