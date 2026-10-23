const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const ts = require('typescript')
const compile = (file) => ts.transpileModule(readFileSync(join(__dirname, '..', file), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function harness({ choices = [0], load = true, captured = true, storage = new Map(), injectionFails = false } = {}) {
  const calls = []
  const observer = { exports: {} }
  vm.runInNewContext(compile('zeus-observer.ts'), observer)
  let handler, disposed = false
  const context = vm.createContext({
    exports: {}, require: (name) => ({ scripting: { Script: { name: 'ChaxterLog' } }, './zeus-observer': observer.exports, './config': { CLOCK_IN_URL: 'https://zeiterfassung.grafing.de/ZeusX/content/workspace.aspx?id=fixture', SHARED: { shared: true } } })[name],
    Storage: { get: (key) => storage.get(key), set: (key, value) => storage.set(key, value) },
    Pasteboard: { setString: async (text) => calls.push({ kind: 'copy', text }) },
    Dialog: { actionSheet: async (options) => { calls.push({ kind: 'choice', options }); return choices.shift() ?? -1 }, alert: async (options) => calls.push({ kind: 'alert', options }) },
    WebViewController: class {
      async addScriptMessageHandler(_name, callback) { handler = callback }
      async loadURL() { calls.push({ kind: 'load' }); return load }
      async evaluateJavaScript(script) {
        if (injectionFails) throw new Error('WebView evaluation failed')
        if (script === observer.exports.OBSERVER_STATUS_SCRIPT) return { originAllowed: true, installed: true, bridgeAvailable: true, loginPage: false, terminalButtonFound: true, terminalResultFound: true, frameCount: 0, password: 'must-not-save' }
        assert.equal(script, observer.exports.OBSERVER_SCRIPT)
      }
      async present() {
        calls.push({ kind: 'present' })
        if (captured) handler({ kind: 'result', button: 'Kommt/Geht', at: new Date().toISOString(), tapAt: new Date().toISOString(), result: { text: 'fixture-response', fields: [] }, password: 'must-not-save' })
      }
      dispose() { disposed = true }
    },
    setTimeout: () => 1, clearTimeout() {},
  })
  vm.runInContext(compile('zeus-flow.ts'), context)
  return { api: context.exports, storage, calls, disposed: () => disposed }
}

test('clock-in and observation share one embedded ZeusX page and local record', async () => {
  const h = harness()
  assert.equal(await h.api.openZeusObserved('in'), true)
  assert.equal(h.disposed(), true)
  assert.equal(h.calls.filter(call => call.kind === 'load').length, 1)
  const saved = h.storage.get('chaxterlog.zeus.observations.v2').captures[0]
  assert.equal(saved.action, 'in')
  assert.equal(saved.records[0].result.text, 'fixture-response')
  assert.equal(JSON.stringify([...h.storage.values()]).includes('must-not-save'), false)
})

test('a terminal response is not automatically declared a successful booking', async () => {
  const h = harness({ choices: [1] })
  assert.equal(await h.api.openZeusObserved('out'), false)
  assert.equal(h.disposed(), true)
})

test('the embedded flow can copy its observation and then complete', async () => {
  const h = harness({ choices: [2, 0] })
  assert.equal(await h.api.openZeusObserved('out'), true)
  assert.ok(h.calls.some(call => call.kind === 'copy' && call.text.includes('fixture-response')))
})

test('an unreachable ZeusX page never completes the flow', async () => {
  const h = harness({ load: false })
  assert.equal(await h.api.openZeusObserved('in'), false)
  assert.equal(h.calls.some(call => call.kind === 'choice'), false)
  assert.equal(h.disposed(), true)
})

test('export retains clock-in and clock-out in one observation history', async () => {
  const first = harness()
  await first.api.openZeusObserved('in')
  const second = harness({ storage: first.storage })
  await second.api.openZeusObserved('out')
  await second.api.copyZeusObservation()
  const exported = JSON.parse(second.calls.find(call => call.kind === 'copy').text)
  assert.equal(exported.schema, 'zeus-observations/v2')
  assert.deepEqual(exported.captures.map(capture => capture.action), ['in', 'out'])
})

test('an existing v1 recording survives the history upgrade', async () => {
  const legacy = { schema: 'zeus-observation/v1', action: 'in', startedAt: '2026-10-23T06:00:00Z', records: [{ kind: 'tap', button: 'Kommt/Geht' }] }
  const storage = new Map([['chaxterlog.zeus.observation.v1', legacy]])
  const h = harness({ storage })
  await h.api.openZeusObserved('out')
  await h.api.copyZeusObservation()
  const history = JSON.parse(h.calls.find(call => call.kind === 'copy').text)
  assert.equal(history.captures[0].startedAt, legacy.startedAt)
  assert.deepEqual(history.captures.map(capture => capture.action), ['in', 'out'])
})

test('opening ZeusX without a recorded event keeps previous sessions', async () => {
  const first = harness()
  await first.api.openZeusObserved('in')
  const h = harness({ storage: first.storage, captured: false, choices: [1] })
  await h.api.openZeusObserved('out')
  await h.api.copyZeusObservation()
  const history = JSON.parse(h.calls.find(call => call.kind === 'copy').text)
  assert.deepEqual(history.captures.map(capture => capture.action), ['in'])
})

test('history retains the latest twenty observed sessions', async () => {
  const captures = Array.from({ length: 20 }, (_, i) => ({ schema: 'zeus-observation/v1', action: 'in', startedAt: String(i), records: [{ kind: 'tap' }] }))
  const storage = new Map([['chaxterlog.zeus.observations.v2', { schema: 'zeus-observations/v2', captures }]])
  const h = harness({ storage })
  await h.api.openZeusObserved('out')
  await h.api.copyZeusObservation()
  const history = JSON.parse(h.calls.find(call => call.kind === 'copy').text)
  assert.equal(history.captures.length, 20)
  assert.equal(history.captures[0].startedAt, '1')
  assert.equal(history.captures[19].action, 'out')
})

test('a failed observer injection exports diagnostics even without booking events', async () => {
  const h = harness({ captured: false, choices: [1], injectionFails: true })
  await h.api.openZeusObserved('in')
  await h.api.copyZeusObservation()
  const copy = h.calls.find(call => call.kind === 'copy')
  assert.ok(copy, 'an empty recording must still provide an observer diagnostic')
  const exported = JSON.parse(copy.text)
  assert.equal(exported.captures.length, 0)
  assert.equal(exported.diagnostic.action, 'in')
  assert.equal(exported.diagnostic.records, 0)
  assert.equal(exported.diagnostic.evaluationFailures, 1)
})
