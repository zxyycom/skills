# Design

本设计让记录内容声明稳定 ID，让派生索引维护 ID 与当前 sourcePath 的映射，并把语义 name 和物理 basename 从身份中解耦。

## Context

- [`Decision Records 固定规则`](../../skills/decision-records/references/decision-record-rules.md)当前把含 `.md` 的 basename 定义为 Decision ID；`sourcePathForDecision` 由 ID 和 lifecycle status 直接计算路径，索引校验要求二者匹配。
- [`Investigation Report 固定契约`](../../skills/investigation-report/references/investigation-report-contract.md)当前也从 basename 得到 Investigation ID；candidate、正式报告和资源 owner 都沿用该文本。
- 两个领域的 Markdown frontmatter 当前没有独立 ID 字段。Decision index state 已保存 `sourcePath`，Investigation index entry 则默认以 ID 直接映射文件；两者都需要升级才能支持 basename 与 ID 不同。
- Test Evidence Case ID 与 Task ID 已与路径分离，证明仓库不需要把所有定位信息压进 ID。
- [`日期前缀身份 Draft`](../adopt-date-prefixed-record-identities/)在本 Plan 之后定义标准 dated ID、name 提取与 ID-first selector；[`指定 ID 索引刷新 Plan`](../add-selected-id-index-sync/)和[`记录 rename Draft`](../add-record-rename-transactions/)消费稳定 ID/sourcePath 基线。
- [`完成后删除 Change Draft`](../complete-change-plans-by-deletion/)把 Change 保持为短期计划目录并移除 archive；本 Plan 不为 Change 增加长期记录 ID 或修改其 CLI。
- ID owner、索引键和关系 target 的变化达到长期 Decision 门槛；Change artifacts 只保存实施上下文。

## Goals / Non-Goals

目标：

- 明确区分稳定领域 ID、可重复语义 name、当前 sourcePath 和任意开放 reference。
- 让 Decision/Investigation 的 ID 由记录内容声明，文件 basename 或 lifecycle 目录变化不自动改变 ID。
- 让索引成为从 ID 定位 sourcePath 的派生查询入口，同时保持 Markdown 是可重建的权威来源。
- 以一次受检迁移闭合当前 Markdown、关系、索引、生成契约和测试，不让新旧 ID 长期混写。
- 为日期 ID、name fallback、指定 ID 索引刷新和正式 rename 提供稳定基础。

非目标：

- 不在本 Change 定义 `YYMMDD-<name>`、name 查询或重名行为；这些由日期身份 Change 承接。
- 不在本 Change 固定新记录优先使用 name 还是 ID 作为文件 basename；只把两者固定为合法选择，并要求存储 owner 安全且不覆盖地分配 sourcePath。
- 不允许索引成为无法从 Markdown 重建的权威写模型；显式 ID 必须存在于记录内容。
- 不建立跨领域全局 ID registry、通用 allocator、UUID 或中央 resolver。
- 不改变 Investigation Resource ID、测试 locator、Git branch/commit、URL 或明确 path/reference 字段的 owner。
- 不在本 Change 实现 rename、指定 ID 索引刷新或 Change Plan selector。
- 不重写 Git 历史、仓库外引用或无法证明属于受管结构字段的正文文本。

## Decisions

### Intended Change

#### 目标模型与实施依赖

```text
Markdown frontmatter.id ──> 稳定领域 ID ──> relations / index key
                                      │
                                      └─> index state.sourcePath ──> 当前文件

文件 basename ──> sourcePath 的一部分；可以等于 name 或 ID，但不定义 ID
```

| 领域实体 | ID owner | 位置 owner | 本 Change 的处理 |
| --- | --- | --- | --- |
| Decision | candidate/正式 Markdown 的 `id` | index state `sourcePath` + lifecycle 目录 | 增加显式 ID，移除 basename 推导和固定路径等式 |
| Investigation | candidate/正式 Markdown 的 `id` | index state `sourcePath` | 增加显式 ID，移除 basename 推导；资源 owner 继续绑定 ID |
| Test Evidence Case | 现有 Case ID | 现有 `sourcePath` | 已分离，保持不变 |
| Task | 现有 Task ID | 无固定文件映射 | 保持不变 |
| Change | 不在本 Plan 定义长期记录 ID | Change 目录 | 由完成后删除 Draft 独立承接 |

记录领域的实施依赖为：

```text
separate-domain-ids-from-storage-details（本 Plan）
└── adopt-date-prefixed-record-identities
    ├── add-selected-id-index-sync
    └── add-record-rename-transactions

adopt-date-prefixed-record-identities ──migration-required/rename──> add-record-rename-transactions

complete-change-plans-by-deletion（短期 Change 生命周期；与记录身份链并行）
```

日期身份只有在本 Plan 完成且显式 ID/sourcePath 契约生效后才能实施；指定刷新和 rename 再消费日期身份的 parser、name index 与 locator。日期 `new` 遇到 legacy 冲突时返回 migration-required，rename 完成后再重试创建。Change Plan 生命周期与该记录链没有实施依赖。

#### 共同身份与位置边界

公开字段只有在表示领域身份时才命名为 `id` 或 `<domain>Id`，并满足：

1. 不包含领域根、lifecycle 目录或 `.md` 等文件扩展名。
2. 唯一性由领域集合定义；领域类型由命令/API 上下文提供，不拼进 ID。
3. name 是从领域 ID 规则取得或由领域内容声明的语义查询键，可以重复，不承担精确身份。
4. 位置由 `sourcePath` 或其他明确 path 字段表达。
5. 文件 basename 与 ID 相同只是一种存储选择，不形成校验不变量。

