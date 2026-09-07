# Design

本设计固定 Case、查询和实体快照的输入输出、实现归属与迁移顺序，兑现 [proposal](proposal.md) 的 S1–S8。实施者按 [tasks](tasks.md) 推进，无需重新选择模型或公开接口；现行源码与本设计的差异属于实施工作，不是已生效能力。

## Context

- 当前公开入口是 `tools/test-evidence/src/cli.ts`，由 `scripts/build/test-evidence.ts` 生成 `skills/test-evidence-review/scripts/test-evidence-catalog.mjs`；主仓库短命令仍是 `bun run test-evidence -- ...`。
- `src/ledger/` 已有独立 Case、可选 tags、实体 JSON、索引和多对多检查，但其 source loader、index metadata、show/query 均依赖固定实体 JSON，且拒绝未被引用的实体。采用其中的可复用实现，不直接切换其 CLI。
- [Index Runtime](../../tools/index-runtime/README.md) 已提供严格持久快照读取、currentness 检查、按 ID 的同步和暂存；[文件搜索](../../tools/shared/src/file-text-search/index.ts) 已提供权威文件搜索和资源限额。无需新建共享索引或搜索层。
- [原多对多决策](../../docs/decisions/archive/maintain-closed-many-to-many-test-case-relations.md) 要求双向闭合；[原固定目录决策](../../docs/decisions/archive/fix-test-evidence-workspace-contract.md) 包含 Topic 和只接收 root 的输入边界。它们已由本 Change 的后继决策修订并归档；后继方向需在完整实施与验证成立后才标为 aligned。
- 项目 `test:*` 当前由 Bun test 和一个 Node `--test` 分支执行，原生节点采用 `node:test`。隔离注册探测确认 Bun 1.3.14 的 JUnit 可报告参数化后的 skipped 节点及 Node 专用 native-store 文件的 4 个节点；`--pass-with-no-tests` 使全 skipped 注册退出 0。Node 26 的排除式过滤不提供同样的叶节点清单，因此不使用该路径采集。此证据不表示整仓注册或测试已经通过。

## Goals / Non-Goals

目标：核心统一 Case 语义、存储、索引、查询与 JSON 引用检查；项目拥有实体发现、源输入绑定和本项目覆盖要求；skill 审查可观察证明价值。

非目标：Topic；tag 注册表、层级或别名；Case 间关系和演进图；证明点 ID/实体映射；通用采集平台；核心执行项目代码；测试运行结果仓库；修改外部项目；改变其他领域的索引协议。

## Decisions

### Intended Change

#### D1 Case format

固定源目录为 `docs/test-evidence/cases/`，每个直属普通文件 `<semantic-slug>.md` 只保存一个 Case。根目录只保留 `cases/` 与 `test-evidence-index.json`；空 cases 目录合法，缺失根或 cases 目录报告未初始化，不自动创建 Case。拒绝符号链接、嵌套目录、非 Markdown 成员及索引与 Case 的硬链接身份冲突。

沿用已实现的 ledger 文本形状，减少无关格式改动：

```markdown
### Case AUTH-ROLE-ACCESS-001: 未授权修改被拒绝

Tests:
- `test:example-a`
- `test:example-b`

Tags:
- `access-control`
- `security`

Contract:
- 已存在资源只允许具备修改权限的用户写入；完整规则由项目行为 owner 承接。

Proves:
- 未授权请求返回权限错误。
- 原资源内容保持不变。
```

精确规则：

- ID 继续使用当前 Case 正则 `^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){2,}-[0-9]{3}$`，全集合唯一；身份来自首行，不由 basename 推导，不迁入日期 ID 规则。
- 首行标题非空且无首尾空白。字段顺序固定为 Tests、可选 Tags、Contract、Proves；各字段最多一次，拒绝未知字段、额外 Case 和字段外正文。允许字段间空行，支持 LF/CRLF。
- Tests 至少一项；ID 为不透明非空 token，禁止空白、反引号和控制字符，不解析 runner 前缀。Tests 每项反引号包裹，唯一且按 locale 无关词法排序。
- Tags 不存在表示无标签；存在时至少一项反引号包裹的 kebab-case token，唯一、词法排序。无标签仅使用省略字段，不引入空 Tags 的第二种表示。Tags 不决定路径、身份或行为 owner。
- Contract、Proves 各至少一个非空单行文字列表项，保持人工顺序。标题表达验证意图，Contract 保存必要契约背景与可用的 owner 引用，不强制一个 Markdown heading 或新增 Owner 字段。
- Proves 是 Case 内部验收内容。Tests 集合共同支持它，不要求每个实体单独证明全部条目；不另存反向映射。

