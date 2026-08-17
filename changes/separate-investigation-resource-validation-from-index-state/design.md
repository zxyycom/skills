# Design

本 design 把四条长期方向映射为可执行方案；长期判断由对应决策承接，本 Change 只拥有实施边界、兼容处理、任务顺序和验证出口。

## Context

- 行为事实由 [`skills/investigation-report/SKILL.md`](../../skills/investigation-report/SKILL.md)、固定契约和 `tools/investigation-report/src/` 承接。四条长期决策约束目标方案；只有任务 2.5 的事实核验通过后才能改变其 alignment。
- 当前资源链接必须逐字使用 `../_resources/<resource-id>`，并已受规范 POSIX 路径、字符白名单、规范根、符号链接和普通文件门禁约束。
- Git 工作区已经有独立的版本控制可见性规则：tracked 文件和 `git add -f` 的 ignored 文件可见，仍被 ignore 排除的未跟踪文件不可见；本 Change 只使用该结果，不重新定义成员发现。
- 当前 `metadata.resources` 和 `sourceRevision.metadata` 覆盖完整资源集合。公共 selected-entry staging 正确要求集合级 metadata 稳定；耦合来自调查领域的 metadata 选择，不需要修改公共 index-runtime。
- 仓库当前资源已经位于与主题 ID 对应的目录中，本仓库实施时不需要移动形成时资源。

## Goals / Non-Goals

目标：

- 从资源路径确定性恢复唯一 owner 主题，同时允许跨报告、跨主题复用同一文件。
- 让被引用资源的完整性问题阻塞维护，让完全未引用的资源池卫生问题只产生 warning。
- 让主题索引只投影主题事实和报告资源 ID 关系，不再承担资源文件清单。
- 让按主题暂存索引条目不受无关资源变化影响。

非目标：

- 不建立资源权限、生命周期、共享审批、自动清理、引用计数缓存或独立内容寻址。
- 不从内容、哈希或引用者集合猜测 owner，也不自动移动资源。
- 不扩大公共 index-runtime 的 metadata 或 staging 语义。
- 不改变 Git staging 的显式选择责任，也不让检查成功代替最终 pending 审阅。

## Decisions

### Authority map

| 独立判断 | 长期 owner | 本 Change 的实施责任 |
| --- | --- | --- |
| 资源路径与共享引用 | [`anchor-investigation-resources-to-topic-owners.md`](../../docs/decisions/anchor-investigation-resources-to-topic-owners.md) | 推导 owner topic ID，并校验被引用资源的 owner 参与当前引用 |
| 引用错误与孤儿 warning | [`warn-on-unreferenced-investigation-resources.md`](../../docs/decisions/warn-on-unreferenced-investigation-resources.md) | 分离 errors/warnings，定义全量与 scoped 检查边界 |
| 索引来源边界 | [`exclude-investigation-resources-from-index-revision.md`](../../docs/decisions/exclude-investigation-resources-from-index-revision.md) | 保留 `resourceReferences`，移除资源 metadata、SHA 和字节 revision |
| 选中条目暂存 | [`stage-investigation-index-entries-across-resource-changes.md`](../../docs/decisions/stage-investigation-index-entries-across-resource-changes.md) | 维持 index-only staging，并取消调查领域的资源集合门禁 |

前三条决策是原资源总决策的完整拆分后继；第四条只修订原 `stage-index` 决策。版本控制可见性和资源名称规则继续由现有独立决策承接，不复制进这四条 owner。

### Resource ownership and validation

资源 ID 使用 `<category-id>/<semantic-slug>/<resource-subpath>`，并映射到 owner topic ID `<category-id>/<semantic-slug>.md`。`resource-subpath` 至少包含一个文件名，owner 根之后继续允许任意层合法嵌套。报告链接语法保持 `../_resources/<resource-id>`。

实现先区分三个概念，避免用同一个“资源校验”混合成员发现、引用完整性和索引来源：

- **版本控制可见资源成员**：Git 工作区中 tracked 或通过 `git add -f` 进入 pending 的文件；非 Git 工作区中按现有规则发现的文件系统成员。
- **被引用资源**：默认全量检查中至少被一份合法主题报告声明的资源 ID。完全未出现在全量合法引用集合中的可见成员是 orphan。
- **资源检查无法完成**：资源根无法安全解析或读取、版本控制查询失败等导致工具不能可靠建立成员或引用集合的操作错误。此时工具不知道完整资源状态，不能把问题归因于某个被引用或未引用资源。

默认全量检查先解析全部主题和引用，再发现版本控制可见资源成员，并按以下顺序分类：

