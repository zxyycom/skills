# Proposal

本 Change 从 release Gate 的执行架构消除重复测试进程和重复测试文件成本，纠正把产品语义测试历史性留到 full 的 catalog 分层，并为完全相同的本地输入复用成功测试证明；冷运行成本与证明命中时延分别衡量。

## Why

最近三次原始 full 运行分别为 49.3、42.0 和 45.3 秒。逐 Check 启动 Bun 会重复初始化运行时和模块图，同一测试文件还可能被 semantic Check 与 package script Check 重复执行。另一方面，28 个原 release-only Check 中有 23 个是普通产品行为测试、两个是普通工具测试；其归类来自旧 quick/full profile，而不是 release 语义，导致高价值反馈被无理由推迟。

审查前的严格批次仍需执行 34 个容器、704 个测试，约 20.6 秒；删除两个无独立价值的规模入口并移出一个性能基准后为 701 个测试，但受 Git/事务集成工作主导，完整 cold Gate 仍不能稳定压到约 20 秒。用户已允许本地在内容、工具链与环境完全相同时复用成功测试证明，但要求 CI 或显式 cold 始终重跑，并且不得把命中时延冒充真实测试成本下降。

## Outcome

Release 对唯一测试文件并集使用四个独立 Bun 进程的固定分区执行，59 个 base Check 依据 owner impact 精确选择；本地 exact proof 命中低于 20 秒，CI/cold 保留完整真实测试成本和 fail-closed 语义。

## Scope

### Intended Change

- 为无生成前置的 Bun 测试维护显式文件映射、四进程固定分区、唯一执行、JUnit 投影与完整 transcript。
- 把产品语义测试和两个普通工具测试纳入 base impact contract；只有 snapshot、version authorization 与 packaging 保持 release-only。
- 移除重复的 `test:test-evidence-project` Gate leaf，但保留稳定人工聚合脚本。
- 保存和验证完整 workspace/toolchain/environment/catalog 身份的批次成功证明，增加 `--cold` 并让 CI 显式 cold。
- 删除不触发独立行为分支的 Test Evidence 10,000-entry 与 Investigation 1,000-report 用例，把组合查询缩到分页断言所需的 13 项，并将显式 Index Runtime 性能基准移出 Gate；保留真实的第 1001 项分页边界。
- 不缓存失败、不做部分复用、不省略 Node/生成前置/原生扫描/release 交付 DAG，也不在项目层复制 Vibe 原生 scanner。

### Resulting Impacts

- 完整 Definition 从 63 项变为 62 项：59 项 base impact contracts 与三项 release 交付 Check；语义 Check 继续按 `3/5/5/8/5` 的 Contract/失败 owner 分组。
- Release 批次 leader 独占四个 `cpu-work` units；其余投影 Check 不申领资源，非批次工作保留既有 claim。
- 每份分区 JUnit 都必须精确覆盖自己的文件，合并后恢复原 Check outcome；报告或进程异常 fail closed。
- Proof 命中、fresh、cold、unavailable 进入机器摘要和 transcript；缓存不可用只扩大执行，不改变质量结论。
- 测试实现变化同步 Test Evidence Case/index，长期执行与复用边界同步 Decision 和工具链 owner。

## Success Criteria

- 冷 release 对文件并集只执行一次，每个文件只属于一个独立进程分区；单个 suite 失败只使引用它的原 Check 失败，基础设施或报告异常 fail closed。
- 完全相同的本地 release 不启动分区测试进程并在约 20 秒内完成；`--cold` 与 CI 始终真实重跑，且单独报告冷成本。
- 默认增量 Gate 可按 owner 选择全部产品语义测试，warm 不增加固定成本。
- 目标测试、Change Plan、Test Evidence/Decision 索引、typecheck、lint、format、默认 Gate、cold 与 cached release 均通过。

## Affected Owners

- `scripts/lib/vibe-gate.ts`、`scripts/lib/vibe-gate/release-test-batch*.ts`、test support、impact/resource/package/semantic catalogs 与 CLI/workflow。
- `tools/test-evidence/tests/core.test.ts`、`tools/decision-records/tests/stage.test.ts`。
- `docs/tooling.md`、Gate 决策与 `docs/test-evidence/cases/`。
