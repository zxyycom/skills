# Design

本 design 是 `task-000026` 的规范实施契约，固定测试实体索引、Case Markdown、派生 Case 账本索引、闭合门禁、仓库内部机器接口，以及交给 `task-000035` 的最终激活门禁。产品结果、范围和成功标准以 [`proposal.md`](proposal.md) 为准；本文的 `Decisions` 拥有精确数据与行为契约，[`tasks.md`](tasks.md) 只安排实施和验证，不得改变前两者。

## Context

- 当前 [`test-evidence-review`](../../../skills/test-evidence-review/SKILL.md) 与 [`catalog-contract.md`](../../../skills/test-evidence-review/references/catalog-contract.md) 仍以 Topic 目录和 `Entry:` 表达“一项最小原生测试入口对应一个 Case”；当前 `docs/test-evidence/test-evidence-index.json` 是现行查询索引。
- 现行规则要求本 change 新增或修改的每个最小原生测试入口同步维护旧格式 Case。该维护只服务当前仓库门禁，不改变新模型，也不成为后续重建输入。
- 目标状态由 proposal 固定：项目拥有测试实体索引，Case Markdown 拥有 Case 语义、Tag 和唯一关系事实，最终激活后的 skill 拥有可删除重建的 Case 账本索引。这里的“两个索引”不表示关系双写；可写关系只存在于 Case Markdown。
- 现有 `index-runtime` 已支持结构化 metadata、逐条目 revision、text key 和多值 exact key；现有 test-evidence 构建链已使用 Valibot 生成 JSON Schema、TypeScript 声明和可分发 bundle。
- 中央 task graph 中的机制任务是 `task-000026`；迁移任务 `task-000035` 是依赖它的独立根任务。真实实体登记、Case 重建和审计不会成为本 change 的完成条件。
- 长期多对多决策在真实迁移完成前保持 `unaligned`；当前 Topic 工作区决策继续拥有真实仓库行为。具体对齐边界见本文件的 [Decision Alignment](#decision-alignment)。

## Goals / Non-Goals

目标：

- 定义一个只以工作区根定位、从固定测试实体索引读取项目测试实体的共享消费契约。
- 定义精确的实体索引 Schema、Case `Tests`/`Tags` 格式、Case 侧唯一关系和双方无悬空不变量。
- 定义可删除重建的 Case 账本索引，使 Case、Test ID 和 Tag 查询来自同一份派生投影。
- 明确项目实体索引新鲜度检查与共享关系闭合检查的调用顺序和证明边界。
- 复用现有 `index-runtime`，通过仓库内部 API/CLI 和独立 fixture workspace 完整验证新机制。
- 给 `task-000035` 提供稳定的真实迁移契约、切换门禁和问题分解边界。

非目标：

- 不实现或启动项目测试发现器，不生成 Test ID，不合并重复测试，也不接受 provider 配置。
- 不在本 change 中登记本仓库真实测试全集。
- 不批量重建、审计、移动或删除当前 Case；只按现行规则维护本 change 实际触及的测试入口，不把这项维护解释为迁移。
- 不修改与新机制验证无关的真实测试实现，也不建立推测性迁移问题子任务。
- 不让 Topic 与 Tag 并存为两个分类 owner，不建立 Tag 注册表、层级或自动推断。
- 不在关系边上持久化执行顺序、AND/OR、主次、权重、覆盖比例或逐项证明矩阵。
- 不切换 `scripts/build/test-evidence.ts`、`skills/test-evidence-review/`、现行一入口一 Case 流程或默认 `test-evidence-catalog.mjs`，也不提升 skill 版本或生成新 ledger 分发制品。
- 不实现下游 `stage-selected-test-evidence`，也不执行 `task-000035`。

## Decisions

### Delivery and activation boundary

`task-000026` 与 `task-000035` 是同一产品演进的两个顺序阶段，但只有第二阶段完成后才形成可发布状态：

| 阶段 | 必须完成的工作 | 允许的持久修改 | 完成语义 |
| --- | --- | --- | --- |
| `task-000026`（本 change） | 实现并用 fixture 验证新 ledger 的读取、闭合、索引、查询、API 和 argv CLI | `tools/test-evidence/src/ledger/`、相关测试与 fixture，以及现行规则要求的本次触及测试 Case 和派生旧索引 | 内部机制已验证；不是 skill 发布候选 |
| `task-000035`（后续） | 暂存旧账本，建立真实实体索引，从零重建并审计全部新 Case，遗漏对照后切换 skill、构建链、版本和升级路径 | 真实 `docs/test-evidence`、`scripts/build/test-evidence.ts`、`skills/test-evidence-review/`、旧实现和相关长期 owner | 下一次正式分发直接使用新机制 |

本 change 的实现布局固定为：

- `tools/test-evidence/src/ledger/` 按实体索引、Case 来源、闭合校验、派生索引、查询和 CLI 分模块。
- `tools/test-evidence/src/ledger/index.ts` 导出本文固定的领域 API 与 Valibot Schema；`cli.ts` 导出 `runTestEvidenceLedgerCli`。测试直接导入 TypeScript 源码，不依赖已打包模块。
- 内部领域操作只通过 `workspaceRoot` 定位固定布局，不暴露内存 parser、provider hook 或任意文件路径作为第二条接入协议。
- 领域适配复用 `index-runtime`，不从旧 Topic/Entry parser 建立兼容层。
- 当前测试证据 Case 只覆盖本 change 实际新增或修改的测试入口；这些 Case 仍使用现行 Topic/Entry 格式，并随整个旧账本在 `task-000035` 中被暂存和删除，不复制到新账本。

本 change 不修改 `scripts/build/test-evidence.ts`、`tools/test-evidence/api/`、`skills/test-evidence-review/`、`AGENTS.md` 或 skill 版本，也不生成新 ledger bundle、source map、分发声明、JSON Schema 或行为契约。若外部流程在 `task-000035` 前强制打包，允许因新机制尚未激活而失败；该失败不能成为引入双入口、兼容分支或临时版本的理由。

`task-000035` 的最终激活必须同时改写 `SKILL.md`、分发契约、项目维护文档和 `scripts/build/test-evidence.ts`，从已验证的 ledger 源码生成最终 bundle、source map、公共声明和机器 Schema，并提升 skill 版本。现有 updater 会保留新包中缺失的本地文件，因此只从仓库或新 zip 删除旧 catalog 文件不足以完成切换；最终包必须覆盖或明确失效旧可执行入口与旧行为契约，并同时通过全新安装和从当前发布版升级的验证。

### Product model, authority, and data flow

以下术语在本 change 内固定使用：

| 对象 | 含义 | 身份 owner |
| --- | --- | --- |
| Test | 项目认定为可独立选择并单独报告结果的测试实体 | 项目测试发现与身份流程 |
| 测试实体索引 | 项目已经发现、赋 ID 和去重的 Test 及定位元数据 | 固定 JSON 文件 |
| Case | 围绕一个可独立说明、检索和复核的契约结论组织的语义证据文档 | Case Markdown |
| Test–Case 关系 | 某个 Test 是某个 Case 证据集合成员的事实 | Case 的 `Tests` 集合 |
| Tag | Case 的零到多个筛选标签 | Case 的 `Tags` 集合 |
| Case 账本索引 | Case 简易元数据和 Case、Test、Tag 查询投影 | Skill 派生，可删除重建 |

一个 Case 的全部关联 Test 共同构成其证据集合；单条关系只表达成员资格，不表达执行顺序、AND/OR、主次、权重或覆盖比例。Tag 不参与关系闭合，也不能作为证据充分性的证明。

新机制只有两个可编辑权威源和一个派生消费视图：

| 数据 | 唯一写入 owner | 允许的消费者 | 状态 |
| --- | --- | --- | --- |
| Test ID、测试名称、locator、项目来源 revision | 项目的 `test-entity-index.json` 生成或维护流程 | ledger reader、项目新鲜度检查 | 权威源 |
| Case ID、标题、`Contract`、`Proves`、`Tests`、`Tags` | `cases/*.md` 的 Case 维护流程 | ledger reader、语义审查 | 权威源 |
| Case 简易元数据、Test/Tag key、双向查询投影、配对 revision | ledger sync | ledger query；不得人工编辑 | 可删除重建的派生索引 |

Ledger reader 在同一次来源读取中解析两个权威源，先建立唯一 Case → Test 边集合，再校验闭合并构造派生索引。Test → Cases 只从该边集合反向投影；任何索引内容都不能回写或修复权威源。

本文中的“固定词法升序”统一指 locale 无关的 ECMAScript 字符串关系顺序：相等返回 `0`，否则以字符串 `<` 决定先后。所有要求规范排序的 ID、locator 和 Tag 都使用这一顺序。

“项目 source revision”专指实体索引中的不透明 `sourceRevision` 字段；“ledger source revision”专指 `index-runtime` 的结构化 `{ metadata, entries }` 来源清单。前者由项目声明，后者由共享工具根据实体指纹和逐 Case 指纹生成。

### Fixed target workspace contract

新机制只接受 `workspaceRoot`，所有读取位置相对该根固定：

```text
docs/test-evidence/
├── test-entity-index.json
├── cases/                    # 有 Case 时建立
│   └── <semantic-slug>.md
└── test-evidence-index.json
```

- `test-entity-index.json` 是项目拥有并纳入 Git 管理的测试实体索引。
- `cases/` 是按需建立的平面 Case 集合；缺失或空目录都表示零 Case，添加首个 Case 时再创建，不使用目录 marker。每个直属 Markdown 文件只保存一个纳入 Git 管理的 Case。Tag 不映射成目录，也不复制 Case。
- `test-evidence-index.json` 是 skill 从实体索引和 Case Markdown 派生并纳入 Git 管理的 Case 账本索引，可以删除重建但不得手工编辑。
- 目标根没有 Topic 表或 Topic 目录。除上述两个固定 JSON 和可选 `cases/` 目录外的根成员、非 Markdown Case 成员、嵌套 Case 目录和符号链接均为结构错误。该规则意味着新旧真实账本不能在同一个固定根内并存；迁移顺序由后文明确处理。
- 实体索引、派生账本索引和全部 Case 文件必须拥有不同文件系统身份，避免派生写入覆盖权威源。

Ledger 领域操作不接受任意实体索引路径、stdin、任意 Case 根、项目配置或 provider 注册。底层 parser 可以为单元测试接收内存值，但该能力不是另一条项目接入契约。

空账本是合法默认状态。项目先在固定位置写入自己的空实体索引，`sync-index --write` 直接把缺失或为空的 `cases/` 解释为零 Case，并生成零条目的派生索引；它不为零 Case 创建目录，也不替项目创建或猜测 `sourceRevision`。添加首个 Case 的维护步骤负责创建 `cases/`。如果实体索引已经非空但仍没有 Case，闭合检查失败且不得写出可冒充闭合结果的派生索引。

### Project-owned test entity index

固定 JSON 使用严格 Schema；未知字段失败。目标结构为：

```json
{
  "schemaVersion": 1,
  "sourceRevision": "project-defined-revision",
  "entities": [
    {
      "id": "project-defined-test-id",
      "name": "Human-readable test name",
      "locators": [
        "framework-native stable locator"
      ]
    }
  ]
}
```

精确约束：

1. `schemaVersion` 第一版固定为 `1`。
2. `sourceRevision` 是项目拥有的不透明、非空、已 trim、单行字符串，标识生成本文件时使用的测试发现输入快照。共享层回显但不解释其格式。
3. `entities` 按 `id` 固定词法升序排列；`id` 全局唯一，是非空、无空白、无反引号和控制字符的单行 token。
4. `name` 是非空、已 trim 的单行可读名称。
5. `locators` 至少包含一个非空、已 trim 的单行字符串，列表内唯一并按固定词法升序排列。locator 由项目定义，可以表达框架原生选择器、源码定位或等价稳定入口；共享工具只展示，不执行或解释。
6. 文件不保存 Case ID、Test → Cases 反向关系、provider 配置、历史 marker、角色、发现过程诊断或临时失败结果。
7. 同一逻辑测试实体在名称或 locator 改变后继续使用原 Test ID；一个已使用的 Test ID 不得重新分配给另一测试实体。测试拆分、合并或身份实质变化时，由项目流程明确增删 ID 并同步 Case 关系。共享工具不能仅凭元数据判断这一生命周期是否正确。

Schema 允许 `entities` 为空；此时 Case 集合和派生索引条目也必须为空。零 Test、零 Case 不构成悬空，是已初始化账本的合法状态。项目新鲜度检查仍负责区分“项目确实没有测试”和“发现异常地产生空结果”，共享层不能靠 `sourceRevision` 或实体数量猜测。

项目发现或登记工具负责测试实体身份、稳定 ID、去重、确定性排序和完整成功后的文件替换。共享层负责严格读取、拒绝重复或非规范内容，并对规范化的完整 JSON 计算 `sha256` 内容指纹。

实体指纹输入固定为：按 Schema 属性顺序重建已解析对象，保留已经校验的数组顺序，使用无额外空白的 UTF-8 JSON 序列化结果。原文件的缩进、换行和对象属性顺序不参与指纹；`sourceRevision` 和全部实体字段参与指纹。即使项目错误地复用 `sourceRevision`，实体内容变化仍会改变共享指纹。

### Case and Tag contract

每个 `cases/*.md` 第一行仍使用唯一标题：

```markdown
### Case AUTH-ROLE-ACCESS-001: Guest access is rejected

Tests:
- `auth.reject-guest`
- `auth.resource-remains-unchanged`

Tags:
- `access-control`
- `mutation`

Contract:
- Resource mutation follows the caller role boundary.

Proves:
- A guest mutation returns the forbidden result.
- The resource remains unchanged.
```

精确约束：

1. Case ID 继续使用当前全局格式 `^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){2,}-\d{3}$`，在全部 Case 中唯一，且不从 Test ID、Tag 或路径推导。
2. `Tests:`、`Contract:` 和 `Proves:` 各出现一次且均非空；`Tags:` 最多出现一次，缺失表示零个 Tag，出现时必须非空。
3. `Tests:` 的每项用反引号包裹一个实体索引 Test ID；同一 Case 中唯一并按固定词法升序排列。它是唯一关系写入面。
4. `Tags:` 的每项用反引号包裹一个符合 `^[a-z0-9]+(?:-[a-z0-9]+)*$` 的 Tag；同一 Case 中唯一并按固定词法升序排列。
5. `Contract:` 提供理解证据结论需要的最小稳定背景；`Proves:` 每项表达一个可直接判断的可观察结果。两者全文只保存在 Markdown。
6. `sourcePath` 固定为账本根相对路径 `cases/<semantic-slug>.md`；文件名使用 kebab-case semantic slug。
7. 标题之后只允许依次出现 `Tests:`、可选 `Tags:`、`Contract:` 和 `Proves:` 四类字段段落；未知字段、额外 Case 标题、字段重排或字段外正文均为结构错误。`Contract` 与 `Proves` 的列表顺序具有文档语义，不做词法排序。
8. Case ID 跟随可独立复核的语义结论：标题、路径、Tag 或关联 Test 改变但结论身份不变时保留 ID；拆分、合并或实质替换语义结论时分配新 ID，已经退役的 ID 不复用于另一结论。共享结构校验不能自动判断语义身份是否正确。

Case 边界由一个可独立说明、检索和复核的契约结论决定，不由测试数量、测试文件、runner 容器或 Tag 决定。一个 Case 的全部关联测试共同构成证据集合；第一版关系只表达集合成员资格。

### Closed relation gate

全部合法 Case 的 `Tests` 共同构成唯一权威边集合。严格检查针对一次读取中得到的实体索引指纹和 Case 来源 revision，必须同时满足：

1. 实体索引结构合法且 Test ID 唯一。
2. 每个 Case 至少引用一个互不重复的 Test ID。
3. 每条 Case → Test 边的 Test ID 都存在于实体索引。
4. 实体索引中的每个 Test ID 至少被一个 Case 引用。
5. Case → Tests 与 Test → Cases 查询完全从同一边集合派生。
6. Case ID、路径、Test ID 和 Tag 的排序、唯一性与规范格式都合法。

零 Test、零 Case 的双空集合直接满足闭合；只有一侧为空或任一非空 Test/Case 没有关系时才属于悬空。

诊断必须区分实体索引结构、Case 结构、未知 Test 端点、未关联 Test 实体、重复关系和派生索引问题，并携带可定位的路径、Case ID 或 Test ID。共享报告只能声称“对所报告的项目 source revision、实体指纹和 ledger source revision 结构闭合”。

闭合是提交、CI 或迁移切换时必须通过的最终门禁，不要求提供一个同时改写项目实体索引和 Case 的中央原子 CLI。维护过程中可以暂时不闭合；进入可验收状态前必须由严格检查恢复闭合。派生账本索引自身仍使用临时文件和原子替换，避免写出半份索引。

结构闭合不能代替语义充分性。`task-000035` 的审查还必须确认每项 `Proves` 有关联测试提供直接证据、每个关联测试对至少一项 `Proves` 有直接贡献，并且关联集合整体足以支持 Case。

### Snapshot consistency

“同一快照”是由 revision 约束的乐观一致性，不表示项目实体索引和全部 Markdown 由一个文件系统事务同时写入：

1. 完整读取在一次来源遍历中读取实体索引和 Case 原文，并从这些实际字节同时产生领域对象、关系集合和结构化 ledger source revision。
2. `check` 和 `sync-index` 在完成投影后再次执行低成本 `readRevision`；两次 revision 不同即返回 `source-changed`，不得使用或写出该投影。
3. `sync-index --write` 只在 revision 复核通过后以临时文件原子替换派生索引并读回验证。该原子性只保护派生索引文件，不扩大为两个权威源的中央写事务。
4. 查询只使用通过 ledger 领域 Schema、definition identity 和当前 `readRevision` 的持久化索引。需要内存回退时，完整投影也必须在返回前复核 revision。
5. `show` 在读取 Markdown 并组合实体详情后复核目标 Case 指纹和实体指纹；读取期间发生漂移时返回 `source-changed`，不拼接来自两个 revision 的结果。

因此，严格 check report 只能声称结论对其中记录的项目 source revision、实体内容指纹和 ledger source revision 成立。一次查询只在该次调用的 reader 快照内一致；来源随后变化会使下一次打开发现陈旧状态。工具不承诺跨命令持有锁、提供分页快照 token 或持续代表最新工作区。

### Derived Case ledger index

新机制继续使用固定 `test-evidence-index.json`，沿用通用状态索引 `schemaVersion` 和 `namespace: "test-evidence"`，将领域 `definitionVersion` 提升到 `4`。旧工具的 definition `3` 与新工具的 definition `4` 会稳定互拒，不进行隐式投影。

索引 `entries` 以 Case ID 为对象键。每个 `entries[case-id].state` 只保存：

- `title`
- `summary`，确定性取第一条 `Proves`，使列表摘要直接表达该 Case 的首要可观察结论而不是契约背景
- `sourcePath`
- 规范化、排序后的 `testIds`
- 规范化、排序后的 `tags`
- 只用于生成全文搜索 key 的 `searchText`

Case ID 只由 `entries` 对象键保存，state 不再重复身份；查询结果在读取边界附加 `id`。`Contract`、`Proves` 的结构化列表和 Markdown 排版不进入索引；其规范化纯文本会进入内部 `searchText` 和 `search` key 以支持全文检索，但不能作为权威正文读取或回写。

每个条目派生三类 key：

- `search`：text key，覆盖 Case ID、标题、Contract、Proves、Test ID 和 Tag。
- `test`：多值 exact key，值来自 `testIds`。
- `tag`：多值 exact key，值来自 `tags`。

索引 metadata 固定保存实体索引配对信息：

```json
{
  "entityIndex": {
    "schemaVersion": 1,
    "sourceRevision": "project-defined-revision",
    "fingerprint": "sha256:<64-lowercase-hex>"
  }
}
```

索引 `sourceRevision.metadata` 使用规范化实体索引的内容指纹；`sourceRevision.entries[case-id]` 对 JSON 数组 `[sourcePath, normalizedMarkdown]` 的无额外空白 UTF-8 序列化结果计算 `sha256`。`normalizedMarkdown` 只把 CRLF 转为 LF，其他字符保持不变。实体索引内容、Case 新增删除移动或正文变化都会使旧索引失效；实体索引原始 JSON 格式、Case 的 LF/CRLF 差异和派生索引自身不进入来源 revision。

`index-runtime` 已提供结构化 metadata、逐条目 fingerprint、多值 exact key、text key、定义版本校验、内存投影与确定性 sync；新机制直接复用它，不修改公共 runtime。若实施测试暴露 runtime 缺陷，应先修正领域适配；只有领域适配无法表达既定契约时才把 runtime 改动作为本 change 的显式范围变更。

### Internal API and final CLI contract

内部 argv CLI 只读取新固定布局；以下 `test-evidence-ledger.mjs` 表示最终激活后的命令名和本 change 必须验证的 argv 语义。本 change 只实现并直接测试 `runTestEvidenceLedgerCli`，不在 skill 目录生成该文件：

```text
test-evidence-ledger.mjs check --root <workspace-root> [--json]
test-evidence-ledger.mjs sync-index [--write] --root <workspace-root> [--json]
test-evidence-ledger.mjs list --root <workspace-root> [--test <test-id>] [--tag <tag>] [--query <text>] [--limit <n>] [--offset <n>] [--json]
test-evidence-ledger.mjs show <case-id> --root <workspace-root> [--json]
test-evidence-ledger.mjs tests --root <workspace-root> [--query <text>] [--limit <n>] [--offset <n>] [--json]
```

- `list` 返回按 Case ID 排序的 `{ id, title, summary, sourcePath, testIds, tags }`；`--test`、`--tag` 和 `--query` 各最多出现一次，多个不同过滤条件取交集。`--test` 与 `--tag` 使用 exact key，文本查询使用 `search` key。
- 不存在于当前实体索引的 `--test` 是参数错误；符合 Tag 格式但当前没有 Case 使用的 `--tag` 合法返回空集合。
- `show` 返回结构化完整 Case、规范化 Markdown 和按 `testIds` 从当前实体索引组合的 `{ id, name, locators }`，不从派生 state 伪造 `Contract` 或 `Proves`。
- `tests` 按 Test ID 排序返回 `{ id, name, locators, caseIds }`；`caseIds` 从账本索引的 `test` key 派生并按 Case ID 排序。`--query` 匹配 Test ID、名称和 locator，不维护反向关系副本。
- `list` 和 `tests` 默认 `limit` 为 `20`，上限复用 `index-runtime` 的 `1000`；`offset` 默认 `0`。空白 query、非法分页和重复选项属于参数错误。
- 对合法空账本，`check`、`list` 和 `tests` 成功并报告零 Test、零 Case；`show <case-id>` 仍按目标不存在处理。
- 查询优先读取与当前双来源匹配的持久化索引。索引缺失、无效、陈旧或 definition 不匹配时，从完整合法来源建立一次内存投影并返回非阻断 warning；实体索引、Case 或关系不闭合时查询失败。
- `check` 严格验证双来源、闭合关系和派生索引新鲜度；`sync-index --write` 只在双来源及关系合法时确定性重建索引。

新接口的全部机器结果使用领域 `schemaVersion: 5`，并共享严格诊断结构：`category`、`code`、`severity`、`blocking`，以及按问题可选的 `path`、`line`、`column`、`caseId` 或 `testId`。`category` 只取 `entity-index`、`case`、`relation`、`index` 和 `query`，`severity` 只取 `error` 或 `warning`；非阻断索引回退固定为 `severity: "warning"`、`blocking: false`。

机器结果族固定为：

| 结果 | 必需领域内容 |
| --- | --- |
| check report | 实体索引身份、完整 ledger source revision、Test/Case/relation/Tag 计数和诊断 |
| sync result | `mode`、`state`、`changed`、实体索引身份和诊断 |
| Case query result | 简易 Case 元数据、分页、总数和诊断 |
| Case show result | 完整 Case、Markdown、组合后的 Test 详情和诊断 |
| Test query result | Test 元数据、派生 `caseIds`、分页、总数和诊断 |

仓库内部 ledger 模块固定使用现有 test-evidence API 风格：每个领域操作接收一个 options 对象并异步返回对应机器结果；`runTestEvidenceLedgerCli` 接收 argv。导出面固定为：

| 导出 | Options / 输入 |
| --- | --- |
| `validateTestEvidenceLedger` | `{ workspaceRoot }` |
| `syncTestEvidenceLedgerIndex` | `{ workspaceRoot, mode: "check" | "write" }` |
| `queryTestEvidenceCases` | `{ workspaceRoot, testId?, tag?, query?, limit?, offset? }` |
| `showTestEvidenceCase` | `{ workspaceRoot, caseId }` |
| `queryTestEntities` | `{ workspaceRoot, query?, limit?, offset? }` |
| `runTestEvidenceLedgerCli` | `argv: readonly string[]`，默认使用当前进程参数 |

模块同时导出全部输入、持久化数据和机器结果的 Valibot Schema 与推导类型。`workspaceRoot` 是唯一工作区定位参数；`show` 的 `<case-id>` 仍是 CLI 命令的位置参数。`task-000035` 的最终 bundle 和声明直接暴露这组已经验证的接口，不另建第二套适配 API。

CLI 退出状态固定为：`0` 表示合法结果或同步成功；`1` 表示来源、关系、索引、目标读取或目标不存在等领域失败；`2` 表示参数错误，包括未知 Test 过滤值。使用 `--json` 时，可预期领域失败仍向 stdout 写对应结果 Schema，stderr 保持为空；调用方以 `diagnostics[].blocking` 判断结果能否用于当前操作。

Valibot Schema 是实体索引、持久化索引和全部机器结果的结构真源；本 change 直接从 Schema 推导源码类型并验证机器结果。`task-000035` 最终激活时才从同一 Schema 生成分发用 JSON Schema 与 TypeScript 数据声明，不手写第二套数据类型。

### Entity-index freshness composition

固定 JSON 文件就是项目发现层与共享账本层的唯一接入接口，不再定义回调、provider registry 或第二种机器握手协议。项目统一门禁按顺序执行：

1. 项目发现/登记工具执行自身 sync 或 check，确认 `test-entity-index.json` 对当前项目测试全集完整且新鲜。
2. 只有上一步成功，才运行共享 ledger `check`，验证固定文件、Case、关系和派生索引。
3. 消费方记录共享报告中的项目 `sourceRevision`、共享内容指纹和 Case revision，确保结论绑定到明确快照。

共享工具不调用项目发现命令，也不把 JSON 合法、`sourceRevision` 存在或实体数量非零解释为新鲜度证明。本仓库实际使用哪一个发现命令、如何生成稳定 Test ID，由 `task-000035` 根据真实测试框架决定。

### Verification boundary and migration handoff

本 change 使用独立 fixture workspace 覆盖：合法空账本、一对多、多对一和多对多；未知 Test 端点；未关联 Test 实体；空 `Tests`；重复 Test ID、关系和 Tag；非法路径/Tag；实体内容漂移；Case 内容漂移；旧 definition 索引；查询与重建。

Ledger fixture 不复制当前真实 Case，也不把当前 `docs/test-evidence` 当作新模型 fixture。新机制完成后：

1. `task-000026` 以内部源码 API/CLI、fixture 和目标测试证据完成；本任务新增或修改的最小原生测试入口同时按现行 Topic/Entry 契约维护 Case 并同步旧索引。该维护不证明新账本已经迁移，也不生成或验收 skill 分发内容。
2. `task-000035` 开始真实迁移时，先把当前旧账本整体移入固定根之外、受 Git 管理的临时暂存目录。严格根成员规则和复用的 `test-evidence-index.json` 文件名决定了新旧布局不能原地并存，因此这一步是迁移前置，不再留作条件分支；具体暂存路径由迁移任务在执行前固定。
3. 暂存只保留旧账本用于后续遗漏对照，不成为 ledger 的第二读取路径。清空目标根后，项目建立真实实体索引并冻结审计基线。
4. 全部新 Case 从真实 Test 与语义 owner 零开始建立；新 Case ID 按新的语义边界分配，不把旧 ID、路径或正文当作输入、映射要求或完成证据。只有独立建立的新 Case 确实保持同一语义身份时，才可以复用旧 ID。
5. 审计发现的实体识别、测试证据、Case 语义或引用问题按事实登记为 `task-000035` 的子任务；由该任务根据问题是否影响新账本真实性和切换门禁决定后续处理，不在本 change 中预设 disposition。
6. 新账本独立通过结构闭合、语义充分性和查询验收后，才读取暂存的旧 Case 做遗漏对照；不搬运旧 Case，也不建立逐旧 Case 的迁移表。
7. 对照通过后，迁移任务一次性切换 skill/工具 owner 与生成链，提升版本，验证从当前发布版升级后不能继续执行旧行为，清理当前引用，删除仓库内旧实现、旧账本和整个暂存目录，并完成长期决策对齐。

## Risks / Trade-offs

| 风险或取舍 | 控制 |
| --- | --- |
| 固定测试实体索引可能合法但过期 | 项目 sync/check 拥有新鲜度证明；共享报告只承诺所读取的 revision 与 fingerprint |
| 自由多值 Tag 可能出现同义词或拼写漂移 | 第一版只固定 token 规范和精确查询；真实治理需求出现后再建立独立 Tag owner |
| Case 侧真源与账本索引都含 Test ID，可能被误认成双写 | 索引 Test ID 是可删除的派生 state/key；唯一写入面和修改入口仍是 Case Markdown |
| 内部机制完成后、真实迁移前，仓库源码与最后一个已发布 skill 处于不同阶段 | 该仓库状态明确不可发布且打包可失败；`task-000035` 验收后一次性生成并分发新机制，不建立候选双入口或临时兼容层 |
| 本 change 新增测试会触发现行一入口一 Case 规则 | 只维护本 change 实际触及的旧格式 Case 和派生索引；它们不参与新 Case 设计，随整个旧账本在 `task-000035` 中暂存和删除 |
| Updater 会保留新包中缺失的旧本地文件 | 最终切换必须覆盖或明确失效旧可执行入口与行为契约，并用“从当前发布版升级”的 fixture 验证旧行为不可继续使用，不能只检查全新安装 |
| 新旧真实布局不能共用固定根 | `task-000035` 先把旧账本整体暂存到 Git 管理的根外目录，再在固定根建立和验收新账本；对照后删除暂存 |
| `sourceRevision` 由项目声明，可能被错误复用 | 共享层另算完整内容指纹；项目门禁仍负责发现输入的新鲜度 |
| 结构闭合可能被误当成证据充分 | 报告限定为结构闭合；真实语义充分性由 `task-000035` 的逐 Case 审查验收 |
| 两个权威源无法由共享工具原子改写，编辑中间态可能暂时不闭合 | 允许工作区中间态；提交、CI 和切换前统一严格检查，派生索引写入仍原子替换 |

## Open Questions

`task-000026` 没有阻塞问题。空账本、文件契约、关系 owner、查询面、机器结果、内部实现边界、最终激活和迁移顺序均已确定。

以下选择明确延期到 `task-000035`，不由本 change 的实现者提前决定：

- 本仓库使用哪一个项目发现命令、如何从各测试框架生成稳定 Test ID 和 `sourceRevision`。
- 每个真实新 Case 的边界、内容和关联集合，以及审计后实际需要建立哪些问题子任务。
- Git 管理的旧账本临时暂存目录使用哪个具体路径。
- 最终包采用哪种具体覆盖或失效方式阻止升级安装继续调用旧可执行入口与旧行为契约。
- 旧账本删除时，哪些当前引用和生成物需要随默认入口切换一并清理；归档历史本身不改写。

## Decision Alignment

- [`maintain-closed-many-to-many-test-case-relations.md`](../../../docs/decisions/test-evidence-review/maintain-closed-many-to-many-test-case-relations.md) 在本 change 完成后仍为 `unaligned`；机制存在不等于真实账本已经闭合。
- [`fix-test-evidence-workspace-contract.md`](../../../docs/decisions/test-evidence-review/fix-test-evidence-workspace-contract.md) 在迁移前继续拥有当前 Topic 布局；`task-000035` 切换 Tag 布局时再修订并对齐。
- [`260721-separate-test-entry-collection-from-ledger.md`](../../../docs/decisions/test-evidence-review/260721-separate-test-entry-collection-from-ledger.md) 与 [`publish-only-layered-test-evidence-interfaces.md`](../../../docs/decisions/test-evidence-review/publish-only-layered-test-evidence-interfaces.md) 继续保持归档，只提供分层责任的历史依据；旧 inventory 参数、stdin、marker 和角色不恢复。
- [`stage-selected-test-evidence`](../stage-selected-test-evidence/) 已由独立任务完成并归档；`task-000035` 最终切换时仍按既定范围删除旧 catalog 实现及引用。
