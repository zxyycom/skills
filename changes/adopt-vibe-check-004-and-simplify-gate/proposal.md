# Proposal

将 Vibe Check 升级至 0.0.4，以原生执行和智能调度承接 Gate，精简项目自建结构并保持质量保证。
从本文了解目标与范围，按 [design.md](design.md)实施，以 [tasks.md](tasks.md)恢复进度。

## Why

项目使用 0.0.2。新版增加原生命令检查和类型化私有交接，并调整回调、文件选择、聚合及调度 API。
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
| 交接与验收 | 同步项目测试、证据账本、文档和必要决策，测量完整 Gate。 | 实现与维护说明一致，验证项目接入和反馈成本。 |

### Resulting Impacts

- Check 预期由 68 项形成 64 项；每项原有义务的后继、重跑入口和前置关系由[清单](gate-inventory.md)承接。
- 执行方式变化影响输入声明、成功证明身份、调度历史可比性及 release 接线；按 design 保守处理。
- 五条指标可能要求调整对应源码；范围限定为完成归因和保持现行行为所必需的整改。
- Vibe 保持根开发依赖，skill 业务、TS 分发架构和远端发布协议保持现状。

## Success Criteria

1. 精确 0.0.4 的 frozen-lock 安装、类型检查及实际 Node/CLI 调用通过。
2. 清单中的质量义务、环境前置、生成前置及领域重跑入口完整；新增结果独立可定位。
3. 只有完整输入精确命中的项目 Check 可省略；原生材料、环境及 release 实际执行。
   成功证明仅在最终 Run 成功且输入无漂移时发布，未知输入保守执行。
4. 发布消费同一授权快照，私有交接与机器摘要分离，取消、失败及输出异常保持阻断。
5. 原生智能调度使用可比较的任务身份和可丢弃本地历史，资源与 version-control 隔离边界保持。
6. 五条指标完成逐项归因和处置，质量阈值及阻断政策保持。
7. 实测无输入变化、单 owner、共享 owner 与冷 release；日常反馈 <10s、较重 owner ≤15s。
   冷 release 单独报告完整执行成本。未达标准时继续处理具体瓶颈。
8. 受影响项目测试、Case/index 和维护文档一致；验证对象与证据符合 design 的边界。

## Affected Owners

- 根 `package.json`、`pnpm-lock.yaml`：版本与可复现安装。
- `scripts/vibe-check*.ts`、`scripts/lib/vibe-gate/`：Gate、项目测试及输入成功证明。
- `scripts/lib/skill-runtime.ts`、`scripts/build/`：统一生成前置的现有行为依据。
- 五条指标对应的源码位置见[指标证据](upgrade-evidence.md#指标差异)。
- [工具链](../../docs/tooling.md)、[Check 编写入口](../../docs/gate-check-authoring.md)、
  [测试证据](../../skills/test-evidence-review/SKILL.md)：稳定说明及 Case/index。
- [增量](../../docs/decisions/incremental-vibe-gate.md)、
  [批次历史](../../docs/decisions/archive/batch-release-test-execution.md)、
  [资源隔离](../../docs/decisions/isolate-release-version-control-resource-boundary.md)、
  [环境前置](../../docs/decisions/require-gate-environment-check-prerequisite.md)、
  [指标阻断](../../docs/decisions/block-code-quality-metric-findings.md)决策：按实际契约变化演进。
