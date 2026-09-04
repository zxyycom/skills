# Design

本设计以标准 ID parser 为第一入口，以索引中的 name key 为回退，并让创建事务在 name 输入上自动生成日期 ID；本文仍为 Draft。

## Context

- [`保留型工件重名调查`](../../docs/investigations/260903-explore-name-collisions-in-retained-artifacts.md)说明日期比随机码更能解释不同形成事件；它不是已经生效的长期契约。
- [`显式纯 ID Plan`](../archive/separate-domain-ids-from-storage-details/)先让 Decision/Investigation Markdown 声明 extensionless ID，并让索引独立保存 sourcePath。本 Change 不再从 basename 推导 ID。
- Decision candidate 在 `new` 时形成，但正式 `createdAt` 只在建立时写入；Investigation candidate 已有必填 `formedAt`。两者的日期事实来源不同。
- 当前派生索引以 ID 为 entry key，但没有 name exact key。要支持 name-to-ID 回退，index state 需要保存从 ID 规范得到的 name，并增加可返回多项的 name 查询。
- [`记录 rename Draft`](../add-record-rename-transactions/)负责显式身份和路径迁移。Legacy ID 与 dated ID 同名后，非标准 legacy ID 无法通过标准 ID parser 精确选择，因此创建必须先要求独立 rename，再由用户重试。
- [`指定 ID 索引刷新 Plan`](../add-selected-id-index-sync/)只接收精确 ID scope，不使用 name fallback；它与普通对象 selector 的责任不同。
- Change Plan 不属于本 Change；其 ID 和生命周期由 [`complete-change-plans-by-deletion`](../complete-change-plans-by-deletion/)负责。

## Goals / Non-Goals

目标：

- 固定“去除存储后缀 → 尝试标准 ID → 失败才按 name 查索引”的唯一输入顺序。
- 强制新实例使用真实形成日期和语义 name 组成标准 ID，同时允许调用方直接给出同一标准 ID。
- 让 name 唯一时自动得到 ID，name 重复时强制使用标准 ID。
- 让索引显式承接 ID/name/sourcePath 映射，持久关系只承接 ID。
- 保持 legacy 记录可用，并只在真实名称冲突前要求迁移。

非目标：

- 不把任意数字前缀、非法日期或带路径文本猜成标准 ID。
- 不提供 `--name`/`--id` 两套日常输入模式；普通输入由 parser 确定走 ID 还是 name。
- 不允许 exact ID 查询在标准 ID 不存在时静默回退为 name。
- 不让 name 成为唯一键，不建立跨领域 name registry 或自动选择最新记录。
- 不在本 Change 批量改写全部 legacy ID；冲突迁移由 rename 事务执行。
- 不规定 sourcePath 必须等于 ID，也不把文件移动当成身份变化。
- 不改变 Decision/Investigation 的关系类型、图形状或 lifecycle 语义。

## Decisions

### Intended Change

#### 标准 ID

标准 ID 使用 extensionless `YYMMDD-<name>`：前六位必须构成 calendar-valid 日期，第七位是连字符，后续 name 满足领域语义名称 grammar。示例：

```text
260903-adopt-date-prefixed-record-identities
260903-explore-name-collisions-in-retained-artifacts
```

看似日期但无法通过日期校验的前缀不是标准 ID，例如 `991332-example` 整体作为 name。标准 ID 的日期只投影形成日，不替代精确时间字段。

| 领域 | 本次形成日期 | 精确时间 owner |
| --- | --- | --- |
| Investigation | `formedAt` 的 UTC 日期 | 报告 frontmatter `formedAt` |
| Decision | `new` 创建 candidate 时读取的 UTC 日期 | 建立后的 `createdAt` |

Investigation checker 验证标准 ID 日期与 `formedAt` UTC 日期一致。Decision ID 日期表示 candidate 形成日；后续建立、归档或重新激活都不改变 ID 日期。

#### ID-first 普通输入

需要选择具体 Decision/Investigation 的普通入口复用以下管线：

```text
input
  └─ remove one trailing .md (ASCII case-insensitive)
       └─ parse standard YYMMDD-name ID
            ├─ success -> exact ID lookup
            └─ failure -> exact name lookup in index -> ID
```

固定规则为：

1. 后缀规范化只移除一个末尾 `.md`，大小写不敏感；路径分隔符或其他扩展名不在这里处理。
2. 标准 ID 解析成功后只按完整 ID 查索引。不存在就返回 not-found，不再把同一文本当 name 搜索。
3. 标准 ID 解析失败后，整个规范化文本作为 name，通过 index 的 exact `name` key 查询。
4. name 零项命中返回 not-found；一项命中把结果 ID 作为后续操作输入；多项命中返回 ambiguous，并按 ID 排序列出全部候选。
5. 不用 active 优先、最新日期、文件顺序或首项结果消除歧义。
6. 关系 source/target、lifecycle、publish/discard、trace、stage 和其他单对象 mutation 都先解析到 ID，再执行完整图或事务预演；持久 Markdown 关系和结果引用只保存 ID。

例如集合包含 `260901-review-cache` 和 `260903-review-cache`：输入 `review-cache` 报 ambiguous，输入 `260901-review-cache.md` 去除后缀后按标准 ID 精确命中。输入 `991332-review-cache` 因日期无效，整体按 name 查询。

指定索引刷新也使用这条普通 selector 管线：CLI 可接收标准 ID 或 name，解析完成后才把精确 ID 交给内部 selected scope。只有不直接面向普通用户选择对象的内部 `selectedIds` 类型保持纯 ID。

