// Run with: node --test tests/clock-links.test.cjs (requires TypeScript).
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const ts = require('typescript')
const root = join(__dirname, '..')
const target = 'https://zeiterfassung.grafing.de/ZeusX/content/workspace.aspx?id=ac6ee697-ebcd-4323-9acb-cafb0303a9ff'
const compile = (file) => ts.transpileModule(readFileSync(join(root, file), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function harness({ action = 'clockIn', url, opened = true, resume = false, left = false } = {}) {
  const values = new Map()
  const calls = []
  const context = vm.createContext({
    exports: {}, console: { log() {} },
    Storage: { get: (key) => values.get(key), set: (key, value) => values.set(key, value) },
    Keychain: { get: () => 'existing-token' },
    Notification: {
      removeAllPendingsOfCurrentScript: async () => calls.push('clear-pending'),
      removeAllDeliveredsOfCurrentScript: async () => calls.push('clear-delivered'),
    },
    Dialog: { alert: async () => calls.push('alert') },
    Safari: { openURL: async (value) => {
      calls.push(['open', value])
      if (opened instanceof Error) throw opened
      return opened
    } },
    BackgroundKeeper: { keepAlive: async () => true, stopKeepAlive: async () => {} },
    setTimeout: (callback) => callback(),
  })
  vm.runInContext(compile('config.ts'), context)
  const config = { ...context.exports, CLOCK_IN_URL: url ?? context.exports.CLOCK_IN_URL, BACKGROUND_POLLING: resume }
  config.markArrived('scripting://run/ChaxterLog?clockIn=1', 'scripting://run/ChaxterLog?clockOut=1')
  if (action === 'clockOut') config.markClockedIn()
  if (left) config.clearArrival()
  const state = { u15: 1, o15: 2, total: 3, changedAt: '', refreshedAt: '', message: '', flash: '' }
  values.set(config.LAST_STATE_KEY, state)
  let onResume
  context.require = (name) => ({
    scripting: {
      Script: {
        queryParameters: resume ? {} : { [action]: '1' }, name: 'ChaxterLog',
        createRunSingleURLScheme: () => 'scripting://run_single/ChaxterLog',
        onResume: (callback) => { onResume = callback; return () => {} },
      },
      LiveActivity: { getAllActivities: async () => [], endAllActivities: async () => {} },
    },
    './config': config,
    './api': { callApi: async () => ({ ok: true, state }) },
    './audio': { startSilentAudio: async () => async () => {} },
    './live_activity': { ChaxterActivity: () => ({ start: async () => true, update: async () => {} }) },
  })[name]
  vm.runInContext(compile('index.tsx').replace('main().finally(() => scripting_1.Script.exit());', ''), context)
  return { calls, config, run: async () => {
    await vm.runInContext('main()', context)
    if (resume) await onResume({ queryParameters: { [action]: '1' } })
  } }
}

for (const resume of [false, true]) {
  for (const action of ['clockIn', 'clockOut']) {
    test(`${action}, ${resume ? 'running script' : 'fresh run'}: failed browser opening preserves the button and reminders`, async () => {
      const h = harness({ action, resume, opened: false })
      await h.run()
      assert.equal(action === 'clockIn' ? h.config.clockInPending() : h.config.clockOutPending(), true)
      assert.equal(h.calls.includes('clear-pending'), false)
      assert.equal(h.calls.includes('alert'), true)
    })
  }
}

for (const resume of [false, true]) {
  for (const action of ['clockIn', 'clockOut']) {
    test(`${action}, ${resume ? 'running script' : 'fresh run'}: opens ZeusX before dismissing the reminder`, async () => {
      const h = harness({ action, resume })
      await h.run()
      const opening = h.calls.findIndex((call) => Array.isArray(call) && call[0] === 'open')
      assert.ok(opening >= 0)
      assert.equal(h.calls[opening][1], target)
      assert.ok(h.calls.indexOf('clear-pending') > opening)
      assert.equal(action === 'clockIn' ? h.config.clockInPending() : h.config.clockOutPending(), false)
    })
  }
}

for (const options of [{ url: '' }, { opened: new Error('Cannot open URL') }]) {
  test(`missing or rejected destination keeps the clock-in reminder: ${options.url === '' ? 'missing' : 'exception'}`, async () => {
    const h = harness(options)
    await h.run()
    assert.equal(h.config.clockInPending(), true)
    assert.equal(h.calls.includes('clear-pending'), false)
    assert.equal(h.calls.includes('alert'), true)
  })
}

for (const opened of [false, true]) {
  test(`clock-out after leaving: ${opened ? 'successful' : 'failed'} browser opening`, async () => {
    const h = harness({ action: 'clockOut', left: true, opened })
    await h.run()
    assert.equal(h.config.clockOutPending(), !opened)
    assert.equal(h.calls.includes('clear-pending'), opened)
  })
}