重命名或移动测试但意图连续时保留 Case ID；测试拆合不自动拆合 Case。删除实体时重审所有引用 Case；测试正文改变但实体 ID 未变时仍重审 Contract/Proves，不能以引用检查代替语义审查。

#### D2 Entity snapshot and reference checking

项目显式传入以下严格 JSON；不从固定目录自动发现快照，不接受项目回调或配置中的采集命令：

```json
{
  "schemaVersion": 2,
  "source": {
    "projectId": "example-project",
    "scopeId": "registered-tests",
    "revision": "opaque-source-snapshot-id"
  },
  "completeness": "complete",
  "entities": [
    {
      "id": "test:example-a",
      "name": "拒绝未授权修改",
      "locators": ["tests/access.test.ts > 拒绝未授权修改"]
    }
  ]
}
```

- `source` 三字段都是 trim 后非空单行字符串，按原值精确比较；revision 是项目拥有的不透明源输入标识，不要求 Git，也不把时间戳视为新鲜度证明。
- `completeness` 仅接受 `complete | partial`；complete 表示生产者声明已完成该 source/scope 的枚举。partial 是合法交换状态，但不能通过引用有效性门禁。采集失败由生产者非零退出且不发布新文件，不用空 entities 表示失败。
- Entity ID 使用 D1 的同一 token 规则，集合中唯一且排序；name 为非空单行文本，locators 为非空、唯一、排序的单行文本数组。定位信息仅供阅读，不执行。空 entities 仅在生产者确实完成空范围时合法。
- API 额外要求调用方传入 `expectedSource: { projectId, scopeId, revision }`；它必须独立来自该次项目输入，不能由检查器从快照复制后自证。缺失、任一字段不匹配或 partial 均返回未验证的阻断结果，不输出“实体不存在”。核心只核对声明，项目负责声明真实与输入绑定。
- 默认检查当前完整 Case 集合；可选非空、唯一的 `caseIds` 只选择明确存在的 Case，未知选择失败。调用方保证 source/scope 对这些 Case 的全部引用适用。不支持单次多快照合并或自动按 scope 路由。
- Case 结构与输入均有效、expected source 匹配且 completeness 为 complete 后，逐个检查被选 Case 的实体 ID；缺失返回 `reference.entity-missing`，含 Case ID 和实体 ID。未引用的快照实体不使核心失败。空 Case 集合与有效完整快照可通过；有引用而 entities 为空则失败。
- 成功结果只表示相对于指定快照的引用有效；不表示当前源码相同、测试执行通过或 Proves 充分。

引用结果固定为 `{ schemaVersion: 6, status, state, expectedSource, observedSource, snapshotFingerprint, checkedCaseIds, checkedReferenceCount, diagnostics }`。`state` 为 `valid | case-invalid | snapshot-invalid | snapshot-incomplete | source-mismatch | references-invalid`；`status` 为 `ok | error`，只有 valid 为 ok。失败优先级按 Case/选择有效性、快照结构、source 匹配、completeness、引用存在性依次判定；尚未进入引用检查时 checkedReferenceCount 为 0，不输出缺失实体结论。无法解析 observedSource/fingerprint 时为 null。Fingerprint 是规范快照内容的 SHA-256，不进入 Case 索引，也不替代 source revision。诊断沿用领域结构，category 使用 `case | snapshot | reference | index | query`；不输出独立 relation 领域。

核心使用 Valibot 作为外部结构真源，派生输入 JSON Schema 与声明。CLI 严格读取 UTF-8 的显式普通文件，拒绝符号链接、非文件及超过 64 MiB 的快照；API 的 snapshot 参数接收已解析的 unknown 值后做相同 Schema/语义验证，不接受快照文件路径或 locator 回调；workspaceRoot 仍用于读取 Case。