#### 新建输入

`new` 使用同一个后缀规范化和标准 ID parser，但不会用 name 查询结果替代“形成新实例”的意图：

1. 输入解析为标准 ID 时，提取其中 date 和 name；date 必须等于本次权威形成日期，否则零写入失败，不能借输入 ID 回填或关闭自动日期。
2. 输入未解析为标准 ID 时，完整规范化文本是 name；工具用本次权威形成日期生成 `YYMMDD-<name>`。
3. 最终 ID 已存在时零写入失败；其他日期存在同名 ID 不阻止形成新实例，但会让后续纯 name 输入变成 ambiguous。
4. 所有创建都在领域 mutation lock 内重读最终 ID、name 和目标 sourcePath，并执行 no-overwrite。

#### Name 索引

Decision/Investigation index state 增加规范 `name`，并新增 exact name key。标准 ID 的 name 是日期前缀之后的部分；legacy ID 的 name 是其完整 ID。ID 仍是 entry key，name key 可以返回零项、一项或多项，sourcePath 只定位文件。

索引必须从 Markdown 的显式 ID 重建 name，不从 basename 推断。关系和资源 owner 不保存 name；以后增加同名记录不会改变已有关系 target。

#### SourcePath 分离

新建记录的文件 basename 不参与 ID parser。默认 locator 使用以下惰性分配：如果 name 对应的 candidate、formal 或 lifecycle 目标路径均不会占用既有成员，就使用 name；否则使用完整 ID。工具必须在事务内检查该领域完成创建或 publish 所需的最终路径，而不是只检查眼前 candidate 路径。

例如 name 为 `review-cache` 且没有同名路径时，报告可以保存为 `review-cache.md`，其 frontmatter ID 仍是 `260903-review-cache`；以后形成同名实例时，旧文件不移动，新实例使用 `260904-review-cache.md` 一类 ID locator。两种文件都通过索引的 ID/sourcePath 映射读取，basename 不产生身份优先级。

#### Legacy 冲突

无日期 legacy ID 不符合标准 ID parser，因此普通输入会把它当 name 处理。name 唯一时可以通过索引正常取得该 legacy ID，无需立即迁移。

如果准备创建同名 dated 记录，创建事务必须在写入前识别 legacy name 冲突。因为写入后普通 name 会返回多项，而 legacy 文本仍无法作为标准 ID 精确选择，所以工具不能先制造冲突再补救。

命令固定采用两步 CLI，不把历史迁移隐含进 `new`：

1. `new` 零写入返回稳定的 `migration-required`，报告 legacy ID、建议目标 dated ID，并给出 rename/preflight 的默认操作指引。
2. 用户显式执行并确认 rename；rename 仍按唯一 name 或标准 ID 定位 source。
3. 用户重新执行 `new`，此时再创建新的同名 dated 记录。

该情况预期少见；分步流程比原子“迁移并创建”更容易实现和恢复，也让历史身份变化保持显式。

### Resulting Impacts

- **Decision Records：** 增加标准 ID parser、ID-first selector、candidate 日期生成、index state/name key、查询/lifecycle/关系/stage 接入和稳定诊断；`createdAt` 继续只表示建立时间。
- **Investigation Report：** 增加同一 parser/selector、由 `formedAt` 生成或验证 ID、index state/name key 及 candidate/publish/show/trace/关系/discard/stage 接入。
- **索引：** ID、name、sourcePath 三者明确分离；name 查询可以返回多项，单项 mutation 必须先把结果收敛为 ID。
- **路径：** candidate/formal writer 和 publish 使用“name 路径可用则 name，否则 ID”的确定性 locator；sourcePath 分配、完整 lifecycle 冲突和回读进入事务与测试。
- **Rename：** legacy 同名迁移成为本 Change 避免不可选状态的显式前置步骤；`new` 只返回指引，不调用或隐式执行 rename。
- **指定刷新：** 用户 selector 复用本 Change 的 ID-first/name-fallback 管线，解析后的 selected scope 只包含 ID；sourcePath 或 name state 变化都属于该 ID 的索引变化。
- **长期决策和分发：** 两个领域的身份/selector Decision、skill 契约、源码、生成产物、类型/Schema 和测试同步更新。

## Risks / Trade-offs

| 风险或取舍 | 控制 |
| --- | --- |
| 非法日期样式可能是合法 name | 只有完整通过 calendar-valid 标准 grammar 才走 ID；失败整体走 name，不做部分剥离 |
| 输入恰好是标准 ID 外形但使用者想表达 name | 标准前缀属于 ID 保留语法；exact ID 不存在时不回退，避免同一输入随数据变化改变含义 |
| name 后来重名 | 持久引用只保存 ID；普通 name 查询转为 ambiguous 并列出标准 ID |
| Legacy name 与新 dated 记录冲突后旧记录不可精确选择 | `new` 在写入前返回 migration-required 和默认 rename 指引，不提交不可选状态 |
| sourcePath 与 ID 分离扩大扫描和事务范围 | 使用显式 ID、索引 sourcePath、回读验证、mutation lock 和 no-overwrite 共同闭合 |
| 两个领域同时修改会扩大实施面 | 共享可观察解析规则，代码、事务和测试按领域实现，不建设跨领域记录平台 |

## Open Questions

无。Legacy name 即将冲突时采用显式两步 CLI：`new` 零写入返回 migration-required 和默认 rename 指引，用户完成 rename 后再重试创建。
