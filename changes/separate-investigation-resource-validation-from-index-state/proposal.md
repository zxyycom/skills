# Proposal

本 Change 把调查资源校验与主题索引集合状态分离，使资源保持集中、可验证且可复用，同时让无关资源变化不再阻塞按主题暂存索引条目。

## Why

`investigation-report` 当前把全部版本控制可见资源的 ID 与 SHA-256 写入 `investigation-index.json` 的集合级 metadata，并让资源成员和字节参与 `sourceRevision.metadata`。`stage-index` 虽然只暂存选中主题的索引条目，却必须先证明集合级 metadata 不变；因此任意资源新增、删除、改名或字节变化都会返回 `collection-changed`。

统一 `_resources/` 的用途是集中保存调查材料，不是把全部资源绑定成一个提交单元。报告 Markdown 已经声明精确引用关系，资源路径可以直接映射到负责维持它的 owner 主题。资源安全与归属应由报告引用校验负责，主题索引只需要投影报告事实和资源 ID 关系。

## Outcome

- 资源使用 `_resources/<category-id>/<semantic-slug>/<resource-subpath>`；前两段映射到 owner 主题 `<category-id>/<semantic-slug>.md`，owner 根之后允许任意合法嵌套。
- 被引用资源继续接受阻塞级安全、存在性、owner 与版本控制可见性校验。
- 任何能够确定为完全未引用的版本控制可见资源都只产生非阻塞 warning；非法 owner、路径、符号链接或文件类型不改变该严重性。
- 资源根无法读取或版本控制查询失败时，工具因无法完成资源检查而失败；失败不归因于某个未引用资源。
- 同一资源可以被 owner 主题内的多份报告或其他主题引用；其他引用者不改变资源 owner。
- 主题 state 继续投影报告到资源 ID 的关系；索引 metadata 不再保存资源清单或 SHA-256，资源文件也不再参与集合级 source revision。
- `stage-index` 继续只暂存选中主题的索引条目，但不再因资源文件变化拒绝条目级暂存。

## Scope

纳入范围：

- 调整 `investigation-report` 的资源 ID、引用校验、warnings、索引 metadata、source revision 以及 `check`、`sync-index`、`list`、`stage-index` 的行为边界。
- 同步修改行为 owner、TypeScript 源码与声明源、公开结果类型、生成的分发 CLI、声明与 JSON Schema、当前调查索引、行为测试与测试证据账本。
- 实施完成并验证后，分别对齐已经建立的四条长期决策。

不纳入范围：

- 不增加资源 manifest、共享资源注册表、反向引用索引、独立资源 entry 或自动 owner 转移。
- 不让 `stage-index` 自动选择、暂存或提交主题 Markdown 与资源文件。
- 不用主题索引替代 Git 历史证明资源形成时字节，也不检测未改变报告链接的资源内容漂移。
- 不提供旧索引或旧资源目录布局的兼容读取、自动迁移或路径别名。
- 不改变资源名称白名单、Git 可见性定义、主题身份或报告正文结构。

## Success Criteria

- 每个被引用资源都能从路径映射到 owner 主题，且 owner 主题至少一份报告引用该资源；其他主题可以同时引用同一文件。
- 默认全量检查对未引用的版本控制可见资源输出 warning 并成功退出；相同 warning 不阻塞 `sync-index`。被 ignore 排除的未跟踪文件不产生 warning，tracked 或经 `git add -f` 进入 pending 的 ignored 文件仍按可见资源校验。
- 被引用资源逃逸 `_resources/`、使用不安全或大小写错误路径、缺失、经过符号链接、不是普通文件、没有 owner 引用或属于不可见的 ignored 未跟踪文件时继续阻塞检查与同步。任何能够识别为完全未引用资源的文件及其同类问题都只报告 warning；只有资源根无法读取、版本控制查询失败等导致工具无法完成资源检查的操作错误才使命令失败。
- `InvestigationReportCheckResult` 与 `InvestigationIndexSyncResult` 分别返回确定性去重排序的 `errors` 和 `warnings`；CLI 展示两者，只有 errors 决定失败退出，只有 warnings 时仍输出成功结果。
- 新索引使用严格空 metadata，保持通用 `schemaVersion: 3` 并把调查 `definitionVersion` 提升到 `5`；资源成员和文件字节不改变 `sourceRevision.metadata`，报告链接变化仍改变对应主题 entry 与 entry source fingerprint。
- 在已有 definition version 5 基线中，主题 A 的报告与索引条目变化、主题 B 只有资源变化时，`stage-index` 可以只暂存主题 A 的索引条目，并保持主题 Markdown、资源文件和目标索引之外的 pending 路径不变。首次从 version 4 升级到 version 5 时整体暂存重建后的索引，不要求跨 definition version 组合选中条目。
- 行为 owner、源码、声明源、生成物、Schema、调查索引、测试证据、决策索引和四条决策状态一致，并通过目标检查与 `bun run check`。

## Affected Owners

- 行为与公开说明：[`skills/investigation-report/SKILL.md`](../../skills/investigation-report/SKILL.md)、[`investigation-report-contract.md`](../../skills/investigation-report/references/investigation-report-contract.md)、[`docs/skills/investigation-report.md`](../../docs/skills/investigation-report.md)
- 实现与生成边界：`tools/investigation-report/src/`、`tools/investigation-report/api/check-investigations.d.mts`、`tools/investigation-report/tests/`、`skills/investigation-report/scripts/`、`skills/investigation-report/references/investigation-index.schema.json`
- 当前派生状态与证据：`docs/investigations/investigation-index.json`、`docs/test-evidence/investigation-report/`、`docs/test-evidence/test-evidence-index.json`
- 长期方向与派生索引：[`anchor-investigation-resources-to-topic-owners.md`](../../docs/decisions/anchor-investigation-resources-to-topic-owners.md)、[`warn-on-unreferenced-investigation-resources.md`](../../docs/decisions/warn-on-unreferenced-investigation-resources.md)、[`exclude-investigation-resources-from-index-revision.md`](../../docs/decisions/exclude-investigation-resources-from-index-revision.md)、[`stage-investigation-index-entries-across-resource-changes.md`](../../docs/decisions/stage-investigation-index-entries-across-resource-changes.md)、`docs/decisions/decision-index.json`
