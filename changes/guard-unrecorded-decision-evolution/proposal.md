# Proposal

本 change 计划在决策退出活动状态前识别尚未进入 Git 基线的记录，并提供显式保留或折叠路径；本文是实施计划，不表示行为已经改变。

## Why

决策首次激活后即成为已建立记录，Git 不参与生效判断。若同一未提交变更中先建立决策 A，随后又建立决策 B 修订 A，现有 `evolve` 会永久保存刚建立便归档的 A；普通 `archive` 也会留下未进入版本基线的失活记录。它们可能只是本次变更内部的收敛过程，却被保存为长期历史。当前 `discard` 只允许删除未激活候选，无法安全处理已建立且可能承接上游关系的 A。

## Outcome

- `evolve`、带关系的 `activate` 和 `archive` 在即将归档未存在于 Git `HEAD` 的已建立决策时，先给出可行动警告并保持文件与索引不变。
- 调用者可以显式选择保留未提交历史后重试；该选择不会改变现有关系和事务语义。
- `evolve` 可以显式折叠一个未进入 `HEAD` 的活动直接前序；调用者提供由零个或多个关系组成的完整最终关系集合，CLI 不推断上游关系类型或组合。
- 折叠在同一可恢复事务中删除中间记录、处理最终直接前序、激活后继并重建索引。
- 非 Git 决策集合继续使用既有生命周期；`discard` 仍只面向未激活候选，不新增通用删除命令。

## Scope

纳入范围：

- decision-records CLI 参数、Git `HEAD` 预检、生命周期准备和事务变化。
- 单个未提交活动前序的显式折叠，以及折叠后最终关系的安全校验。
- `activate` 带关系、`evolve` 和 `archive` 的预警与显式保留选项。
- skill 契约、人类说明、长期决策、调查结论、测试证据和分发产物。

不纳入范围：

- 让 Git 决定决策是否建立、生效、对齐或进入索引。
- 自动合成关系类型、自动继承全部上游关系，或自动处理分叉和多层折叠。
- 新增通用删除已建立决策的命令，或放宽 `discard` 的候选边界。
- 自定义版本基线、部分暂存语义、提交重写或跨 worktree 历史整理。

## Success Criteria

- Git 仓库中，目标决策不在 `HEAD` 时首次命令返回警告、非零状态且不修改 Markdown 或索引。
- `--keep-unrecorded-history` 明确重试后，原有归档或演进事务正常完成。
- `evolve --collapse-unrecorded <path>` 只接受未进入 `HEAD` 的单个活动已建立前序，拒绝已提交、被其他记录引用或不满足关系边界的目标。
- 折叠后的 `--relation` 被视为后继的完整最终关系集合；已归档目标只能来自被折叠记录的直接前序，活动目标仍按正常演进归档。
- 没有 Git 仓库时，现有激活、演进和归档行为保持可用。
- 源码测试、测试证据目录、生成产物、skill 版本、严格决策检查和全仓检查通过。

## Affected Owners

- `tools/decision-records/src/`：CLI 参数、预检结果、版本基线适配、生命周期和事务。
- `tools/decision-records/tests/`：Git 基线警告、保留、折叠、拒绝和非 Git 回归证据。
- `tools/shared/src/version-control/`：区分非 Git 目录与仓库发现故障，并维护相应领域契约。
- `skills/decision-records/`：agent 行为入口、领域契约、版本和生成 CLI。
- `docs/decisions/decision-records/`：长期采用方向。
- `docs/investigations/decision-records/`：原调查的收敛结果和剩余边界。
- `docs/test-evidence/decision-records/`：受影响原生测试入口的证据 case。
- `docs/skills/decision-records.md`：面向人类的能力说明。
