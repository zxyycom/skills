# Proposal

本 Draft Change 为 Decision Records 与 Investigation Report 建立日期前缀实例 ID 和无歧义名称解析，使语义名称可以重复出现而不会失去精确定位能力。

## Why

Decision 和 Investigation 都会长期保留形成时记录。历史实例继续占用旧名称时，新形成的调查或决策无法继续使用最自然的语义名称；随机短码或 UUID 虽能去重，却会增加没有领域含义的记忆负担。

[`保留型工件重名调查`](../../docs/investigations/260903-explore-name-collisions-in-retained-artifacts.md)已经区分了合法语义复现与真实身份冲突，并收敛出两个可共同依赖的约束：新 ID 使用前置 UTC 日期 `YYMMDD-<name>`，名称只在唯一命中时才能代替完整 ID。当前两个 skill、CLI、索引和关系契约尚未实现这些约束。

## Outcome

- 新创建的 Decision 和 Investigation 使用 `YYMMDD-<name>.md` 作为完整实例 ID。
- 查询、生命周期选择和关系参数可以使用完整 ID，也可以使用唯一语义名称；名称零命中或多命中时返回明确错误，多命中诊断列出候选完整 ID。
- 关系输入即使使用唯一名称，落盘仍保存解析后的完整 ID；未来形成同名实例不会改变既有关系含义。
- 同一天创建同名实例导致完整 ID 已存在时，操作零写入失败并要求复用原对象或提供更具体的语义名称；不追加时分秒、随机短码或局部序号。
- 现有无日期 ID 继续作为 legacy ID 读取和维护，不自动批量迁移；新旧格式共存时仍不得静默猜测目标。
- 两个领域共享用户可观察的命名与歧义规则，但分别由自身 owner 实现，不建立跨领域 ID registry、allocator、索引或通用记录平台。
