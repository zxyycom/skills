# Proposal

本 Change 建立显式领域 ID、语义名称与文件系统位置的分离边界，并完成 Decision Records 与 Investigation Report 从“basename 即 ID”到“记录拥有 ID、索引解析位置”的 cutover。

## Why

Decision 和 Investigation 当前都从 Markdown basename 推导 ID，并要求索引中的 `sourcePath` 与 ID 具有固定对应关系。调用方因此必须记忆 `.md`、candidate 前缀或 archive 位置，文件移动也会被误解成身份变化；保存文件时即使更适合使用语义名称，也被迫让 basename 等于 ID。

用户需要的是三个独立概念：ID 稳定选择领域对象，name 表达对象语义，source path 只定位当前文件。文件使用 name 或 ID 保存，但不能反向决定对象身份。

## Outcome

- Decision 与 Investigation 的 candidate 和正式 Markdown 都显式保存 extensionless 纯 ID；扫描器从受管内容读取 ID，不再从 basename 推导。
- 派生索引继续以 ID 为唯一 entry key，并在 state 中保存独立 `sourcePath`；给定 ID 通过索引定位文件，不要求 `sourcePath` 与 ID 文本相等。
- 当前受管记录以“现有 basename 去掉末尾 `.md`”初始化显式 ID，关系和索引同步迁移，但现有文件不因本 Change 移动。
- 新旧 reader、关系、选择器、结构化输出和新写入内容只把纯 ID 当身份；一个大小写不敏感的末尾 `.md` 只可作为输入兼容被移除，不能进入持久 ID。
- 文件 basename 只能选择语义 name 或完整 ID；路径唯一性、目录状态和 no-overwrite 继续由存储 owner 检查，不改变 ID 唯一性。
- Test Evidence Case ID 与 Task ID 保持现有纯 ID；明确表示 path、locator 或开放 reference 的字段不因外形相似而改写成 ID。

## Scope

### Intended Change

为 Decision/Investigation 的 Markdown 契约增加显式 ID，解除 ID parser、来源扫描、索引 identity 校验、candidate/formal resolver、关系和 CLI/SDK 输出对 basename 的身份依赖；迁移当前受管内容与派生索引，并固定仓库级 ID/name/path 术语。

### Resulting Impacts

- 两个领域的 frontmatter、Markdown parser、source 类型、扫描与 mutation 都必须把文档 ID 和 `sourcePath` 作为独立字段验证。
- 派生索引必须验证 ID 唯一、sourcePath 唯一、每个 index entry 指向的受管文件确实声明相同 ID，但不得再要求从 ID 算出 sourcePath。
- Candidate、active、archived 和 formal 等生命周期位置继续由领域 owner 管理；位置变化只在显式身份字段不变时保留同一 ID。
- 当前关系与索引需要在同一受检迁移中改为 extensionless ID；自由文本、Git 历史、仓库外链接和明确 path/locator/reference 字段不猜测性重写。
- 日期前缀身份、指定 ID 索引刷新与 rename 必须消费该基线：标准 ID 和 name fallback 属于日期身份，按 ID 接纳索引变化属于刷新计划，身份/位置维护属于 rename。
- Change Plan 是完成后删除的短期计划目录，不作为本 Change 的长期记录身份；其目录选择和生命周期由 `complete-change-plans-by-deletion` 独立承接。

## Success Criteria

1. 每份有效 Decision/Investigation candidate 和正式记录都声明唯一纯 ID；缺失、重复或非法 ID 使集合检查失败。
2. ID、name、sourcePath 在类型、Markdown、索引和结构化输出中可区分；ID 不含存储根、生命周期目录或文件扩展名。
3. 给定 ID 可以通过新鲜索引精确得到 sourcePath 并验证目标内容声明同一 ID；文件 basename 不等于 ID 仍可正常查询和维护。
4. 当前记录完成显式 ID、关系与索引迁移，没有移动现有文件、制造悬空 target、重复 ID/sourcePath 或混合 `.md` ID。
5. Test Evidence Case ID、Task ID 和本来表示 path/locator/reference 的字段没有被错误迁移；Change Plan 未被错误扩展为长期记录身份。
6. 相关长期决策、skill 契约、源码、生成产物、类型/Schema、最小原生测试入口及 Test Evidence 账本一致，主仓库检查通过。

## Affected Owners

- `docs/repository-model.md`、`docs/decisions/` 中的仓库级 ID/name/path 边界和 Decision ID 后继判断。
- `skills/decision-records/`、`tools/decision-records/`、`scripts/build/decision-records.ts`、Decision Markdown 与派生索引。
- `skills/investigation-report/`、`tools/investigation-report/`、`scripts/build/investigation-report.ts`、Investigation Markdown 与派生索引。
- `skills/test-evidence-review/`、`tools/test-evidence/` 和 `tools/task-graph/` 的既有纯 ID 边界回归验证。
- `docs/test-evidence/` 的测试 case 与统一派生索引。
