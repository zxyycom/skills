# Proposal

将 Vibe Check 升级至 0.0.4，以原生执行和智能调度承接 Gate，精简项目自建结构并保持质量保证。
从本文了解目标与范围，按 [design.md](design.md)实施，以 [tasks.md](tasks.md)恢复进度。

## Why

基线使用 0.0.2。新版增加原生命令检查和类型化私有交接，并调整回调、文件选择、聚合及调度 API。
现有批次结果转换和重复生成检查可由原生执行与统一生成入口承接；
昂贵项目命令的安全复用仍需要项目声明完整输入并保存成功依据。

## Outcome

`bun run check` 使用精确 0.0.4，保持唯一权威入口。Vibe 负责执行、依赖、智能调度和材料检查，
项目负责领域验收、完整输入成功证明和发布事务；项目自建结构均有明确缺口与最小责任。

## Scope

### Intended Change

| 方面 | 预期变更 | 目标 |
| --- | --- | --- |
| 依赖与 API | 固定 0.0.4 及 lock，适配实际调用方。 | 类型、参数、运行结果和 CLI 消费符合新版契约。 |
| 执行 | 使用原生构造器、领域函数及独立 commandCheck。 | 减少自有执行与结果转换层，保留独立归因和重跑能力。 |
| 调度 | 继续使用原生 learned critical-path helper。 | 随任务和耗时变化持续优化顺序，保持资源及隔离边界。 |
| 输入与复用 | 项目命令使用最小完整输入成功证明；原生材料检查每次结算。 | 可靠省略已通过且输入相同的工作，按原生能力复用计算事实。 |
| 发布 | 使用 typed handoff 交接同一授权快照。 | 准备、授权、打包的输入一致，失败可靠阻断。 |
| Check 组成 | 归并八项重复生成检查，增加 Markdown 和三项 MCPShell 离线结果。 | 消除重复执行，补齐内容及离线行为覆盖。 |
| 指标 | 逐条归因并处理新版五条阻断。 | 保持质量阈值和可信结果。 |
| 测试分层 | 逐项审计调查报告和决策记录的全部最小原生测试，将独立规则下沉至轻量领域函数或纯函数。 | 每个原入口有覆盖去向与层级理由，必要真实边界继续验证。 |
| 交接与验收 | 同步项目测试、证据账本、文档和必要决策，测量完整 Gate。 | 实现与维护说明一致，验证项目接入和反馈成本。 |

### Resulting Impacts

- Check 预期由 68 项形成 64 项；每项原有义务的后继、重跑入口和前置关系由[清单](gate-inventory.md)承接。
- 执行方式变化影响输入声明、成功证明身份、调度历史可比性及 release 接线；按 design 保守处理。
- 指标和反馈成本整改限定在已定位的源码 owner，保持现行行为、输入闭包与质量政策。
- 测试分层影响两领域测试、必要最小规则函数导出、生成物和独立版本；保持领域行为与公开业务契约，不扩大产品 CLI 整体架构。
- 逐项去留证据与临时生命周期由 design 承接，[升级证据](upgrade-evidence.md#测试分层结果)汇总实施结果；Case/index 仍为长期测试证据 owner。
- Vibe 保持根开发依赖，skill 业务、TS 分发架构和远端发布协议保持现状。

## Success Criteria

1. 精确 0.0.4 的 frozen-lock 安装、类型检查及实际 Node/CLI 调用通过。
2. 清单中的质量义务、环境前置、生成前置及领域重跑入口完整；新增结果独立可定位。
3. 只有完整输入精确命中的项目 Check 可省略；原生材料、环境及 release 实际执行。
   成功证明仅在最终 Run 成功且输入无漂移时发布，未知输入保守执行。
4. 发布消费同一授权快照，私有交接与机器摘要分离，取消、失败及输出异常保持阻断。
5. 原生智能调度使用可比较的任务身份和可丢弃本地历史，资源与 version-control 隔离边界保持。
6. 五条指标完成逐项归因和处置，质量阈值及阻断政策保持。
7. 在同机记录无输入变化、单 owner、共享 owner 与冷 release 的完整 Gate 及资源成本，比较测试分层前后工作量。
   已测无变化 <10s、MCPShell ≤15s 保留为基线；共享场景按逐项明确的真实验证义务验收，统一 ≤15s 不再作为扩范围或结项硬门槛。
8. 调查报告和决策记录的每个原最小原生入口都有覆盖后继及保留、下沉、合并或删除理由；
   独立规则在最小充分层级验证，真实 Git 索引、原子性、路径漂移、命令分发及失败语义保留或补强。
   审计、Case/index、领域自验证和独立正确性审查相符。
9. 受影响项目测试、生成物、独立版本及维护文档一致；测试调整后重新取得最终 base、冷 release 与必要 Node 证据，明确实际覆盖边界。

## Affected Owners

- 根 `package.json`、`pnpm-lock.yaml`：版本与可复现安装。
- 根 `tsconfig.json`：原生 incremental 编译事实，保持完整类型检查范围和质量选项。
- `scripts/vibe-check*.ts`、`scripts/lib/vibe-gate/`：Gate、项目测试及输入成功证明。
- `scripts/lib/skill-runtime.ts`、`scripts/build/`：统一生成前置的现有行为依据。
- `scripts/lib/source-runtime.ts`、`scripts/test-evidence/snapshot*.ts`：实测关键路径中同次调用的重复事实采集。
- `tools/investigation-report/`、`tools/decision-records/`：逐项测试层级、必要规则函数导出及对应分发生成物/版本。
- 五条指标对应的源码位置见[指标证据](upgrade-evidence.md#指标差异)。
- [工具链](../../docs/tooling.md)、[Check 编写入口](../../docs/gate-check-authoring.md)、
  [测试证据](../../skills/test-evidence-review/SKILL.md)：稳定说明及 Case/index。
- [原生执行与成功证明](../../docs/decisions/native-gate-execution-and-project-receipts.md)、
  [统一生成前置](../../docs/decisions/unify-gate-generated-artifact-prerequisite.md)、
  [批次历史](../../docs/decisions/archive/batch-release-test-execution.md)、
  [资源隔离](../../docs/decisions/retain-release-version-control-isolation.md)、
  [环境前置](../../docs/decisions/require-gate-environment-check-prerequisite.md)、
  [指标阻断](../../docs/decisions/block-code-quality-metric-findings.md)决策：按实际契约变化演进。
