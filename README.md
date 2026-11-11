# dsh-net-opt

DSH（DeepSeek Harness）宿主插件：解决 provider 请求「连接经常失败」的问题。

## 已验证解决的问题

`opencode-go` 在慢速链路上经常连不上，宿主报 `Connection error.`（`TRANSPORT`），每次失败耗时稳定在约 0.5s（默认参数下实测约 1/10 成功）。

装上本插件后，同一链路连发 7 次请求全部成功、零重试（`deepseek-v4.1-flash` 与 `qwen3.8-flash` 各若干次）。原因是 Node 的 Happy Eyeballs 只给每个候选地址 250ms 建连窗口，而这类链路上 IPv4 握手常需更久，连接还没建立就被放弃；调宽窗口后即恢复正常。

## 可能同样受益的供应商

除 `opencode-go` 外，符合以下特征的 provider 也可能被同一个问题影响：

- 端点有 AAAA 记录，而本机没有可用 IPv6 路由（或 IPv6 质量差）；
- 到该端点的 IPv4 建连耗时超过 250ms：跨境、移动网络、Cloudflare 等边缘节点常见；
- 失败表现是 `Connection error.` / `TRANSPORT`，且耗时稳定在约 0.5s（2×250ms）。

判断方法：装上本插件后对比同一供应商的失败率，失败率明显下降即为受益者。目前实测确认的是 `opencode-go`，其他供应商未逐一验证。

## 安装

```powershell
dsh plugin --profile desktop add github:NEVSTOP-LAB/dsh-net-opt#v0.1.0
```

装完重启 DSH 生效。需要改行为时，在 profile 的 `cordis.patch.yml` 里按 id `dsh-net-opt` 覆盖配置。

## 配置

| 参数 | 默认 | 说明 |
|---|---|---|
| `attemptTimeoutMs` | 3000 | 单个候选地址的建连窗口 |
| `disableAutoSelectFamily` | false | 直接关闭自动选择 |

## 验证与回退

- 生效证据：`$DSH_HOME/logs/dsh-net-opt.log` 出现 `apply ... attemptTimeoutMs 250 -> 3000`；
- 回退：`dsh plugin --profile desktop remove dsh-net-opt`，或把 `attemptTimeoutMs` 改回 `250`。
