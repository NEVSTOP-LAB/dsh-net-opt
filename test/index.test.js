import test from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'dsh-net-opt-test-'))
const { apply, normalizeConfig } = await import('../lib/index.js')

function createCtx() {
  const cleanups = []
  return {
    logger: { info() {}, warn() {} },
    effect(fn) {
      cleanups.push(fn())
    },
    dispose() {
      while (cleanups.length > 0) cleanups.pop()()
    },
  }
}

function withDefaultsRestored(fn) {
  const before = {
    autoSelectFamily: net.getDefaultAutoSelectFamily(),
    attemptTimeoutMs: net.getDefaultAutoSelectFamilyAttemptTimeout(),
  }
  try {
    return fn()
  } finally {
    net.setDefaultAutoSelectFamily(before.autoSelectFamily)
    net.setDefaultAutoSelectFamilyAttemptTimeout(before.attemptTimeoutMs)
  }
}

test('normalizeConfig 补全默认值', () => {
  assert.deepEqual(normalizeConfig(undefined), { attemptTimeoutMs: 3000, disableAutoSelectFamily: false })
  assert.deepEqual(normalizeConfig({ attemptTimeoutMs: 5000 }), { attemptTimeoutMs: 5000, disableAutoSelectFamily: false })
})

test('normalizeConfig 拒绝非法值', () => {
  assert.throws(() => normalizeConfig({ attemptTimeoutMs: 100 }), RangeError)
  assert.throws(() => normalizeConfig({ attemptTimeoutMs: '3000' }), RangeError)
  assert.throws(() => normalizeConfig({ disableAutoSelectFamily: 'yes' }), TypeError)
  assert.throws(() => normalizeConfig([]), TypeError)
})

test('默认配置把单地址尝试窗口改为 3000ms', () => withDefaultsRestored(() => {
  const ctx = createCtx()
  apply(ctx, {})
  assert.equal(net.getDefaultAutoSelectFamilyAttemptTimeout(), 3000)
  assert.equal(net.getDefaultAutoSelectFamily(), true)
  ctx.dispose()
}))

test('自定义 attemptTimeoutMs 生效', () => withDefaultsRestored(() => {
  const ctx = createCtx()
  apply(ctx, { attemptTimeoutMs: 5000 })
  assert.equal(net.getDefaultAutoSelectFamilyAttemptTimeout(), 5000)
  ctx.dispose()
}))

test('disableAutoSelectFamily 关闭自动选择', () => withDefaultsRestored(() => {
  const ctx = createCtx()
  apply(ctx, { disableAutoSelectFamily: true })
  assert.equal(net.getDefaultAutoSelectFamily(), false)
  ctx.dispose()
}))

test('卸载时恢复原值', () => withDefaultsRestored(() => {
  const before = net.getDefaultAutoSelectFamilyAttemptTimeout()
  const ctx = createCtx()
  apply(ctx, { attemptTimeoutMs: 5000, disableAutoSelectFamily: true })
  assert.notEqual(net.getDefaultAutoSelectFamilyAttemptTimeout(), before)
  ctx.dispose()
  assert.equal(net.getDefaultAutoSelectFamilyAttemptTimeout(), before)
  assert.equal(net.getDefaultAutoSelectFamily(), true)
}))
