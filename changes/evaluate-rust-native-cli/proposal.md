# Proposal

以 Decision Records 查询命令为试点，比较现有 TS 调用与 Rust 原生 CLI 的完整任务成本，为是否迁移提供依据。

## Why

用户盘点的主要使用者通过直接导入简化 CLI 调用，深入使用主要依赖精确的程序化结果。因此，候选方向是以全面 CLI 和 JSON 协议承接外部需求；当前首先需要证明 Rust 在相同行为下的收益。

## Outcome

交付可审计的正确性与性能对照，量化墙钟耗时、CPU、峰值内存和安装入口成本，给出继续迁移或停止的建议及证据边界。正收益、无明显收益和回退都按相同标准验收。

## Scope

### Intended Change

- 实现隔离的 Rust 原生查询切片：`list`、metadata／content `search`、`trace`，按冻结实验用例核对参数与输出契约。
- 比较 Node CLI、TS 直接导入与 Rust CLI；测量原生二进制和 npm／下载器安装后的实际调用路径。
- 使用真实仓库快照与 100／1,000／10,000 条合法合成记录，按 [design](design.md) 完成行为核对和重复测量。
- 对后续调查确认的 trace 平方查重做局部优化，补充有关系图的 TS／旧 Rust／新 Rust 对照，保留版本与算法归因边界。

### Resulting Impacts

- 记录实际导入用法、CLI 映射及程序化输出缺口，作为后续 SDK 退出与 CLI 完整性设计的输入。
- 实验源码、基准、测试和本地交付原型在验收后清理，调查保留必要历史证据；生产入口与记录保持不变。
- 正式迁移后的目标是 CLI＋JSON；批量优先、单项作为数量为 1 的批次，以及 SDK 退出的具体设计，在迁移决策后展开。

## Success Criteria

1. 记录测量版本、工具环境、输入指纹、方法与关键样本，使他人可审计结论；不承诺保留完整源码及重跑能力。
2. 受测单元按行为 owner 核对成功、错误、来源安全与受限结果；未等价边界单列，只有行为合格的匹配组进入收益结论。性能专项验收与完整生产替代验收分别判断。
3. 分别报告 CLI 启动和进程内调用者切换到原生 CLI 的成本，覆盖完整扫描、早停、分页和图计算，并保留原始测量与波动。
4. 原生、npm 和下载器安装后的路径在实际平台通过本地运行验证；构建、首次安装和已安装调用的成本分别记录。
5. 结论区分 Rust 实现、算法变化和调用方式的贡献，列明程序化输出缺口、维护代价及未测范围；必要证据按调查契约归位。

## Affected Owners

| Owner | 本 Change 的责任 |
| --- | --- |
| [Decision Records](../../tools/decision-records/README.md)、[CLI 契约](../../skills/decision-records/references/cli-operations.md) | 查询行为、实现闭包与现有程序化入口 |
| [Index Runtime](../../tools/index-runtime/README.md)、[共同记录操作](../../tools/record-operations/README.md)与 `tools/shared/` | 索引、来源安全、检索和关系图义务 |
| [源码与分发](../../docs/tooling-distribution.md)、[TS 分发决策](../../docs/decisions/distribute-editable-typescript-runtimes.md) | 实验隔离及正式采用时的分发交接 |
| [测试维护](../../docs/test-maintenance.md)、[Gate](../../docs/gate-execution.md) | 专项测试证据与实际验证范围；正式 Cargo 账本／CI 接入留待迁移 |
| [调查报告](../../skills/investigation-report/SKILL.md) | 最终结果及必要审阅证据 |