本 Change 不抽取共享语法 parser。各领域继续验证自己的 ID、path 和生命周期规则，只共享可观察概念。

#### Decision 与 Investigation 的显式 ID

两个领域的 candidate 和正式 Markdown frontmatter 增加必填 `id`。Reader 在解析内容后取得 ID，scanner 同时记录独立 sourcePath；同一集合中重复 ID、重复 sourcePath、内容 ID 与调用方预期 ID 不一致或越出受管根都失败。

派生索引以文档 ID 为 key，并在每项 state 中保存规范 sourcePath。读取单项时先由新鲜索引取得 sourcePath，再读取文件并验证 frontmatter ID 与请求 ID 相同；全量重建则扫描受管文件、解析显式 ID 后构造完整投影。索引仍可删除重建，不能成为 ID 的唯一事实源。

Decision 的 active/archive 位置和 Investigation 的 candidate/formal 标记继续存在，但只参与 sourcePath 和 lifecycle 判断。工具不得再用 `sourcePathForDecision(id, status)` 或 `reportPathForInvestigationId(id)` 一类固定等式验证身份；资源 owner 仍可使用 Investigation ID，因为它表达资源所属对象，不是报告文件路径。

文件 basename 只能是 `<name>.md` 或 `<id>.md`。两个不同文件不能占用同一个 sourcePath；创建、rename、移动和 publish 的具体选择由使用该能力的下游 Change 固定，所有写入继续 no-overwrite。

#### 输入兼容与迁移

纯 ID 是 extensionless。现有边界若收到一个以 `.md` 结尾的兼容输入，可以大小写不敏感地移除一个末尾后缀后再交给领域 selector；该行为不表示文件路径仍是 ID。真实路径输入必须进入明确的 path/locator 参数。

当前受管记录按以下 cutover 迁移：

1. 从每个现有合法 basename 确定性去掉最后的 `.md`，把结果写入该 Markdown 的新 `id` 字段；文件本身不移动。
2. Reader/scanner 先支持显式 ID，writer 从切换点开始总是写入 ID；旧无字段内容只允许迁移工具读取，不能成为长期双格式。
3. 按领域事务预演 extensionless 关系、ID 唯一性、sourcePath 唯一性和最终图，再改写受管 Markdown 并从同一最终集合重建索引。
4. 更新仓库内调用点、CLI help、skill 契约、Schema/声明和生成产物，并审计当前受管内容。

Task Graph 的开放 references 等字符串不会仅因外形像路径就转换；字段实际承诺领域 ID 时，先由其 owner 明确类型再纳入迁移。

### Resulting Impacts

- **长期决策：** 以 successor Decision 演进“basename 是 Decision ID”的判断，并在仓库模型中固定 ID/name/path 分离原则；旧 Decision 保留历史。
- **Decision Records：** frontmatter、ID grammar、Markdown parser、source scan、candidate/active/archive resolver、关系、query/lifecycle/stage、index definition、Schema/声明和输出协同变化。
- **Investigation Report：** frontmatter、ID grammar、candidate/formal scan、关系、publish/discard/stage、index definition、Schema/声明和输出协同变化；resource owner 仍按稳定 ID。
- **日期身份：** 后续 Plan 在显式 ID 上定义 dated ID 和 name key，不得重新从 sourcePath 猜身份。
- **指定 ID 索引刷新：** ID 不变但内容或 sourcePath 改变时都属于该 ID 的变化；刷新仍发布完整新鲜投影。
- **Rename：** 身份 rename 与 sourcePath rename 不再天然等价，事务必须分别说明是否改 ID、name、path、relations、index 和资源 owner。
- **Change Plan：** lifecycle Draft 独立移除 archive 并完成后删除目录；本 Plan 不为其建立日期 ID、name resolver 或长期身份契约。
- **测试证据：** 修改或新增的最小原生测试入口逐项更新 Test Evidence case；Case ID 本身不改变。

## Risks / Trade-offs

| 风险或取舍 | 控制 |
| --- | --- |
| 显式 ID 增加 Markdown 字段和迁移成本 | 一次 cutover 写入可重建身份事实，避免长期依赖文件名；迁移前完整预演且不移动文件 |
| 两个文件可能声明同一 ID | 全量 scan 在建立投影前检查 ID/sourcePath 双重唯一，任何重复使集合失败 |
| 索引陈旧时 ID 可能指向旧路径 | 单项读取要求索引新鲜并回读验证 frontmatter ID；全量 sync 从 Markdown 重建 |
| 文件路径可变扩大 mutation 面 | sourcePath 变化按同一 ID 的来源变化处理，继续使用领域 lock、revision、no-overwrite 和恢复结果 |
| 开放 reference 字符串可能仍含路径 | 只保证类型声明为 ID 的表面；任意 reference 保留其 owner 语义 |
| 与日期身份、rename、指定刷新并行会重复修改 parser/index | 本 Change 先实施；三个下游 Change 在 readiness 中检查显式 ID/sourcePath 契约版本 |

## Open Questions

无。本 Plan 固定显式 ID 与 sourcePath 解耦、当前数据迁移和下游责任；新记录和 rename 在 name/ID 两种 basename 间如何选择，由首次使用独立路径能力的日期身份与 rename Change 决定。
