const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const ts = require('typescript')

async function run(input, options = {}) {
  const calls = [], results = []
  const Script = {
    name: 'Mein ChaxterLog',
    createRunSingleURLScheme: (name, params) => 'scripting://run_single/' + encodeURIComponent(name) + '?' + new URLSearchParams(params),
    exit: (result) => results.push(result),
  }
  const Intent = {
    shortcutParameter: input === undefined ? undefined : { type: 'text', value: input },
    textsParameter: options.textsParameter,
    text: (value) => value,
  }
  const context = vm.createContext({
    exports: {}, require: (name) => {
      if (name === 'scripting') return { Script, Intent }
      if (name === './automation') return {
        arrive: async (background) => { calls.push({ action: 'arrive', background }); if (options.error) throw new Error('fixture error'); return options.result ?? { pending: true, updated: 0, notificationsScheduled: true } },
        leave: async () => { calls.push({ action: 'leave' }); return options.result ?? { pending: true, updated: 1, notificationsScheduled: true } },
      }
      throw new Error('Unexpected import: ' + name)
    },
    // Opening an app or showing a dialog is the failure on a locked phone.
    Safari: { openURL: async () => { throw new Error('Must not open the foreground app') } },
    Dialog: { alert: async () => { throw new Error('Must not prompt to unlock') } },
  })
  const source = ts.transpileModule(readFileSync(join(__dirname, '../intent.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace(/\nrun\(\);?\s*$/, '\nglobalThis.done = run();')
  vm.runInContext(source, context)
  await context.done
  return { calls, results }
}

test('empty shortcut input handles arrival in the background without opening an app', async () => {
  const h = await run()
  assert.equal(h.calls[0].action, 'arrive')
  assert.equal(h.calls[0].background, true)
  assert.match(h.results[0], /Mitteilung/)
})

for (const input of ['gehen', 'leave', 'Departure', 'Verlassen']) {
  test(`${input} handles departure without opening an app`, async () => {
    const h = await run(input)
    assert.equal(h.calls[0].action, 'leave')
    assert.match(h.results[0], /Ausstempeln/)
  })
}

test('text array input also handles departure', async () => {
  const h = await run(undefined, { textsParameter: ['gehen'] })
  assert.equal(h.calls[0].action, 'leave')
})

test('denied notifications report missing reminder permission', async () => {
  const h = await run('ankommen', { result: { pending: true, updated: 0, notificationsScheduled: false } })
  assert.match(h.results[0], /Mitteilungen.*erlauben/)
  assert.doesNotMatch(h.results[0], /Mitteilung geplant/)
})

test('background errors return a diagnostic without an unlock prompt', async () => {
  const h = await run(undefined, { error: true })
  assert.match(h.results[0], /fixture error/)
})

test('unknown inputs cannot accidentally mark a new arrival', async () => {
  const h = await run('typo')
  assert.equal(h.calls.length, 0)
  assert.match(h.results[0], /ankommen.*gehen/)
})

test('protokoll returns an export link without performing an arrival or opening an app', async () => {
  const h = await run('protokoll')
  assert.equal(h.calls.length, 0)
  assert.match(h.results[0], /Mein%20ChaxterLog\?zeusLog=1/)
})
