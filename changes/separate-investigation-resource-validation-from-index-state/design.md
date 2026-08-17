# Design

本 design 把四条已确认但尚未实施的长期方向映射为一个可执行方案；长期判断由对应决策承接，本 Change 只拥有实施边界、兼容处理、任务顺序和验证出口。

## Context

- 当前事实仍由 [`skills/investigation-report/SKILL.md`](../../skills/investigation-report/SKILL.md)、固定契约和 `tools/investigation-report/src/` 承接。四条新决策均为 `active + unaligned`，只约束目标方案，不表示行为已经生效。
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

默认全量检查一次收集全部主题的引用关系和全部版本控制可见资源：

1. 被引用资源继续接受现有文件安全检查，并要求 owner 主题存在且至少一份报告引用该资源。
2. owner 参与引用后，其他报告或主题可以引用同一资源，不改变 owner。
3. 完全未引用的可见资源进入 warnings；即使它的 owner 主题尚不存在，或文件存在非法类型、非法 owner 结构或安全路径问题，也不升级为 error。同一路径一旦被报告引用，相应问题进入 errors。
4. scoped check 只验证命中报告及其直接引用，不证明跨主题 owner 锚点或全局孤儿状态。

领域检查结果显式返回 `errors` 与 `warnings`。CLI 展示两者，只有 errors 决定失败；`sync-index` 在只有 warnings 时继续写入。Warnings 不进入索引、revision 或查询状态。

### Index and command boundaries

主题 state 保留 `resourceReferences`，因此报告链接变化仍改变对应 entry 与 entry source fingerprint。调查 metadata 改为严格空对象；`sourceRevision.metadata` 只表示空领域 metadata，不读取或摘要 `_resources/`。

命令责任调整为：

- `check`：执行资源完整性校验并报告 warnings。
- `sync-index`：先运行默认全量领域校验，再只从主题 Markdown 构建索引。
- `list`：核对主题 Markdown 对应的索引 revision 后查询 topic state，不读取资源池。
- `stage-index`：继续只组合选中主题的索引条目；不读取或暂存领域文件，也不再因资源变化返回调查领域的 `collection-changed`。

同一调查索引已有 pending、非法或缺失 topic ID、主题重命名选择、版本控制失败以及目标索引之外 pending 保留等既有 staging 边界不变。

### Compatibility and delivery

移除 `metadata.resources` 会改变当前索引结构，调查领域 `definitionVersion` 从 `4` 提升到 `5`。旧索引由当前 `sync-index` 重建，不增加双读、转换器或旧 metadata 容忍分支。不符合 owner 结构的外部工作区资源需要显式移动并更新报告链接；本仓库现有资源无需迁移。

实现修改 `tools/` 源码和测试后，从维护源码重新生成分发 CLI、source map 与 JSON Schema，并提升 `investigation-report` skill version。测试修改按 Test Evidence Review 维护一入口一 case 和派生索引。只有各条决策的完整方向分别成为当前事实并通过验证后，才把对应决策标记为 aligned。

## Risks / Trade-offs

| 风险或取舍 | 控制 |
| --- | --- |
| 资源内容变化不再使索引陈旧 | 明确索引只投影主题事实；默认 check 验证当前文件，形成时字节身份由 Git 历史和报告证据说明承接 |
| owner 停止引用但其他主题仍引用时会失败 | 维护者恢复 owner 引用，或显式移动文件并更新全部链接；工具不猜测 owner 转移 |
| 未引用资源可能长期积累 | 全量 check 持续输出可定位 warning；出现独立治理需求后再建立清理 owner |
| scoped check 不能证明全局 owner 与孤儿状态 | CLI 和契约明确其证明范围；同步前仍使用默认全量校验 |
| 旧工作区资源路径或索引不兼容 | 提升 definition version，要求显式移动资源和重建索引，不保留双轨语义 |

## Open Questions

无。资源 owner、共享引用、warning 严重性、Git 可见性复用、空 metadata、资源退出 source revision、命令责任、index-only staging 和不提供兼容迁移均已确定。
