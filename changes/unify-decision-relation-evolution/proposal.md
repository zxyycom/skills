# Proposal

本 change 计划把决策关系维护收口为统一、闭合且可恢复的 `evolve` 事务，并保存实施这项破坏性调整所需的临时范围与验收条件。

长期语义由两条决策分别承接：[统一闭合决策关系演进](../../docs/decisions/decision-records/unify-closed-decision-relation-evolution.md) 拥有事务入口、关系策略和闭合边界，[以完整集合审核和替换决策关系](../../docs/decisions/decision-records/replace-decision-relations-as-complete-sets.md) 拥有关系来源、覆盖优先级和已建立关系修订边界。本 change 只保存把两条决策落地所需的实施范围、设计映射和验收任务。

## Why

当前 `evolve` 只建立一个后继，闭合一对多演进由独立 `split` 命令承接，带关系的 `activate` 又提供第三个入口。关系类型继续增长时，这种按拓扑增加命令的方式会扩大公开协议和内部生命周期分支，也无法从命令 owner 上保证所有关系策略都经过同一套闭合校验。

候选已经拥有与正式记录相同的 `relations` 结构，但现行事务只把 CLI 关系参数视为演进输入。普通激活不能可靠地把候选中预写的关系、前序归档和后继建立一次完成；最终图校验也只能观察拆分后继数量，不能证明单条新增 `拆分` 边经过了完整后继集合事务。已建立记录中的错误关系同样缺少只修改关系、保留正文和生命周期的闭合修订入口。

## Outcome

- `evolve` 成为所有决策关系类型共享的完整事务入口，按关系策略校验一个或多个后继的拓扑与闭合条件。
- `activate --relation` 保留为永久的单后继便捷入口；未显式提供关系时也能使用候选已经声明的完整关系并在一次事务中建立。
- 候选和已建立记录都能以完整集合替换关系；已建立记录的正文、状态、对齐状态和建立时间不会被关系修订隐式改变。
- `拆分` 作为 `evolve` 的一对多闭合策略存在，独立 `split` 命令和旧单后继 `evolve` 形式被直接移除。

## Scope

纳入范围：

- 调整 Decision Records 的 CLI、公开类型、生命周期服务、关系图校验和可恢复事务准备流程。
- 定义候选关系、CLI 完整覆盖、显式清空和已建立关系修订的确定性优先级。
- 让拆分事务显式选择完整最终后继集合，并拒绝单后继 `拆分`、遗漏既有拆分后继和不受支持的多对多组合。
- 保持未记录历史预检、单后继折叠、失败恢复和派生索引读回验证能力。
- 同步 skill 行为入口、固定领域契约、人类说明、版本、公开声明、分发制品、测试和测试证据账本。

不纳入范围：

- 不新增 YAML、JSON plan、stdin 事务文件或通用逐边 DSL。
- 不实现 `重组` 关系或任意多前序到多后继协议。
- 不通过关系修订改写已经建立的决策正文、生命周期、对齐状态或建立时间。
- 不自动重新激活被移除关系指向的归档记录，也不增加事务 ID 或不可篡改来源证明。
- 不保留 `split`、旧 `evolve <decision-path> --alignment ...` 或旧 API request 的兼容适配层。

## Success Criteria

- 多后继演进和已建立记录的关系修订只通过 `evolve --successor <alignment=decision-path>...` 表达；`activate --relation` 只保留为新候选的单后继便捷入口，`split` 命令与旧单后继 `evolve` 语法均不可用。
- `activate` 在候选声明关系或调用方提供 `--relation` 时，通过同一事务核心一次完成前序归档、完整关系写入、候选建立和索引重建。
- CLI 关系参数完整替换记录关系，缺省时使用记录自身关系，显式清空拥有无歧义入口；任何模式都不做隐式追加或合并。
- 一个 `拆分` 前序的全部最终直接后继必须在同一 `evolve` 调用中显式出现，且至少两个；单后继追加、遗漏既有后继和混合非闭合关系在写入前失败。
- `evolve` 能完整替换已建立记录的关系，同时保留其正文、生命周期、对齐状态和 `createdAt`；新增活动目标被归档，移除目标不会被自动重新激活。
- 可处理失败恢复命令前受影响 Markdown 与索引组合；恢复不完整时继续停止维护并进入现有恢复流程。
- Decision Records 的源码测试、生成一致性、决策集合检查、测试证据目录和 `bun run check` 全部通过，两条未来方向决策在完整事实落地后标记为已对齐。

## Affected Owners

- `skills/decision-records/SKILL.md`：agent 行为入口和公开命令用途。
- `skills/decision-records/references/decision-record-rules.md`：候选、关系、生命周期事务与闭合策略的固定语义。
- `docs/skills/decision-records.md`：面向人类的能力说明。
- `tools/decision-records/src/` 与 `tools/decision-records/api/`：CLI、公开类型、生命周期服务、关系图和 API owner。
- `tools/decision-records/tests/`：关系输入、拓扑闭合、恢复和公开协议行为。
- `skills/decision-records/scripts/`：由工具源码生成的可分发 CLI 与声明。
- `docs/test-evidence/decision-records/` 及统一测试证据索引：受影响最小测试入口的证据 owner。
- `docs/decisions/decision-records/unify-closed-decision-relation-evolution.md`：事务入口、关系策略和拓扑闭合的长期 owner。
- `docs/decisions/decision-records/replace-decision-relations-as-complete-sets.md`：关系来源、完整替换和关系修订的长期 owner。
- `docs/decisions/decision-index.json`：上述长期决策的派生查询投影。
