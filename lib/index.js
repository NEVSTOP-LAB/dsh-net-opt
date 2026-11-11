/**
 * dsh-net-opt：把 Node 的 Happy Eyeballs 单地址尝试窗口调宽。
 *
 * Node 默认 `autoSelectFamily=true`、`autoSelectFamilyAttemptTimeout=250`。慢链路上
 * 到边缘节点的 IPv4 握手常需 0.3–2.3s，超过 250ms 窗口；候选地址耗尽后连接以
 * ETIMEDOUT 失败，宿主报 `Connection error.`（TRANSPORT）。本插件在宿主进程启动时
 * 改 `net` 的进程级默认值，对 `net.connect` 与全局 `fetch`（undici）同时生效。
 *
 * @module dsh-net-opt
 */
import net from 'node:net'
import { appendLog } from './log.js'

export const name = 'dsh-net-opt'

const DEFAULTS = {
  attemptTimeoutMs: 3000,
  disableAutoSelectFamily: false,
}

const MIN_ATTEMPT_TIMEOUT_MS = 250

/**
 * 校验并补全配置。
 * @param raw - 条目配置。
 * @returns 规范化后的配置。
 */
export function normalizeConfig(raw) {
  if (raw !== undefined && raw !== null && (typeof raw !== 'object' || Array.isArray(raw))) {
    throw new TypeError('dsh-net-opt: config 必须是对象')
  }
  const merged = { ...DEFAULTS, ...(raw ?? {}) }
  const { attemptTimeoutMs, disableAutoSelectFamily } = merged
  if (typeof attemptTimeoutMs !== 'number' || !Number.isFinite(attemptTimeoutMs) || attemptTimeoutMs < MIN_ATTEMPT_TIMEOUT_MS) {
    throw new RangeError(`dsh-net-opt: attemptTimeoutMs 必须是 >= ${MIN_ATTEMPT_TIMEOUT_MS} 的有限数字，收到 ${String(attemptTimeoutMs)}`)
  }
  if (typeof disableAutoSelectFamily !== 'boolean') {
    throw new TypeError(`dsh-net-opt: disableAutoSelectFamily 必须是布尔值，收到 ${typeof disableAutoSelectFamily}`)
  }
  return { attemptTimeoutMs, disableAutoSelectFamily }
}

/** 读取当前进程级默认值。 */
function snapshot() {
  return {
    autoSelectFamily: net.getDefaultAutoSelectFamily(),
    attemptTimeoutMs: net.getDefaultAutoSelectFamilyAttemptTimeout(),
  }
}

/**
 * 挂载插件：写入 net 默认值，写启动证据，卸载时恢复原值。
 * @param ctx - cordis 上下文。
 * @param rawConfig - 条目配置。
 */
export function apply(ctx, rawConfig) {
  const config = normalizeConfig(rawConfig)

  if (typeof net.setDefaultAutoSelectFamilyAttemptTimeout !== 'function' || typeof net.setDefaultAutoSelectFamily !== 'function') {
    const warning = '当前 Node 没有 net.setDefaultAutoSelectFamilyAttemptTimeout，插件不生效'
    appendLog(`skip ${warning}`)
    ctx.logger?.warn?.(`dsh-net-opt: ${warning}`)
    return
  }

  const before = snapshot()
  if (config.disableAutoSelectFamily) net.setDefaultAutoSelectFamily(false)
  net.setDefaultAutoSelectFamilyAttemptTimeout(config.attemptTimeoutMs)
  const after = snapshot()

  const summary = `autoSelectFamily ${before.autoSelectFamily} -> ${after.autoSelectFamily}, attemptTimeoutMs ${before.attemptTimeoutMs} -> ${after.attemptTimeoutMs}`
  appendLog(`apply ${summary}`)
  ctx.logger?.info?.(`dsh-net-opt: ${summary}`)

  ctx.effect(() => () => {
    net.setDefaultAutoSelectFamilyAttemptTimeout(before.attemptTimeoutMs)
    net.setDefaultAutoSelectFamily(before.autoSelectFamily)
    appendLog(`dispose restore autoSelectFamily=${before.autoSelectFamily} attemptTimeoutMs=${before.attemptTimeoutMs}`)
  }, 'dsh-net-opt: restore net defaults')
}