1. 被引用资源继续接受现有文件安全、精确大小写、存在性、普通文件身份和版本控制可见性检查，并要求资源 ID 的 owner 前缀合法、owner 主题存在且至少一份 owner 报告引用该资源。读取只服务于当前资源校验，不保留 SHA-256 或把文件字节交给索引构建。
2. owner 参与引用后，其他报告或主题可以引用同一资源，不改变 owner。
3. 只要能够把一个可见成员确定为完全未引用资源，它以及它的非法 owner 结构、缺失 owner 主题、非法类型或安全路径问题都进入 warnings，不阻塞 `check` 或 `sync-index`。同一路径一旦被报告引用，相应问题进入 errors。
4. 资源检查无法完成时命令失败，因为工具尚未得到足以判断哪些资源被引用或未引用的完整信息；失败原因是检查操作未完成，不是未引用资源需要阻塞。
5. scoped check 只解析命中主题，校验它们声明的资源 ID 结构和直接目标文件，不额外读取未命中的 owner 主题，因此不证明跨主题 owner 锚点或全局 orphan 状态。默认全量 check 与 `sync-index` 才建立完整 owner 引用关系。

`InvestigationReportCheckResult` 与 `InvestigationIndexSyncResult` 都增加 `warnings: string[]`，并让 errors 与 warnings 分别去重排序。CLI 在成功或失败路径都展示已有 warnings；warnings 使用 stderr，不改变只有 errors 决定的退出状态，只有 warnings 时仍在 stdout 输出 check 或 sync 成功结果。Warnings 不进入索引、source revision、`list` 结果或 staging 状态。

### Index and command boundaries

主题 state 保留 `resourceReferences`，因此报告链接变化仍改变对应 entry 与 entry source fingerprint。调查 metadata 改为拒绝额外字段的严格空对象；`sourceRevision.metadata` 只稳定指纹化该空领域 metadata，不读取、摘要或枚举 `_resources/`。通用 `schemaVersion` 保持 `3`。

完整维护路径先执行领域校验，再把主题 Markdown 单独构造成索引 snapshot；写入前的通用 source revision 复核也只重读主题 Markdown。资源在校验完成后的变化不再构成索引并发漂移，调用方仍通过完成同步后的默认全量 check 核对当下资源状态。

命令责任调整为：

- `check`：执行资源完整性校验并报告 warnings。
- `sync-index`：先运行默认全量领域校验；有 errors 时不写索引，只有 warnings 时继续只从主题 Markdown 构建索引。
- `list`：核对主题 Markdown 对应的索引 revision 后查询 topic state，不读取资源池。
- `stage-index`：继续只组合选中主题的索引条目；不读取或暂存领域文件，也不再因资源变化返回调查领域的 `collection-changed`。

同一调查索引已有 pending、非法或缺失 topic ID、主题重命名选择、版本控制失败以及目标索引之外 pending 保留等既有 staging 边界不变。

### Compatibility and delivery

移除 `metadata.resources` 会改变当前索引结构，调查领域 `definitionVersion` 从 `4` 提升到 `5`，通用 `schemaVersion` 保持 `3`。旧索引由当前 `sync-index` 重建，不增加双读、转换器或旧 metadata 容忍分支。Version 4 到 version 5 是集合定义升级，首次交付整体暂存重建后的索引；选中条目组合只要求在两侧均为 version 5 的正常维护中跨资源变化成立。不符合 owner 结构的外部工作区资源需要显式移动并更新报告链接；本仓库现有资源无需迁移。

实现修改 `tools/` 源码、公开声明源和测试后，从维护源码重新生成分发 CLI、source map、TypeScript 声明与 JSON Schema，并把 `investigation-report` skill version 从 `15` 提升到 `16`。测试修改按 Test Evidence Review 维护一入口一 case，移除或改写仍声称 orphan、资源 revision 或资源 metadata 会阻塞的过时 case，再同步派生索引。只有各条决策的完整方向分别成为当前事实并通过验证后，才通过 Decision Records 生命周期命令把对应决策标记为 aligned。

## Risks / Trade-offs

| 风险或取舍 | 控制 |
| --- | --- |
| 资源内容变化不再使索引陈旧 | 明确索引只投影主题事实；默认 check 验证当前文件，形成时字节身份由 Git 历史和报告证据说明承接 |
| owner 停止引用但其他主题仍引用时会失败 | 维护者恢复 owner 引用，或显式移动文件并更新全部链接；工具不猜测 owner 转移 |
| 未引用资源及其路径或文件问题可能长期积累 | 全量 check 持续输出可定位 warning，但不阻塞其他调查维护；出现独立治理需求后再建立清理 owner |
| scoped check 不能证明全局 owner 与孤儿状态 | CLI 和契约明确其证明范围；同步前仍使用默认全量校验 |
| 资源校验与索引写入不再共享一个资源字节 revision | `sync-index` 写前只阻止主题 Markdown 漂移；同步后按既有流程再运行默认全量 check，不能把索引新鲜度解释为资源快照证明 |
| 旧工作区资源路径或索引不兼容 | 提升 definition version，要求显式移动资源和重建索引，不保留双轨语义 |
| version 4 与 version 5 不能进行选中条目组合 | 首次升级整体暂存 version 5 索引；后续条目级暂存只在同一 definition version 内使用 |

## Open Questions

无。
