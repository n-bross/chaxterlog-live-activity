const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const ts = require('typescript')

async function run(input, opened = true) {
  const calls = [], results = [], alerts = []
  const Script = {
    name: 'Mein ChaxterLog',
    createRunSingleURLScheme: (name, params) => { calls.push({ name, params }); return 'scripting://fixture' },
    exit: (result) => results.push(result),
  }
  const Intent = { shortcutParameter: input === undefined ? undefined : { type: 'text', value: input }, text: (value) => value }
  const context = vm.createContext({
    exports: {}, require: () => ({ Script, Intent }),
    Safari: { openURL: async () => opened },
    Dialog: { alert: async (options) => alerts.push(options) },
  })
  const source = ts.transpileModule(readFileSync(join(__dirname, '../intent.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace(/\nrun\(\);?\s*$/, '\nglobalThis.done = run();')
  vm.runInContext(source, context)
  await context.done
  return { calls, results, alerts }
}

test('empty shortcut input starts arrival with the installed script name', async () => {
  const h = await run()
  assert.equal(h.calls[0].name, 'Mein ChaxterLog')
  assert.equal(h.calls[0].params.arrive, '1')
})

test('gehen shortcut input uses the leave action', async () => {
  const h = await run('gehen')
  assert.equal(h.calls[0].params.leave, '1')
})

test('failed shortcut launch reports the problem rather than claiming arrival', async () => {
  const h = await run(undefined, false)
  assert.equal(h.alerts.length, 1)
  assert.equal(h.results.includes('ChaxterLog: Ankommen'), false)
})


test('protokoll opens the embedded observation export without triggering arrival', async () => {
  const h = await run('protokoll')
  assert.equal(h.calls[0].params.zeusLog, '1')
  assert.equal(h.calls[0].params.arrive, undefined)
})
