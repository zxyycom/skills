# Proposal

本 change 规划 `decision-records stage <decision-path...>`：调用者从并行的磁盘决策变化中显式选择一个集合，命令为它构造索引一致的待提交快照。本文只拥有当前实施范围与验收，不表示行为已经改变。

## Why

`decision-index.json` 是从领域目录表和全部已建立决策 Markdown 生成的完整持久索引。任何决策变化都会改变同一个索引文件及其全局 `sourceRevision`。当 `filesystem` 中同时存在独立决策变化 A 与 B 时，普通路径暂存无法为 A 构造合法的完整索引：只选择聚合索引的部分差异会破坏来源一致性，直接暂存磁盘索引又会把 B 带入 A 的待提交范围。

生命周期命令直接维护 `filesystem` 中的决策集合及其索引，不读取或整理版本管理的 `pending` 快照。通用提交整理能力也不拥有决策索引协议。所需能力因此分属两个 owner：decision-records 负责从决策语义构造目标集合，共享版本管理层负责受控地替换 `pending` 路径范围。

长期方向由 [按指定决策构造待提交快照](../../docs/decisions/decision-records/stage-selected-decisions.md) 与 [由共享版本管理层承接待提交快照写入](../../docs/decisions/version-control/manage-pending-snapshot-writes.md) 承接；本 proposal 只规划它们在当前 change 中的落地。

## Outcome

- decision-records 提供独立命令 `stage <decision-path...>`，显式接收一个或多个共同形成合法目标集合的决策路径。
- 命令以 `revision` 决策集合为基线，只叠加指定路径在 `filesystem` 中的增加、修改或删除，并生成与目标来源一致的完整 `decision-index.json`。
- 命令完整替换 `pending` 决策范围：未指定决策恢复为 `revision` 内容，`filesystem` 保持不变，决策范围外既有 `pending` 内容保持不变。
- 共享版本管理层用项目类型、结果和错误语义提供范围替换；当前实现只需支持 Git，公共边界不暴露 Git 专属信息。
- `activate`、`evolve`、`archive` 等生命周期命令继续直接维护 `filesystem` 决策集合，不增加 `--stage` 参数，也不感知 `pending`。

## Scope

纳入范围：

- `decision-records stage <decision-path...>` 的参数、显式选择语义、结果输出、失败处理和退出状态。
- 从 `revision` 与指定 `filesystem` 决策构造完整目标来源，并从同一来源生成、序列化和验证 `pending` 索引。
- 共享版本管理层不暴露底层专属信息的 `pending` 范围替换契约、当前 Git 实现和可恢复失败边界。
- 指定决策的增加、修改和删除；重命名由显式选择旧路径删除与新路径增加共同表达。
- decision-records 与共享版本管理层的行为文档、长期决策、测试、测试证据、生成产物和 skill 版本。

不纳入范围：

- 拆分、分片或取消单文件持久决策索引。
- 让生命周期命令读取、修改或区分 `pending` 状态，或为这些命令增加 `--stage`。
- 让 `git-commit-organizer` 解析、裁剪或重建决策索引。
- 向领域代码、公共版本管理接口或 CLI 输出透传 Git 专属类型、命令、index 结构、对象 ID、文件模式或锁语义。
- 因公共边界隔离底层实现而建设多后端 provider 注册、能力协商或完整跨版本管理系统兼容框架。
- 在首版命令中隔离并选择领域目录表的局部变化；已存在 `revision` 时使用其中的领域目录表，所选决策依赖尚未进入该目录表的领域变化时明确失败。
- 从关系或最近执行的生命周期命令自动推断选择集；调用者必须显式给出共同形成一个有效待提交集合的全部决策路径。

## Success Criteria

- `filesystem` 同时包含独立决策变化 A 与 B 时，执行 `decision-records stage A` 后，`pending` 决策差异只包含 A 和从 `revision + A` 生成的完整索引；B 保留在 `filesystem` 且不进入 `pending`。
- `pending` 已含 B 的决策变化时，执行 `decision-records stage A` 会让决策范围内的 B 恢复为 `revision` 基线，同时保留决策范围外既有 `pending` 内容。
- 目标索引包含全部 `revision` 基线决策和指定变化；索引 state、keys、metadata 与 `sourceRevision` 均由同一目标来源生成并通过完整校验。
- 指定路径同时缺失于 `filesystem` 与 `revision`、包含候选、遗漏必要关系变化、依赖目标目录表之外的领域变化或不能形成合法集合时，命令在修改 `pending` 前失败并给出可行动诊断。
- 共享版本管理公共接口和 decision-records 领域实现不暴露 Git 专属值；缺少可用版本管理环境或实现能力时，命令失败且不产生写入。
- `pending` 范围替换对可处理失败恢复原决策范围；恢复不完整时停止并报告明确的恢复边界。
- 生命周期命令、磁盘索引同步、常规查询和非暂存维护行为保持原契约。
- 目标测试、测试证据、生成漂移检查、类型检查、严格决策检查和全仓检查通过。

## Affected Owners

- [`tools/shared/version-control.md`](../../tools/shared/version-control.md) 与 `tools/shared/src/version-control/`：版本快照公共契约、`pending` 范围替换和当前实现。
- `tools/shared/tests/version-control.test.ts`：共享写入、范围隔离、失败恢复和底层封装证据。
- `tools/decision-records/src/` 与 `tools/decision-records/tests/`：独立 `stage` 命令、目标来源、索引生成、验证、输出和领域测试。
- [`skills/decision-records/SKILL.md`](../../skills/decision-records/SKILL.md) 与相邻 references：agent 行为入口、决策集合契约和版本管理依赖边界。
- `skills/decision-records/scripts/`：从工具源码同步的可分发 CLI、声明和 source map。
- [指定决策暂存决策](../../docs/decisions/decision-records/stage-selected-decisions.md) 与 [共享版本管理写入决策](../../docs/decisions/version-control/manage-pending-snapshot-writes.md)：跨 change 持续有效的方向与理由。
- `docs/test-evidence/`：新增或修改的最小原生测试入口及统一派生索引。
- [`docs/skills/decision-records.md`](../../docs/skills/decision-records.md)：面向人类的能力说明；只在实现完成后同步当前事实。
