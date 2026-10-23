const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const ts = require('typescript')

function fixture() {
  const records = []
  let click, mutation
  let resultText = 'Online'
  const result = {
    get textContent() { return resultText },
    get innerText() { return resultText },
    querySelectorAll: () => [],
  }
  const button = { id: 'TerminalButton0', textContent: 'Kommt/Geht', click() { throw new Error('Observer must never click') } }
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(join(__dirname, '../zeus-observer.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports })
  const context = vm.createContext({
    window: { webkit: { messageHandlers: { zeusObservation: { postMessage: async (record) => records.push(record) } } } },
    location: { origin: 'https://zeiterfassung.grafing.de', pathname: '/ZeusX/content/workspace.aspx' },
    document: {
      documentElement: {},
      addEventListener: (name, listener) => { assert.equal(name, 'click'); click = listener },
      getElementById: (id) => id === 'TerminalResult' ? result : undefined,
      querySelector: (selector) => { assert.equal(selector, '#uiBookingActions button'); return button },
      querySelectorAll: (selector) => { assert.equal(selector, 'iframe'); return [] },
    },
    MutationObserver: class {
      constructor(callback) { mutation = callback }
      observe() {}
    },
    fetch() { throw new Error('Observer must not make requests') },
    XMLHttpRequest: class { constructor() { throw new Error('Observer must not make requests') } },
  })
  const install = () => vm.runInContext(exports.OBSERVER_SCRIPT, context)
  install()
  const tap = (trusted = true, terminal = true) => click({ isTrusted: trusted, target: { closest: () => terminal ? button : null } })
  return { records, tap, install, status: () => vm.runInContext('(function(){' + exports.OBSERVER_STATUS_SCRIPT + '})()', context), change: (text) => { resultText = text; mutation() } }
}

test('the observer is passive until a real user taps the terminal button', () => {
  const f = fixture()
  f.change('Saldo -2.53')
  f.tap(false)
  f.tap(true, false)
  assert.equal(f.records.length, 0)
})

test('records the user tap and the changing terminal result, without submitting anything', () => {
  const f = fixture()
  f.tap()
  f.change('Kommt 15:30 Saldo -2.53')
  assert.equal(f.records.length, 2)
  assert.equal(f.records[0].kind, 'tap')
  assert.equal(f.records[1].kind, 'result')
  assert.equal(f.records[1].result.text, 'Kommt 15:30 Saldo -2.53')
})

test('repeated installation and unchanged mutations do not duplicate records', () => {
  const f = fixture()
  f.install()
  f.tap()
  f.change('Kommt 15:30 Saldo -2.53')
  f.change('Kommt 15:30 Saldo -2.53')
  assert.equal(f.records.length, 2)
})

test('the native recorder discards unexpected fields such as passwords and request data', () => {
  const context = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync(join(__dirname, '../zeus-observer.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  const normalized = context.exports.normalizeObservation({
    kind: 'result', at: new Date().toISOString(), tapAt: new Date().toISOString(), button: 'Kommt/Geht',
    password: 'do-not-store', cookies: 'do-not-store', requestBody: 'do-not-store',
    result: { text: 'Saldo -2.53', fields: [], unexpected: 'do-not-store' },
  })
  assert.equal(normalized.result.text, 'Saldo -2.53')
  assert.equal(JSON.stringify(normalized).includes('do-not-store'), false)
  assert.equal(context.exports.normalizeObservation({ kind: 'login', password: 'do-not-store' }), null)
})

test('the observer readiness probe works without a booking or any page text export', () => {
  const f = fixture()
  const status = f.status()
  assert.equal(status.originAllowed, true)
  assert.equal(status.installed, true)
  assert.equal(status.bridgeAvailable, true)
  assert.equal(status.terminalButtonFound, true)
  assert.equal(status.terminalResultFound, true)
  assert.equal(status.loginPage, false)
  assert.equal(status.frameCount, 0)
  assert.equal(f.records.length, 0)
  assert.equal(JSON.stringify(status).includes('Online'), false)
})
