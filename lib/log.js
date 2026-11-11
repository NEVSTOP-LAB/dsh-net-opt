/**
 * 插件启动日志：宿主不落盘 stdout，一次激活写一行，便于事后确认挂载与生效值。
 * 写入失败不影响插件加载。
 *
 * @module dsh-net-opt/log
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * `$DSH_HOME/logs/dsh-net-opt.log`，未设置 DSH_HOME 时回退到 `~/.dsh`。
 */
export function defaultLogPath() {
  const home = typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME.length > 0
    ? process.env.DSH_HOME
    : join(homedir(), '.dsh')
  return join(home, 'logs', 'dsh-net-opt.log')
}

/**
 * 追加一行带时间戳的日志。
 * @returns 写入是否成功。
 */
export function appendLog(line, path = defaultLogPath()) {
  try {
    mkdirSync(dirname(path), { recursive: true })
    appendFileSync(path, `${new Date().toISOString()} ${line}\n`)
    return true
  } catch {
    return false
  }
}
