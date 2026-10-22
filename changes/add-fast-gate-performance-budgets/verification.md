# 验收证据

本 Change 的业务验收已完成。以下结果由主代理执行，本次完成态整理重新读取日志、退出码、machine 摘要及最终源码核对；测量只代表本机软件与负载，不是跨机器性能 SLA。

## 真实入口验收

日志位于 `.log/gate-profiles-20261022/acceptance/`；表中墙钟采用终端最终采样，单位 ms。

| 入口及日志 | 实际结果 | 总墙钟 | 证明边界 |
| --- | --- | --- | --- |
| `bun run check:changed`，`changed-accepted.log` | exit 0，61 项 passed，3 项 release-only 未激活 | 65943.983665 | 53 项项目证明发布；完整变更验收通过，不强制 quick 预算。 |
| 紧接 `bun run check`，`quick-accepted.log` | exit 0，5 项实际通过、5 项精确复用 | 4492.318364 | P90 2558.168016、mean 744.045269，预算通过；receipt 前后 SHA 文件 cmp 相同。 |
| `bun run all`，`all-accepted.log` | exit 0，8 项实际通过、53 项证明复用 | 6397.067033 | all 与 changed 别名和第三真实入口环境一致性成立；项目命令无新增执行。 |
| `bun run check --tag release --cold`，`release-cold-accepted.log` | exit 0，64 项 passed，含版本授权和打包 | 85443.150332 | 本地完整 release 通过；没有远端发布，不对该范围强制 quick 预算。 |

changed invocation 为 `20261022T103804034Z-1338c98f-e7f1-4f50-a454-6ed6c56fd58c`；同轮 `test:check` transcript 记录 87 tests、87 pass、0 fail、0 skipped。其他 invocation 可由对应日志恢复。quick 首写 machine 墙钟为 4491.672003，末次复核终端为上表数值；均通过，按当前合同无需重写成功报告。

负向真实证据：`quick-before-changed.log` 的原生 10 项全部通过，但 total 22848.276841、P90 15437.121219、mean 5365.452223 触发预算失败，exit 1；该轮 receipt 前后 SHA 同样 cmp 相同，证明质量通过不绕过预算且 quick 不发布。

## 任务与证据对应

- **0.1–0.3 / 1.1–1.2**：最终 `profiles`、Definition/原生条件、CLI parser、启动 PATH、性能政策与输出、receipt 接线对照设计核对；保留 64 个稳定 ID、原生依赖/资源及 base/release learned identity。直接测试覆盖 scope/CI/release 选择、精确阈值、nearest-rank、null/真零、缺失/非法测量、晚报告跨限与按 scope 区分的报告 I/O 失败。
- **1.3 / 2.1–2.2**：最终 changed 实际运行 `test:check`、typecheck、lint、format:check、validate、Case/index 检查，以及 file/function metrics，全部通过。Case 实体覆盖 1332 项；这是账本引用/覆盖证据，不表示全部 1332 项逐个执行。PATH 节点归 CLI input-closure owner，原生实体路径与 Case/index 已同步。
- **1.4 / 2.5**：AGENTS、tooling、Gate 接入约定和 Decision 当前行为一致；前序已归档，两个 active 普通当前 owner 链接已修复。主要实现由 6.1sol 完成；主代理已审计独立正确性审查、定向修复复核、AI-ready 与编码规范优化结果，无遗留 P1/P2。Decision 完整方向对照落地核对后，已通过公共 `mark-aligned` 标记对齐并同步索引。
- **2.3–2.4**：上表覆盖 quick、changed→quick 精确复用、all 真实入口和冷 release。CI/full 参数与全量策略有直接测试及静态审查；本轮未运行真实 CI runner 或 Windows。

## 已知边界

- 初次质量指标阻断已按真实职责修复，最终 file/function metrics 均通过；未放宽阈值，未修改安装依赖。
- 已只读定位安装版 0.0.4 Markdown lint 计算 facts cache 的 metadata 解析问题；本次未修复，不影响已取得的成功 receipt 精确复用证据，不在此 Change 扩展为上游修复。