#### D3 Case index and query semantics

复用 Index Runtime 外壳 `schemaVersion: 4`，namespace 保持 `test-evidence`，definitionVersion 升至 6。固定索引文件仍为 `docs/test-evidence/test-evidence-index.json`，metadata 为严格空对象；每个 `entries[Case ID]` 只保存 `{ title, sourcePath, tags, testIds }`，sourcePath 相对测试证据根目录为 `cases/<slug>.md`。不保存 Contract、Proves、searchText、实体详情或实体快照身份。

Source revision 的 metadata 指纹只来自固定空对象；每个 entry 指纹来自 `sourcePath + LF 规范化完整 Case 字节`，所以正文与位置改变均需同步。Case ID 集合与索引/revision key 必须相同，sourcePath 不得重复。

查询与检查分工：

| 操作 | 输入来源与结果边界 |
| --- | --- |
| list / tags | 用共享 `loadStateIndex` 严格加载持久快照及 definition，不调用 readRevision、不读取 Case 或实体 JSON。返回 `source: index`、`currentness: unchecked`；只代表最近同步快照，不承诺当前文件集合。缺失/坏/旧版本索引阻断并提示 sync-index，不自动扫描或写回。 |
| show | 索引按 ID 定位一个文件；只读取该 Case，核对 ID、结构与该 ID 的来源指纹。漂移、缺失、身份替换时阻断并提示 sync-index；不返回旧 metadata 拼接新正文。 |
| search | 先以 current reader 核对 Case 来源 revision，再按 tags/test 筛选 sourcePath，调用既有文件搜索读取权威正文。输入在搜索期间改变则拒绝混合结果；索引陈旧/缺失/无效提示先同步，不自动修复。 |
| check | 完整验证 Case、固定目录、安全边界、索引结构和当前性；不读取实体快照。 |
| sync-index | 从完整合法 Case 重建，写入前复核来源；只写索引，不要求实体快照。无 write 是检查；selected sync 保留共享工具的完整验证与限定接纳语义。 |
| stage-index | 延续共享运行时的 selected staging，metadata 为空，不触及实体 JSON、Case 或项目代码；首次跨 definition 迁移整体暂存索引，不能按 Case 拆分。 |

结构化查询使用 ID 精确匹配、重复 tag 的 AND 条件和单个 test ID 精确匹配，组合条件取交集。未知 tag/test 返回合法空集，不要求这些值存在于实体快照；结果按 Case ID 升序。limit 默认 20、范围 1–1000；offset 为非负安全整数。Tags 返回按词法排序的 `{ tag, caseCount }`，无注册表。list 返回 `{ id, title, sourcePath, tags, testIds }`，不重复保存语义摘要。

Search 使用共享 NFKC/忽略大小写的 `all | any | phrase`，默认 all；tags/test 过滤保持精确。复用文件搜索的路径、UTF-8 与资源边界。候选超过 10,000 文件或读取超过既有 2 MiB/文件、20 MiB/请求上限时返回阻断诊断并要求缩小筛选，不谎报完整无匹配。候选为空时直接返回空集；否则以 files selection 传入明确路径，并将 preview.maxFiles 设为候选数，防止展示上限提前丢失匹配文件。允许缩短展示 preview，但完整 Case 匹配集必须形成后才能按 Case ID 排序并返回 total/分页；无法形成完整集合时不返回成功 total。索引与全文来源 revision 在成功结果中可追溯，搜索不复制正文进入持久索引。

#### D4 Public API and CLI

保留现有分发文件名、主模块检测与导入无副作用规则，所有公开函数从 `src/cli.ts` 统一导出。源码解析/计算由内部 Case、snapshot、reference、index、query 模块承接；不暴露另一套 ledger CLI 或实体查询服务。

