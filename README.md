# dsh-net-opt

DSH（DeepSeek Harness）宿主插件：把 Node 的 Happy Eyeballs 单地址尝试窗口从 250ms 调宽，避免慢链路上 IPv4 握手被过早判死。

## 问题

Node 默认 `autoSelectFamily=true`、`autoSelectFamilyAttemptTimeout=250`：每个候选地址只有 250ms 建连窗口，超时即换下一个。慢链路上到边缘节点的 IPv4 握手常需 0.3–2.3s，候选地址耗尽后连接以 `ETIMEDOUT` 结束，宿主侧表现为 `Connection error.`（`TRANSPORT`）与整轮失败。

典型现场：

- 目标主机同时有 A 与 AAAA 记录，但本机没有 IPv6 路由（AAAA 尝试瞬间 `ENETUNREACH`）；
- 每次失败耗时约 2×250ms（两个 IPv4 候选各占一个窗口）；
- 关闭自动选择或强制 IPv4 后成功率恢复，说明连接本身可用，是过早放弃。

## 行为

插件挂载时改进程级 `net` 默认值，对 `net.connect` 与全局 `fetch`（undici）同时生效，因此与 DSH 的启动方式无关：

- `attemptTimeoutMs`（默认 3000）：单地址尝试窗口；
- `disableAutoSelectFamily`（默认 false）：设为 true 时直接关闭自动选择。

卸载或停用时恢复挂载前的原值。启动证据写在 `$DSH_HOME/logs/dsh-net-opt.log`。

## 安装

```powershell
dsh plugin --profile desktop add github:NEVSTOP-LAB/dsh-net-opt#v0.1.0
```

插件自带 bundle patch，装完即挂载；改行为在 profile 的 `cordis.patch.yml` 里按 id `dsh-net-opt` 覆盖，不重复写 insert。

## 验证

- `$DSH_HOME/logs/dsh-net-opt.log` 有一行 `apply autoSelectFamily ... attemptTimeoutMs 250 -> 3000`；
- 用会走慢速链路的 provider 连跑数轮请求，不再出现成串 `TRANSPORT`；
- 同一主机上对比：`node -e "console.log(require('net').getDefaultAutoSelectFamilyAttemptTimeout())"` 在宿主进程内应返回配置值。

## 回退

```powershell
dsh plugin --profile desktop remove dsh-net-opt
```

或把 profile 补丁条目的 `attemptTimeoutMs` 调回 `250`。

## 边界

- 只影响新建立的连接，已建立的连接不受影响；
- 调宽窗口会让「确实不可达的候选地址」多占用时间；本插件默认值 3000ms，保持 Happy Eyeballs 算法本身不变；
- Node 缺少 `net.setDefaultAutoSelectFamilyAttemptTimeout`（低于 20.13）时插件跳过并告警。
