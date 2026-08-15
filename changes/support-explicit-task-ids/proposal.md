# Proposal

本 proposal 规划 task-graph 的显式 task ID 能力，并保持省略或占用时安全回退到自动 ID。

## Why

当前 task 只能获得 `task-000001` 形式的自动 ID。纯编号适合稳定分配，却不利于人在命令、任务关系和交接中表达与识别任务；task title 又是允许重名的显示文本，不能替代唯一引用身份。

显式 ID 如果接受任意字符串，会把 shell 引号、转义、选项歧义、apply alias、父关系哨兵、文本 renderer 分隔符和 JavaScript 对象键顺序问题带入所有后续命令。因此需要同时确定一个便于裸参数使用的有限字符契约，以及不会覆盖既有 task 的统一分配语义。

## Outcome

调用方可以在创建 task 时请求一个符合便携 CLI 规则的显式 ID。合法且未占用的值原样成为唯一身份；省略值或合法值已被占用时，工具分配新的规范自动 ID。所有创建入口返回最终实际 ID，批量 apply 的 alias 绑定该实际 ID，任何路径都不能覆盖现有 task。

显式 ID 只在当前索引中占用。task 通过既有门禁被受控删除后，该字符串可以用于创建新的独立 task；自动 ID 仍由单调水位分配且不复用。

既有规范自动 ID 和索引继续有效；显式 ID 不改变 title、关系、租约和终态语义。

## Scope

纳入范围：

- 定义自动 ID、显式 ID、持久 task ID 和 apply reference 的统一校验边界。
- 为 create operation 和 `task create` CLI 增加可选显式 ID，并实现占用回退、自动分配、最终 ID 返回和事务回滚语义。
- 调整 `nextTaskId` 语义校验、关系字典、staging、规范序列化和全部 task ID 消费入口。
- 同步 task-graph 行为 owner、人类说明、公开 CLI 版本、生成 JSON Schema、分发 bundle、SDK 声明和 skill 独立版本，并新增承接身份分配方向的长期决策。
- 新增或更新原生测试，并按 test-evidence-review 契约维护一入口一 case 的 task-graph 测试证据。

非目标：

- 不重命名既有 task，不增加 task ID rename 或迁移命令。
- 不从 title、alias 或其他内容推导 ID，也不自动规范化、改写大小写或追加冲突后缀。
- 显式 ID 只使用约定的 CLI 便携字符集，不扩展 CLI parser、apply alias、父关系清空哨兵或文本 renderer 协议。
- 不改变 task result、succeeded 重开或其他 task 生命周期语义。
- 不为已删除的显式 ID 保存 tombstone、保留集合或历史映射，也不让新 task 继承已删除 task 的内容、关系、状态或结果。
- 不把 task-000037 或 task-000040 的独立目标并入本 Change。

## Success Criteria

1. 显式 ID 使用 1 至 80 个 ASCII 字符，只允许字母、数字、点、下划线和连字符；不得以连字符开头、不得是纯数字、必须包含字母或数字，并拒绝保留对象键、`null` 和大小写不敏感的 `task-<数字>` 自动命名空间。
2. 合法且空闲的显式 ID 原样使用且不推进 `nextTaskId`；未提供 ID 或合法 ID 已占用时分配唯一规范自动 ID 并推进水位；非法显式 ID 直接拒绝而不回退。
3. 自动分配、同批重复显式 ID、失败事务和持久索引语义均不覆盖现有 task、不复用已分配自动编号，并保持 canonical round trip；显式 ID 只按当前索引判重，受控删除后可以用于新的 task。
4. `task create` 返回实际 `taskId`；apply 按操作顺序返回实际 `createdTaskIds`，alias 映射和同事务关系解析都指向最终实际 ID。
5. CLI 的 create、show、relation、stage、claim、complete 和 remove 等完整生命周期可以直接使用所有合法 ID，无需引号或转义；程序化调用、CLI、索引读取和 staging 使用同一 task ID 事实源。
6. 行为 owner、版本、生成产物、测试实现和测试证据同步，目标测试、生成检查、测试证据检查和仓库完整检查通过。

## Affected Owners

- `skills/task-graph/SKILL.md` 与 `docs/skills/task-graph.md`：task ID、创建和 CLI 的稳定行为说明。
- `tools/task-graph/src/types.ts`、`schema.ts`、`engine.ts`、`service.ts`、`cli.ts` 与 `staging.ts`：公开类型、运行时校验、分配事务、命令和 Git staging 实现。
- `skills/task-graph/references/task-graph-index.schema.json`、`skills/task-graph/scripts/task-graph.mjs`、source map 与 `task-graph-sdk/`：从源码机械生成的分发契约。
- `tools/task-graph/tests/` 与 `docs/test-evidence/task-graph/`：原生测试入口及其权威测试证据；派生测试证据索引由统一同步命令维护。
- `docs/decisions/` 与决策索引：以新的完整决策收窄既有“任务 ID 不复用”规则，保留权威 JSON 索引和受控删除方向，同时区分自动 ID 不复用与显式 ID 当前索引唯一；不直接改写既有已建立决策正文。
