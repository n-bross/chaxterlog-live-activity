const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const ts = require('typescript')
const compile = (file) => ts.transpileModule(readFileSync(join(__dirname, '..', file), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function harness({ choices = [0], load = true, captured = true } = {}) {
  const storage = new Map(), calls = []
  const observer = { exports: {} }
  vm.runInNewContext(compile('zeus-observer.ts'), observer)
  let handler, disposed = false
  const context = vm.createContext({
    exports: {}, require: (name) => ({ './zeus-observer': observer.exports, './config': { CLOCK_IN_URL: 'https://zeiterfassung.grafing.de/ZeusX/content/workspace.aspx?id=fixture', SHARED: { shared: true } } })[name],
    Storage: { get: (key) => storage.get(key), set: (key, value) => storage.set(key, value) },
    Pasteboard: { setString: async (text) => calls.push({ kind: 'copy', text }) },
    Dialog: { actionSheet: async (options) => { calls.push({ kind: 'choice', options }); return choices.shift() ?? -1 }, alert: async (options) => calls.push({ kind: 'alert', options }) },
    WebViewController: class {
      async addScriptMessageHandler(_name, callback) { handler = callback }
      async loadURL() { calls.push({ kind: 'load' }); return load }
      async evaluateJavaScript(script) { assert.equal(script, observer.exports.OBSERVER_SCRIPT) }
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
  const saved = [...h.storage.values()][0]
  assert.equal(saved.action, 'in')
  assert.equal(saved.records[0].result.text, 'fixture-response')
  assert.equal(JSON.stringify(saved).includes('must-not-save'), false)
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
