# Proposal

本 Change 统一仓库内领域实体 ID 与文件系统定位的边界，使规范 ID 不再包含目录前缀、文件扩展名或归档位置等存储细节。

## Why

当前几个领域对“ID”的定义并不一致：Decision 和 Investigation 把含 `.md` 的 Markdown basename 当作 ID，Change Plan 的单项命令直接接收 `changes/<name>` 一类目录路径，而 Test Evidence Case ID 与 Task ID 已经是与文件位置分离的语义身份。这迫使调用方记忆 `changes/`、`archive/` 或 `.md` 等存储实现，也使索引键、关系 target、CLI selector 和真实路径之间的责任不清。

用户需要的是同一条身份原则，而不是继续为 ID 添加前缀或后缀：领域命令通过纯 ID 选择对象，工具依据领域根和生命周期状态解析实际文件或目录；确实表示位置的值继续明确命名为 `sourcePath`、`changeDirectory` 或其他 path 字段。

## Outcome

- 仓库内所有公开的领域实体 ID 都不包含存储根、生命周期目录或文件扩展名；领域 namespace 由命令/API 上下文提供，不编码进 ID 文本。
- Decision ID 和 Investigation ID 使用扩展名之前的规范 basename，例如 `260904-some-decision`；对应 Markdown 仍由工具映射为 `<id>.md`。
- Change Plan 建立相对 `changeRoot` 唯一的 `changeId`，单项命令通过 `changeId + changeRoot + status` 定位对象，不再要求把 `changes/` 或 `archive/` 写入 ID。
- Test Evidence Case ID 与 Task ID 保持现有纯 ID；路径、任意引用字符串和 locator 只有在其字段本来就表示位置或引用时才保留路径形状，不被误改成 ID。
- 索引键、结构化关系、选择器、结构化输出和新写入内容统一保存纯 ID；`sourcePath`、`changeDirectory` 与资源路径继续只承担定位。
- 当前受管 Decision/Investigation 关系与派生索引在同一迁移中转换为纯 ID；文件位置无需因去除 `.md` 而改名。
- 存储形状输入不再被当作规范 ID。已有调用可在边界层通过明确标记或可无歧义识别的 legacy selector 兼容并立即规范化，但结构化输出和持久内容不回写旧形状；需要跨自定义根操作 Change 时显式提供 `changeRoot`，需要展示或诊断物理位置时读取 path 字段。

## Scope

### Intended Change

建立仓库级“ID 不携带存储细节”的长期契约，并分别调整 Change Plan、Decision Records 和 Investigation Report 的 ID parser、selector、持久关系、索引投影、CLI/SDK 输出及路径 resolver；迁移仓库当前受管数据，保持 Test Evidence 与 Task Graph 已有纯 ID 不变，并校正依赖旧 `.md` ID 形状的 active Change。

### Resulting Impacts

- Decision 与 Investigation 的 ID Schema、关系 target、索引 entry/source revision key、candidate 映射、生命周期/查询/stage 参数和生成声明都会发生兼容性变化。
- Change Plan 的固定 CLI 契约与查询结果需要增加 `changeId`，并把 active/archived 位置选择从路径编码中分离；自定义 Change 根仍然受支持。
- 当前 Markdown 文件名和 Change 目录名继续提供确定性物理映射，但它们只用于解析位置，不再连同后缀或根目录一起暴露为 ID。
- 现有关系与索引必须在一个受检迁移中更新；自由文本、Git 历史、仓库外链接和明确声明为 path/locator/reference 的字段不做猜测性重写。
- 日期前缀身份与 rename Draft 必须改为依赖本 Change 的纯 ID 基线，避免后续重新引入 `.md`。

## Success Criteria

1. Change、Decision、Investigation、Test Evidence Case 与 Task 的规范 ID 示例均不包含所属根目录、active/archive 目录或文件扩展名。
2. Decision/Investigation 的公开 API、CLI、关系和索引只输出并持久化纯 ID；给定纯 ID 可以无歧义解析当前文件位置，移动合法生命周期目录不改变 ID。
3. Change Plan 单项操作只需 `changeId`，并能用显式 `changeRoot` 和 status 选择 custom root 或 archived 对象；结构化结果同时区分 `changeId` 与 `changeDirectory`。
4. 当前受管关系和派生索引完成迁移且没有悬空 target、重复 ID 或仍被当作 ID 的 `.md`/目录前缀值。
5. Test Evidence Case ID、Task ID 和本来表示 path/locator/reference 的字段没有被错误迁移。
6. 相关 skill 契约、长期决策、源码、生成产物、类型/Schema、最小原生测试入口及 Test Evidence 账本一致，主仓库检查通过。

## Affected Owners

- `docs/repository-model.md`、`docs/decisions/` 中的仓库级实体身份边界和 Decision ID 后继判断。
- `skills/change-plan/`、`tools/change-plan/`、`scripts/build/change-plan.ts` 及其生成 CLI。
- `skills/decision-records/`、`tools/decision-records/`、`scripts/build/decision-records.ts`、Decision Markdown 与派生索引。
- `skills/investigation-report/`、`tools/investigation-report/`、`scripts/build/investigation-report.ts`、Investigation Markdown 与派生索引。
- `skills/test-evidence-review/`、`tools/test-evidence/` 和 `tools/task-graph/` 的既有纯 ID 边界回归验证。
- `changes/adopt-date-prefixed-record-identities/` 与 `changes/add-record-rename-transactions/` 的依赖和术语。
- `docs/test-evidence/` 的测试 case 与统一派生索引。
