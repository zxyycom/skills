# Proposal

本 Change 为 Decision Records 与 Investigation Report 建立日期前缀标准 ID、ID-first 输入解析和 name-to-ID 索引回退，使通常输入既可直接使用标准 ID，也可在名称唯一时只写 name。

## Why

Decision 和 Investigation 都会长期保留形成时记录。历史实例与新实例可以具有相同语义名称，但调用方不应先判断某个字符串“究竟是 ID 还是 name”，也不应记忆随机短码或 UUID。

前置纯 ID Plan 只负责让记录显式拥有 ID，并让 ID 与 sourcePath 分离；它还没有定义标准 ID 外形、name 查询或重名选择。两个领域需要一条共同且确定的输入管线：先识别标准 ID，识别失败才按 name 查索引。

## Outcome

- 新 Decision/Investigation ID 使用 calendar-valid UTC 日期前缀 `YYMMDD-<name>`；日期是标准 ID 的必需组成，不提供关闭选项。
- 所有普通单对象输入先移除一个大小写不敏感的末尾 `.md`，再尝试解析标准 ID；解析成功时按该 ID 精确查索引，失败时把完整剩余文本当 name 查索引。
- name 零命中返回 not-found，一项命中自动取得完整 ID，多项命中返回 ambiguous 并列出标准 ID；不按最新日期、状态或目录顺序猜测。
- 新建入口使用同一分类：输入是标准 ID 时验证其日期与本次形成日期一致；输入是 name 时由工具自动添加本次 UTC 日期形成新 ID。
- 索引提供 ID 到 state/sourcePath 的精确定位和 name 到一个或多个 ID 的查询；所有持久关系继续只保存完整 ID。
- 记录的 sourcePath 与 ID 分离；新建时 name locator 在完整生命周期目标中可用就优先保存为 name，发生路径占用时才使用完整 ID locator，输入解析和身份判断始终不依赖文件名。
- 现有无日期 legacy ID 不立即批量迁移；只要其 name 唯一，普通 name 输入仍能解析。新建将造成名称冲突时零写入返回 `migration-required` 和 rename 指引，先为 legacy 记录补成标准 dated ID，再由用户重试创建。
- 同一天创建同名实例导致完整 ID 已存在时零写入失败，要求复用原对象或提供更具体的 name；不追加时分秒、随机短码或序号。

## Scope

### Intended Change

在两个记录领域共同固定 `YYMMDD-<name>` 的可观察语法和“后缀规范化、标准 ID 优先、name 索引回退”的输入顺序，并分别接入现有 parser、索引、创建、关系、查询、生命周期和 stage；同时实现 name/ID 两种 basename 的确定性路径分配，以及 legacy 冲突前的零写入迁移指引。

### Resulting Impacts

- Decision candidate 形成日成为标准 ID 日期，建立、归档和重新激活不改变该日期；正式 `createdAt` 继续表示建立时间。
- Investigation 标准 ID 日期必须与 `formedAt` UTC 日期一致，candidate、publish、关系、资源和索引共同使用完整 ID。
- 两个派生索引增加可重复 name key，普通 selector 最终收敛为 ID；sourcePath 继续独立定位 name 或 ID basename。
- `add-selected-id-index-sync` 复用同一 selector-to-ID 管线，`add-record-rename-transactions` 承接 migration-required 指向的显式迁移。

## Success Criteria

1. Decision/Investigation 的普通 selector 均先移除一个大小写不敏感的末尾 `.md`，再尝试 calendar-valid 标准 ID；解析失败才查询完整 name，标准 ID 不存在时不回退。
2. 唯一 name 自动解析到完整 ID，重复 name 稳定返回按 ID 排序的 ambiguous 候选；关系、索引 entry key 和结构化引用只保存 ID。
3. 两个领域的新建都自动使用权威 UTC 形成日，无法关闭日期；直接给出的标准 ID 必须与该日期一致，同日同名冲突不追加随机码或序号。
4. 新记录 sourcePath 只使用 name 或完整 ID basename，name 路径在完整生命周期目标可用时优先，否则退回 ID；解析身份不读取 basename。
5. Unique legacy name 继续可用；即将形成冲突时 `new` 零写入返回 migration-required、建议 dated ID 和 rename/preflight 指引，完成 rename 后可重试创建。
6. 两个 skill 契约、源码、生成产物、类型/Schema、最小原生测试入口及 Test Evidence 账本一致，主仓库检查通过。

## Affected Owners

- `skills/decision-records/`、`tools/decision-records/`、`scripts/build/decision-records.ts`、Decision Markdown 与派生索引。
- `skills/investigation-report/`、`tools/investigation-report/`、`scripts/build/investigation-report.ts`、Investigation Markdown 与派生索引。
- `docs/decisions/` 中两个领域的 ID、name、selector 和形成日期判断。
- `changes/add-selected-id-index-sync/` 与 `changes/add-record-rename-transactions/` 的下游解析和迁移契约。
- `docs/test-evidence/` 的最小原生测试 case 与统一派生索引。
