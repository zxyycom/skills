# Change Plan

`change-plan` 为明确 Change 保存可版本化、可审阅和可交接的临时计划，并用 `.change-plan.json` 维护 `draft`、`plan`、`implementation` 和 `shelved` 四个 active 阶段。完成后的 Change 进入 `archive/` 历史目录。

## 为什么需要它

项目的稳定文档拥有当前行为和接口，长期决策保存跨 Change 的理由，但一次 Change 仍需要临时回答为什么做、做到什么程度、采用什么方案、按什么顺序改以及怎样验证。只把这些信息留在对话中，会让跨会话实施、审阅和交接反复恢复范围。

`change-plan` 让内容承诺随工作成熟度增加：draft 用最小 `proposal.md` 和初始 `design.md` 同时保存开展理由与当前设计方向；进入 plan 前继续完善 proposal 和 design，再从设计派生 `tasks.md`、完成 Readiness 并记录 Git 距离基线；implementation 表示按当前有效计划实施。计划退出当前主线时可以显式搁置，也可以由固定 Git 演进距离识别为候选，再通过 `reconcile` 写入 shelved。恢复只能回到 plan 重新审阅。

## 提供的能力

1. `list`、`show` 和 `check` 发现 Change，区分目录 status、active stage 与 plan assessment。
2. `plan`、`implement`、`shelve`、`reconcile` 和 `resume` 按固定门禁推进阶段。
3. `git-distance-v1` 依据最后一次成功运行 `plan` 时记录的基线，统计后续 first-parent 提交数和 Change 目录外累计 diff 行数，以识别 `shelve-candidate`；该判断不使用日历时间。
4. `archive` 只归档处于 implementation、结构有效且任务全部完成的 Change。
5. 随包 MJS 既是 CLI，也可直接 import 当前底层查询与阶段函数；这些导出属于实现表面，不是稳定 SDK。
6. `.change-plan.json` 直接以 `stage` 判别当前结构，由运行时严格校验，不包含 schema version；Change Plan runtime 不生成 metadata JSON Schema 或 TypeScript 声明树。

## 能力边界

1. 项目 owner 文档继续拥有稳定事实、行为、接口和验证语义；长期判断进入项目已有决策 owner。
2. 查询发现候选但不自动改变阶段；复核后可以用 `plan` 更新基线，以 `reconcile` 保存 Git 距离证据并进入 shelved，或用 `shelve` 保存明确原因并进入 shelved。
3. `baseCommit` 只定位 Git 距离起点，不证明 artifacts 的内容一致性。CLI 的其余机械检查也不判断内容正确性、验证充分性或批准状态。
4. Archived Change 只作为历史；CLI 不提供 restore，也不为其补写 active metadata。
5. 版本控制操作失败会让 assessment 暂时不可用并产生明确诊断，不会被解释为计划内容需要复核。
6. 稳定自动化优先使用 CLI 与 `--json` 输出；直接 import MJS 的调用方需要自行跟随当前实现变化。

实际 skill 位于 [`skills/change-plan/`](../../skills/change-plan/)，精确字段、阈值和命令门禁见其固定契约。
