# 自验证证据

本目录保存本次实施的命令、完整短期日志与失败边界；不作为长期行为规范。`native-quality.mjs` 的相对 import 已随归档位置调整，`queue-mutation.mjs` 补上 rerun 输出目录建立；其余实现不变，日志保持当次原文。

## 最终通过证据

- `bun run typecheck`、`bun run lint`：通过。
- `bun run sync:decision-records-cli`、`bun run sync:investigation-report-check` 及两个对应 `check:*`：通过。
- `bun run test:decision-records-cli`：385/385，见 `decision-records.log`。此时规模节点仍执行 1000 次完整 journal，更名实测成功；后续仅将该测试降至真实领域计划与共同只读阶段，运行时函数体没有改变。
- `bun run test:investigation-report-check`：最终单域 374/374，见 `investigation-report-final.log`。
- `node --test --test-concurrency=1`，目标为 DR 的 `record-shared-transactions`、`transaction-strict-preparation`，IR 的 `strict-preparation`、三个 `*-phase-verification`、`transaction-domain-boundaries`：36/36，见 `native-node-final.log`。
- `bun run sync:test-evidence-catalog`、`bun run check:test-evidence-catalog`：最终 1488 个实体引用与覆盖通过；`bun test scripts/vibe-check-semantic-catalog.test.ts scripts/lib/vibe-gate/impact-input-ownership.test.ts`：4/4。
- 三项项目原生质量构造器（完整 maintained 输入、原限值与 policy，非完整 Gate）：duplicate/file/function 均 passed，零 finding；见 `native-quality.log` 和复现脚本。

## 旧缺陷敏感性

`node changes/align-record-rename-verification/evidence/self-verification/queue-mutation.mjs` 在独立副本先运行规模节点基线，再仅将 `verifyPlan` 回退为逐 write 的 `phase.verify` 与 guards-only `verifyMany`。基线 1 pass；变异在完整队列断言以 `[0,1003]` 不等于 `[1003,1003]` 失败，而非初始化错误。见 `queue-baseline.log`、`queue-mutant.log`。隔离副本由 finally 精确删除，未改共享工作区源码。

## 保留的失败与范围

- 新规模节点曾因前置 title 仅两汉字而初始化失败，修正为合法四字标题；该失败不是产品缺陷。
- 早期 1000 次完整 journal 节点出现默认 5s 和一次局部 30s 超时；后续完整执行也曾通过 7.76/12.29/13.00s。三重自验时 Node 的同节点再次 30s cancelled，见 `native-node.log`；不能把负载猜测当作确定原因。长期保留测试改为最小充分边界，没有提高全局或 Gate timeout。
- 首次并行 IR 全域为 371/373，见 `investigation-report.log`：一个生成 Node CLI 节点 5s 超时，紧邻失败的 stack 仍指向该超时异步体。相应两节点隔离 2/2 通过，见 `isolated-ir-failures.log`；最终单独全域通过。未因此声称已经证明全部 runner 并发根因。
- 中间新增断言曾错误要求诊断保留路径明文，既有安全输出实际脱敏为 `[redacted]`；最终只断言稳定失败类别并核对外部资源与待删报告。

## 临时物归宿

两份超时遗留 fixture 在确认无测试进程后，以完整成员、普通文件、ID、标题和本测试独有正文核对归属，再精确删除；详见 `cleanup.json`。本次自验 `.tmp/align-record-rename-verification-selfverify` 已整体归档于此，独立 mutation 副本亦已删除。未触碰其他任务的临时目录。最终完整 Gate 与独立性能证据由各自 owner 结算。