| CLI command | 程序化入口与输入 |
| --- | --- |
| `check` | `validateTestEvidence({ workspaceRoot })` |
| `check-refs --snapshot <file> --expect-project <id> --expect-scope <id> --expect-revision <value> [--case <id> ...]` | `validateTestEvidenceReferences({ workspaceRoot, snapshot: unknown, expectedSource, caseIds? })` |
| `list [--id <id>] [--tag <tag> ...] [--test <id>] [--limit <n>] [--offset <n>]` | `queryTestEvidence({ workspaceRoot, caseId?, tags?, testId?, limit?, offset? })` |
| `tags` | `listTestEvidenceTags({ workspaceRoot })` |
| `show <case-id>` | `showTestEvidenceCase({ workspaceRoot, caseId })`，返回受检 Case 与原文，不展开实体 JSON |
| `search <text> [--match all\|any\|phrase] [--tag <tag> ...] [--test <id>] [--limit <n>] [--offset <n>]` | `searchTestEvidence({ workspaceRoot, text, match?, tags?, testId?, limit?, offset? })` |
| `sync-index [--select <case-id> ...] [--write]` | `syncTestEvidenceIndex({ workspaceRoot, mode: check\|write, selectedCaseIds? })` |
| `stage-index <case-id...>` | `stageTestEvidenceIndex({ workspaceRoot, caseIds })` |

全部 CLI 接受 `--root`（默认 cwd）与 `--json`；snapshot 相对路径以解析后的 root 为基准，只读取用户显式指定的文件。非重复参数出现多次、未知参数、空选择或格式非法退出 2；check/查询/引用/文件/同步失败退出 1，成功退出 0。已进入领域命令的可预期失败在 JSON 模式下仍向 stdout 返回对应结果，stderr 为空；usage/不可预期启动失败不伪装为领域成功。

领域结果统一升至 schemaVersion 6，staging 继续保持共享运行时原有结果联合；诊断保留可定位的 category/code、Case/实体 ID、path/line、blocking 和 message。查询结果包含 D3 的来源语义。公开声明继续由 `api/` 的真实公共表面与 Valibot 派生类型承接，不独立发明 SDK。

移除 topics、--topic、list --query 和旧 Topic 类型/导出；help 明确使用 tags/list --tag/search。旧 ledger 的 tests 命令、固定实体索引文件和实体详情 show 不成为公开兼容接口。旧公开调用方随本 Change 改用上述 API，不提供运行时双格式读取或别名兼容。

#### D5 Repository producer and gate

项目实现位于新增 `scripts/test-evidence/`，不随 skill 分发；不增加核心 runner 依赖。

