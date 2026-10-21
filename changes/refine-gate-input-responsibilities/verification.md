# 验证记录

本文件记录本 Change 的实际结果、证据归属和未覆盖边界。实施提交为 `e933fdfb`；下述完整 Gate 与对照测量均由独立验证代理在 task-only 隔离工作区执行，本优化代理读取原始结果并整理，不冒称在主工作区重跑。

本地证据根为 `.log/vibe-check/refine-gate-input-responsibilities-20261021/`：`tests/handoff.md` 承接领域实现与直接测试，`inputs/handoff.md` 承接输入闭包，`verification/handoff.md` 及同目录 JSON/stdout 承接正式 Gate、ABBAAB 和实验控制，`optimization/handoff.md` 承接 AI 阅读与编码规范核对。

## 实施与责任闭合

- 两领域仅在搜索成功分支动态加载既有 renderer，CLI、诊断和失败路径不变；决策记录 8 个搜索节点移入现有 public-distribution，测试函数体、名称和断言保持不变，公开聚合继续加载全部节点。
- 公共输入按实际加载闭包声明；validate 区分 SKILL.md 内容与布局身份，generated-file 消费临时 fixture/实现闭包，公共工具独立测试归实际消费者。领域构建保留必要保守输入，宽消费者保持完整材料。
- 当前工作区调查报告 collection 中另一会话的历史查询测试真实消费源/生成 CLI；本轮补齐相关订阅和统一生成前置，测试本身不纳入任务提交或隔离快照。
- 全局输入契约与 cache 路径同步为 v5。原生 learned 调度、每轮材料政策、receipt 事务、完整 Case source fingerprint 和统一生成 provider 保持不变。
- Case/生成/owner 已同步；主协调者通过公开入口同步完整索引，再用 `stage-index` 仅接纳本任务 15 个 Case 的条目。任务提交排除外来版本控制实现、历史查询测试/Case、调查报告/索引和无关 skill 版本；混合文件按 hunk 归属隔离。
- 阶段独立审查 PASS，无剩余实现阻断。稳定输入及接入知识已回到 `docs/tooling.md` 与 `docs/gate-check-authoring.md`；本轮沿用既有执行、输入证明与生成决策。

## 直接验证

领域实施者在主工作区逐容器独立进程执行，结果来自 `tests/native-*.log`：

| 入口 | 结果 |
| --- | --- |
| 决策记录 lifecycle-and-recovery | 129 pass / 0 fail |
| 决策记录 query-and-index-projection | 32 pass / 0 fail |
| 决策记录 public-distribution | 64 pass / 0 fail |
| 调查报告 collection-and-resources | 63 pass / 0 fail，该次执行含当时未提交的外来历史查询节点 |
| 调查报告 cli-contract | 67 pass / 0 fail |
| `bun run test:decision-records-cli` | 298 pass / 0 fail |

输入实施者的 `inputs/test-check-final.log` 记录 `bun run test:check` 63/63，其中 impact 回归 29/29；另已通过 typecheck、lint、format:check。早期合并多个 wrapper 的探索失败与外来调查索引陈旧探针保留在领域 handoff，未被误算为最终官方入口结果。

## 正式完整 Gate

`verification/00-B-formal-full.json` 与对应 stdout：在 task-only tree `7c60688be028ee20e1f3e2f951d632668c919fb9` 执行 `bun run check`，退出 0，61 passed、0 failed、3 release-only not-applicable。52 项项目命令全部执行，reuse 0、firstRun 52、fallback 0；包含生成一致性、完整 Case 引用/覆盖及项目质量检查。

外部墙钟为 65.432 秒，仅说明该完整 base Gate 通过，不与后述增量场景比较，不作为性能收益。实施提交 `e933fdfb` 与该 tree 相同；本文件最后补记及全勾完成态尚需主协调者在同一隔离流程结算后保存和 finalize。

## 共享 renderer 对照

同机按 ABBAAB 顺序，每版三个 modified 样本。A 为计划提交 `6ea032fea1305506f9f5a64c8566477cdd2a7092`，B 为上述 task-only tree；私有 HEAD 保持 A，原始 JSON 的 tree 才标识实际输入。每块先 warm、确认 unchanged 的项目执行数为 0，再修改共享 renderer 源码并通过公开 sync 更新两领域分发副本。计时 `bun run check`，sync 不计入样本；完整 manifest 和六份 `0*-modified.json` 保存原始控制与结果。

六次 modified 均退出 0，所选项目命令原因均为 `inputs-changed`，firstRun/fallback 均为 0。A 每次执行 13、复用 39；B 每次执行 7、复用 45。

B 比 A 少执行的六项为 `script:validate`、`script:test:generated-file`、`script:check:decisions`、`script:check:investigations`、`test:decision-records:lifecycle-and-recovery`、`test:decision-records:query-and-index-projection`。必要的统一生成、Case catalog、typecheck/lint/format、DR public 与 IR CLI 仍实际执行；IR collection 保持复用。

| 指标（秒） | A 三样本 | B 三样本 | 均值变化 |
| --- | --- | --- | --- |
| 外部墙钟 | 20.125 / 17.485 / 22.001 | 14.774 / 13.487 / 19.708 | 19.870 → 15.990，少 3.881（19.53%） |
| 子进程 CPU（user + system） | 69.277 / 57.298 / 64.290 | 46.330 / 43.292 / 45.180 | 63.622 → 44.934，少 18.688（29.37%） |

原生材料每轮结算，不包含在 52 项项目 execute/reuse 数中；资源/调度政策未变。CPU 为 Python wrapper 的 RUSAGE_CHILDREN user+system 差值，不含 wrapper 自身。全部样本保留，额外 diagnostic 样本不混入 ABBAAB 均值。

局限：仅三个样本/版且墙钟范围重叠；末次 B 与后续诊断墙钟明显走高，而子进程 CPU 未同步增加。期间其他会话更新主工作区 history，并使 DR/IR SKILL 新增 dirty，测量窗口内主 HEAD/index/receipt 前后未变。这不是全局静默实验，无法分别归因各项调整的贡献，观测降幅不代表稳定性能保证。

## 独立优化与完成边界

- AI 实际阅读任务可从三份 artifacts 恢复 Outcome、实施范围、依赖、owner、验收和剩余动作；Outcome 点名两项 Check，输入规则留在稳定 owner。
- 编码规范核对确认新增仅输入表/订阅和成功输出边界的直接加载，无额外 helper、层次或框架；无必要代码整改。优化只整理文档表达。
- 本优化代理实际运行公开 Change `check --json` 与定向 `git diff --check`，通过；最终统计/选择和验证 handoff 已由正确性 reviewer 独立复核 PASS（证据根下 `review/handoff.md`）。三份 artifacts、稳定 owner 及本文件的验收事实/局限已对齐，11/11 业务任务完成。
- 本次验证环境为 Linux、Node v26.8.2、Bun 1.4.2、pnpm 11.7.0；未重跑 CI、其他 OS/Node 组合或 release 打包。未把主工作区未提交外来改动作为已验证产品提交，未证明全局静默或外来字节始终未变。
- 完成态保存和 `finalize` 是后续结项动作，不作为业务验收 checkbox 的循环前置；当前没有需要用户补充的产品选择。
