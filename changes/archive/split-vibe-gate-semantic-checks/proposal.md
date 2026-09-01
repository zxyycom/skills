# Proposal

将 Vibe Gate 的测试 Check 从按命令与成本混合的调度单元，收敛为按所证明契约和失败 owner 命名的稳定语义单元；本计划只定义后续实施与验证范围。

## Why

当前 `scripts/lib/vibe-gate.ts` 将 package script 直接注册为 Check，并把部分完整领域测试放入 `fullOnlyGatePackageScriptSet`。该集合既混合领域行为、共享版本控制与生成物测试，也不能从名称恢复失败应交给的 owner；现有注释还将顺序说明为 cost-aware scheduler hint。结果是 profile 的含义、Check 的证明责任和 machine publication 的稳定身份彼此混淆。

若为了并行或耗时均衡继续拆分，会把同一契约拆成脆弱的小组；若保持每个工具一个测试 Check，又会让 CLI、领域事务、Git pending 暂存和分发制品失败落到同一个不可行动的结果。本 Change 要以语义而非性能解决这两个问题。

## Outcome

`bun run check` 的每个领域测试 Check 都能从稳定 ID、直接重跑命令和维护说明恢复其证明的契约、包含的测试入口以及失败后的 owner；default/full 继续表达日常反馈与完整发布覆盖，但 profile 成员资格不再充当 Check 语义；release hash/version 检查与打包保持显式的先后依赖。测试入口、文档证据与长期决策记录能够随新的 Check catalog 维护，而性能只作为不退化的验证信号。

## Scope

### Intended Change

建立 Vibe Gate 的显式语义 Check catalog，并据此重组 Vibe definition、测试入口与说明。catalog 按 owner 与契约边界覆盖 decision records、change plan、task graph、investigation report 和 test evidence；每个 Check 使用稳定 machine-facing ID 和固定参数数组。现有聚合 package scripts 继续作为人工完整运行入口，不再决定 Gate 的 Check 粒度。

将当前聚合 runner 中阻止独立运行的测试整理为可由对应语义 Check 单独选择的入口，尤其处理 `tools/test-evidence/tests/run.ts` 同时承载自身 case 与导入全部 ledger test 文件的问题。将 release version/hash 检查置于 packaging 前的显式依赖链，而不是以 profile 或耗时暗示其责任。语义拆分前属于 default 的测试覆盖仍属于 default，原 full-only 测试覆盖仍属于 full；本 Change 不借拆分扩大或缩减 profile 的验证集合。

### Resulting Impacts

- `scripts/lib/vibe-gate.ts`、`scripts/vibe-check.ts` 及其测试必须从 catalog 生成或校验稳定 Check ID、profile 选择、依赖和 machine publication，不保留按耗时归组的领域测试集合。
- 各领域测试命令、`run.ts` 或新增的测试入口必须只聚合一个完整语义契约；同一测试可以因真实共享契约被显式引用，但不得为均衡耗时重复执行。
- 共享的 index runtime、relation graph、version control、原生 runtime/store 与生成物边界必须保持独立 owner；源码消费关系用于后续缓存失效和验证选择，不自动成为 Gate 运行依赖，也不复制基础测试。
- release 版本/hash 与 `pack:skills` 的阻断、诊断和只执行一次的行为必须在 catalog 和 Vibe tests 中保持可验证。
- `docs/tooling.md`、相关 skill/owner 文档、测试证据 topic/case 和达到门槛的 Decision Records 必须说明新的责任边界；缓存 Vibe Gate 结果的独立 Change 只可作为后续关系说明，不复制或实施其设计。

## Success Criteria

1. catalog 中每个 Check 明确稳定 ID、显示名、固定命令和适用 profile；ID、命令选择与维护说明共同给出单一证明契约和失败 owner，没有以预计耗时或并行度作为分组理由，也没有把说明性字段复制成运行时配置。
2. decision records、change plan、task graph、investigation report 与 test evidence 的领域、CLI/协议、事务或 pending-stage、分发边界能独立运行；`test-evidence` 不再因单一 `run.ts` 自动混入所有 ledger 测试。
3. 语义拆分保持现有 default/full 测试覆盖关系；full 继续包含 default、原 full-only 完整验证和 release version/hash、最终打包，且 `pack:skills` 只在全部前置成功后运行一次。
4. Check ID 与 Vibe machine publication 的记录键稳定、唯一、可由 catalog 映射；显示顺序、调度并发和缓存命中不改变证明语义。
5. 测试证据账本覆盖本次保留或新增的最小原生测试入口；文档和必要的长期决策可从 owner 位置恢复 catalog、profile 和 release 责任。
6. 验证证明语义选择正确，并记录拆分前后的运行次数或范围以防止无意重复执行；不以绝对耗时、均衡分片或性能提升作为验收条件。

## Affected Owners

- `scripts/lib/vibe-gate.ts`、`scripts/vibe-check.ts` 与其测试：Vibe Gate catalog、profile、依赖、machine publication 与 release terminal owner。
- `package.json`、领域测试入口和 `tools/*/tests/`：可独立选择的测试容器与 package script owner。
- `tools/decision-records/`、`tools/change-plan/`、`tools/task-graph/`、`tools/investigation-report/`、`tools/test-evidence/`：各领域契约与分发边界 owner。
- `tools/index-runtime/`、`tools/shared/`：派生状态、关系、version-control 与原生运行时的共享 owner。
- `docs/tooling.md`、相关 `SKILL.md`/references、`docs/test-evidence/`、`docs/decisions/`：维护说明、测试证据和长期取舍 owner。