- `snapshot.ts` 对 package.json 中全部 `test:*` 的命令作受限解析：只接受以 `&&` 连接的 `bun test <相对文件...>` 与 `node --test <相对文件...>`，参数必须是显式项目内文件，不接受 shell 展开、重定向或其他命令。新的不支持形状必须失败并扩展项目适配，不能静默跳过。
- 每个唯一文件目标组合由 Bun 注册采集：使用 `--pass-with-no-tests --test-name-pattern=a^ --reporter=junit --reporter-outfile=<独占临时文件>`，注册 Node 专用文件时也使用此路径，但其真实执行仍沿用 Node。按原命令分组采集并取规范实体并集；重复容器发现同一实体可合并，同一报告的重复身份、跨报告的冲突定位则失败。
- JUnit 必须退出 0、结构有效、tests/testcase 数一致、零 failures/errors，且每个 testcase 明确 skipped。注册会加载模块顶层，是项目测试基础设施操作，不称为纯文件读取；不得因此运行测试正文。空/缺失/部分报告阻断。任一容器报告无节点时报告项目范围错误，不伪造完整清单。
- 当前支持模块注册阶段产生的 test/describe 节点与有限参数矩阵，不支持测试正文运行时才创建的子测试。沿容器的项目内模块导入闭包执行 ast-grep 检查，包含 run.ts 导入的注册文件；排除 `t.test`、测试回调内注册等不可在 skipped 阶段完整发现的形状；发现不支持形状时失败，不自动改测试适应账本。该 guard 只承诺已识别的注册语法，不宣称静态分析任意 JavaScript；测试 API 的别名、转交或 helper 注册只有被显式适配后才允许，未识别的使用方式阻断。
- 将 `@ast-grep/cli@0.45.1` 加入根 devDependencies 并同步 pnpm lock；生产器解析项目本地可执行文件，不依赖全局 PATH 或核心安装。按 pnpm 安装规则仅放行该依赖的 postinstall，环境入口检查本地版本；CI 在 frozen-lockfile 安装后验证版本。分发包不携带此依赖。npm 分发和 pnpm 构建脚本要求见 [ast-grep 官方安装说明](https://ast-grep.github.io/guide/quick-start.html#installation)。JUnit 解析复用成熟 XML 依赖，禁止 DTD/外部实体；依赖与锁文件由项目 owner 维护，不手写正则 XML 解析器。
- 从报告的 file、classname/name 建立精确定位；line 仅作诊断，不进入身份。项目 ID 为 `test:` 加 `SHA-256(JSON.stringify([POSIX 相对文件, 完整测试名]))`，因移位不变，因重命名/移动而变化；同名不可区分节点直接失败。locators 保存定义定位和所属原生执行器的精确选择说明，核心不执行它们。
- `source.projectId` 固定为 `skills-workspace`，scopeId 为 `repository-native-tests-v1`。源 revision 由排序的 package/lock/config 文件（包含 pnpm-workspace、测试配置及生产器配置）、当前 scripts/tools/skills 中版本控制可见的测试及运行时源字节、Bun/Node/ast-grep 版本与 platform/arch 指纹组成，排除生成快照、Case、查询索引和执行输出。文件集合及内容在采集前后重取，变化即拒绝发布；不只使用 HEAD。
- `snapshot:test-evidence -- --output <file>` 使用独占输出，不覆盖已有文件；临时报告由生产器精确清理。`check.ts` 在同一调用中取得 expected source、生成独占 JSON、重验输入、读取文件并调用公开 check-refs API；不能让 expected source 直接来自已读 JSON。检查结束再核对输入未漂移，最后清理本次临时文件。
- 保留 `check:test-evidence-catalog` 名称，改为调用该项目 wrapper：先检查 Case/索引，再生产快照、检查引用，最后执行本项目的“快照实体均有 Case”覆盖策略。该策略只由项目实现，核心的未引用实体仍合法。默认 Gate 已调用此命令，继续 fail closed。
- 新生产器测试使用独立 fixture，加入 `test:test-evidence-project`，因此也进入项目枚举范围。只验证当前声明的注册面，测试实际通过仍由各 `test:*` 和 Gate 承接。

#### D6 Implementation and delivery boundary

以 `src/ledger/` 为内部实现起点复用其解析与目录安全能力；将读取拆为 Case-only source 与显式 snapshot 输入，引用检查独立于索引。移除强制反向覆盖、entityIndex metadata、searchText、query/show 的实体依赖。`src/cli.ts` 保持唯一公开门面，旧 Topic/catalog 行为在切换后删除；不为目录整齐而额外移动无关源码。

保留当前共享 staging 与构建路径。禁止核心采集不禁止索引同步/暂存所需的既有 Git 调用；Case 查询及引用检查不启动进程，不能借版本控制能力执行项目命令。构建适配从新 Schema 生成快照/查询/检查的 JSON Schema 和声明，删除只属旧 Topic 或旧 ledger 协议的生成文件。提升 skill 独立版本，更新 behavior/reference/人类说明；源码、分发制品和 API 必须在同一交付中一致。

### Resulting Impacts

#### I1 Migration and recovery

新增项目命令 `migrate:test-evidence -- --snapshot <file> --expect-project <id> --expect-scope <id> --expect-revision <value> [--write]`，由 `scripts/test-evidence/migrate.ts` 承接。默认仅预演；使用独立目录中的转换结果验证 D1、D2 和 D3 后才允许 write。

1. 在公开门面切换前保存旧目录的合法检查结果；迁移脚本保留局部旧格式 parser/validator，只供显式迁移使用，不依赖切换后的 check 识别旧目录。被删除测试的 Case 按现行规则显式删除，新增/变更测试也先维护相应 Case。迁移不能自动丢弃未知 Entry 或失去支持的语义。
2. 每个保留 Case 转到 `cases/<小写 Case ID>.md`，稳定 ID、标题、Contract、Proves 保持；旧 topic ID 作为一个初始 tag。新名字按 ID 确定，不产生 slug 冲突；后续普通文件移动不改变身份。
3. 从独立产生的实体快照按精确文件/完整测试名定位旧 Entry。多个 locator 只能汇合到同一真实实体；零匹配、多匹配或无法解释的 Entry 阻断并输出 Case/Entry，不能哈希旧字符串冒充已发现实体。新增多对多 Case 由维护者明确编辑，不由转换猜测。
4. 预演同时检查旧源 fingerprint、快照 expected source、目标路径不存在或确属本次转换；列出新增/删除路径与 Case ID，构造完整新 Case 索引。旧索引只用于复核，不作为语义来源。
5. 写入前重验源和目标，保存精确旧字节/权限与独占备份；写入新 Case 后发布索引，再逐项移除已验证的旧 Case 和 topic 表。失败时只恢复仍属于本事务的字节；并发变化保留现场并报告恢复未完成，禁止递归删除未知文件。索引和源一起完成才报告迁移成功。
6. 持续复用该显式迁移入口及其 fixture 测试；它不进入新正常读取路径。用户项目的旧格式升级说明提供同样的人工映射、预演与完整验证要求，不携带本仓库采集器。运行时遇到旧目录返回明确迁移诊断，不自动兼容。

当前公开 API、旧 repository-catalog 测试、根 Schema mapping、构建制品与项目规则在同一切换批次更新。1.1–1.6 的准备阶段在隔离 fixture 验证新行为，旧目录仅由现行入口或迁移专用旧验证器维护；新生成模块在正式切换前不构成整仓 Gate 通过的要求。1.7 同批切换正式目录、公开制品、项目 wrapper 与 Gate，再执行完整检查；最终 Gate 不保留旧检查/新检查二选一的豁免。

#### I2 Stable owners and decisions

更新 AGENTS 的 skill 概览、测试证据维护规则，navigation 的源目录/索引 owner，tooling 的项目 JSON 生产与核心检查边界，以及人类说明。保持主仓库全部保留测试需要 Case 的项目策略，不将其写进通用 skill。

按 Decision Records 正式事务，将旧一对一/Topic/固定实体输入与强制双向闭合判断修订为本设计的分工。新方向先以 unaligned 表达，完整行为/迁移/验证成立后才 aligned；沿用已入 Git 的旧记录作为前序，不改写形成时报告。Case 本身不因此增加关系。

#### I3 Verification and cost boundaries

验证按 tasks 的 V1–V8 分组执行：格式和引用、快照边界、无副作用、索引独立性、查询/搜索、迁移/暂存、项目注册与分发。1,000/10,000 个生成 Case 的规模测试核对结果、分页与文件读取次数；list/tags 读取 Case/实体次数必须为零，show 只读目标 Case。不规定机器相关毫秒 SLO，也不把索引免读正文表述为免解析索引。

每个新增/修改原生测试的证据记录按切换阶段对应格式维护。通用 fixture 可以包含非 Bun 的不透明实体 ID，证明核心不解释 runner；它不宣称已实现非 Bun 采集器。源码单测、真实 Node 分发 smoke、项目注册探测和实际产品测试分别报告结果。

主要实现由子代理承担，默认使用 Terra，遇到其无法解决的具体问题再升级 Sol。独立审查安排在稳定阶段点，只判断正确性；最终验收分别安排文档 AI-ready 优化和代码规范/最小实现优化，优化后复跑受影响验证，不把风格偏好当作正确性问题。

## Risks / Trade-offs

- JSON 快照不能自行证明项目当前性；expected source 的真实性和注册期间顶层行为由项目负责，核心只核对声明及引用。
- list/tags 有意只读最近同步索引，不自动检测工作树漂移；修改 Case 后先 sync-index，依赖当前全量结论时运行 check。show/search 的更严格验证与成本不能被 list 的快照语义替代。
- Case 级多对多不提供证明点级自动影响分析；语义审查承担这项成本，不通过扩展关系模型补偿。
- 全 skipped 采集仍会加载测试模块；隔离进程、临时输出、失败闭合和源前后指纹是项目控制，不是核心对任意项目代码的安全保证。
- 旧接口属于显式破坏性升级；更新说明与迁移工具保留恢复路径，但不保留运行时双读。

## Open Questions

无。Case 格式、快照协议、查询语义、公开接口、项目生产器、实现收敛、迁移与验证路径已确定。实施中若实际证据推翻这些前提，停止受影响任务并先修订本设计，不通过 TODO、兼容回退或自行扩大范围绕过。
