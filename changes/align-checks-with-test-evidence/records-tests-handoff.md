# DR / IR / 共同记录测试实施交接

本文件属于本 Change 的短期交接，不是长期行为 owner；完成后随 Change finalize 删除。仅测试、fixture 与此交接发生本代理写入，未改产品 src、生成物、正式 Case/index、领域规则或权限。Gate wrapper、run、能力接线由另一代理维护。

## 实施与 Case 意图

- **共同事务**：`tools/record-operations/tests/transaction.test.ts` 单份承接原 DR 的 15 个纯共同节点（10 个两域重复 + 3 verification + plan/text-snapshot）；10 个 IR 重复注册移除。共同 fixture/原断言不变；两域 `actual domain adapter ...` 原生节点各自在原叶子保留。已有两域 Case 同一共同意图应合并到明确共同 Case，不互指已删除节点；额外 5 个迁移可保留意图连续 Case ID。
- **共同 source**：原 DR acquisition-safety 中两个 `Record source reads ...` 同名移至 `tools/record-operations/tests/source-acquisition.test.ts`，使用共同 reader-fixture 的 plain text，不依赖 DR fixture；别名、移动出去的父目录显式 finally 清理。原 reader-batch 的真实 DR 大发现节点同名移到 DR acquisition-safety，保留 1000 阈值与真实 worker。Case 意图连续，只换实体定位。
- **真实生成 CLI**：`generated Decision Records CLI preserves the Node success and failure protocol` 从 cli-args-02 同名移到 `tools/decision-records/tests/cli-node-protocol.test.ts`；真实 Node、生成入口、退出/stdout/stderr保留，child 加 20 秒 timeout。source args helper 不再提供 Node/generated 路径。
- **B03/B08**：activation/archive 旧 1 节点拆 5 个原生意图；discard 用字面 `use-markdown-establishment` 查询 ID-keyed entries，最终严格 check，保留路径删除与其他成员健康。原 Case 可由多个新节点共同支撑，按独立意图拆 Case 也合理，不再声称整串成功终态本身证明 failure atomicity。
- **索引维护**：旧 1 节点拆 9 个原生意图（definition/projection、canonical重建、purpose、合法unaligned、非法alignment零写保护、坏当前body下published查询、title长度、published关系漂移、显式title同步）。共用既有fixture，不引入新测试框架。原 parser 兄弟节点未改；原 Case 广 Contract 不应单独给每个新节点照抄。
- **B04**：两个真实锁方向加 5 秒目标事件deadline，release Promise 预先创建，finally先放行并等事务settle再恢复patch。IR discard/sync交错也在finally放行并等待。共同真实umask driver 的阻塞 execFileSync 加20秒真实child timeout；两域umask节点仍各在原处。
- **B06/C4**：删除全局 Map.keys、Array iterator、relations.map 猜算法探针。保留完整结果、图API引用相同、旧/新投影隔离、邻接不重扫约束。可用的既有 `getRelationGraph` / `context.graph` seam 明确观察无关系/非法选择不访问图，未加生产hook。IR非法selector与metadata零访问仍有外层观察。对合法小写kebab ID无法区分locale/UTF-16排序的节点，名称诚实收窄稳定target顺序。
- **TRACE2**：DR与IR各删除 1 个精确5/4总batch进程数节点；保留同文件 independent W读取、full pending oid/mode/membership/deletion漂移、required P payload两阶段故障、真实fresh与parse复用/changed bytes/BOM重新解析等现存节点。总进程组织不等于语义阶段，不能改成最低次数继续锁合理单batch复用。JSON.parse复用节点保留，因为owner明确声明同调用纯计算复用；不宣称这些计数独立证明安全。
- **B07**：保留1001条跨1000 reader页阈值。filter节点新增alignment、tag、type、无邻接各自干扰，仍比较未过滤facets与精确分页/evidence；不删除真实分页规模。
- **B09**：身份集成由独立ISO UTC日的开始/结束观察验证新ID，允许UTC午夜翻日；另加5个固定Date→字面预期小节点，覆盖年/月/闰日/offset/世纪格式。集成继续证明创建/冲突/发布接线；queries/scaffold按返回身份定位不新增日期算法claim。
- **C3**：distributed→source CLI，atomically成功终态→具体成功写集，missing/ambiguous/collection-read等未观察承诺收窄。CLI domain-stage真的改resource bytes，并核pending resource blob及report/index边界；领域domain-stage也核所有改/增资源blob及report标题。
- **C4**：默认/显式content相等以外核具体current-text source与Current行预览；index content排除加入仅在索引title的needle；CLI合法source组实际成功并核规范relations/summary与未选base；discard index失败恢复比较report/resource/index完整bytes/mode并核注入错误；资源成员漂移拒绝比较原report/resource/index全部bytes及外部new-member保留；unified discard补实际candidate locator读观察；异常writer错误三类补全文件bytes；候选rename保留完整formedAt；legacy rename资源比较具体bytes；relation cleanup-failure核已提交index relation；relation首改只替换目标relations，其他全文保持。
- **发布契约纠正**：失效formalDrift负例改为独立正向节点：beforePublish编辑未选正式依赖正文后，普通writer成功发布candidate，关系索引正确、依赖当前bytes原样保留、旧candidate位置退出。selected candidate/index漂移各有独立节点，旧resource复合节点拆3个失败/identity drift/同inode bytes成功节点，inode拒绝外层核writer零调用。未扩大产品读取。

## 明确保留与未扩展

- recover callback疑虑已撤回，没有为了它修改共同事务实现或新增零调用节点。
- 真实锁、Git pending/HEAD/blob/mode/CAS、Node安装/worker、1000/1001阈值、umask都保留；不以提速削弱边界。
- C逐行额外“可再加强”不是全部已确认缺陷：candidate-operations现有领域适配、CLI-generated source组现有矩阵、index-relations边界组合、资源warning节点、result-integrity闭合成员及relation-review cleanup保持原证明；其CLI责任归位由Gate代理处理。它们未因同文件/多断言机械拆分。`history identity accepts cr first-three-line source prefixes` 初审虽标duplicate，实际是不同换行兼容证据，保留。
- `strict rename postwrite ... expected index`、`rename ... without crossing postwrite`收窄到实际source/fresh观察；独立写后/source drift与共同phase隔离节点仍保留，没有把精确总读取数升级成新契约。
- 本代理不写正式Case/index；下面为人工Case维护映射，最终Tests必须从统一真实注册快照取实体ID。

## 节点变更清单

以下比较本次Git基线与当前源码的字面注册名；9个index与5个Date节点均已显式字面注册，完整名称另列。未列变化名的已修改节点保持原定位（除下述同名移动），证明补强见上文。Case引用来自原审计inventory和当前Case正文，不是新的引用门禁结论。

### `tools/decision-records/tests/acquisition-safety.test.ts`

- 移除/迁移/更名旧节点：`Record source reads independently prove canonical namespaces without repeated root resolutions`；原Case：RECORD-SOURCE-CANONICAL-OBSERVATIONS-001。
- 移除/迁移/更名旧节点：`Record source reads reject same-inode parent replacement and in-read byte drift`；原Case：RECORD-SOURCE-PARENT-AND-BYTE-DRIFT-001。
- 当前新增定位：`Decision large discovery retains its first worker failure without a later regular-file probe`。

### `tools/decision-records/tests/activation-archive.test.ts`

- 移除/迁移/更名旧节点：`publication and archive transitions preserve content and index atomicity`；原Case：DECISION-ACTIVATION-ARCHIVE-001。
- 当前新增定位：`established decisions reject active reactivation and repeated publication without writes`。
- 当前新增定位：`publication establishes candidate identity and preserves bytes on repeated publication`。
- 当前新增定位：`mark-aligned requires a published baseline and succeeds after explicit missing-index recovery`。
- 当前新增定位：`archive and reactivation preserve creation identity after invalid-index recovery`。
- 当前新增定位：`discard removes an archived decision from both its path and ID-keyed index`。

### `tools/decision-records/tests/candidate-lifecycle/candidate-lifecycle-05.test.ts`

- 移除/迁移/更名旧节点：`activation reconciles unindexed established records before committing a candidate`；原Case：DECISION-CANDIDATE-ACTIVATION-INDEX-001。
- 当前新增定位：`publication preserves established records accepted by explicit index synchronization`。

### `tools/decision-records/tests/cli-args/cli-args-02.test.ts`

- 移除/迁移/更名旧节点：`generated Decision Records CLI preserves the Node success and failure protocol`；原Case：DECISION-CLI-NODE-SMOKE-001。

### `tools/decision-records/tests/index-maintenance/index-maintenance-01.test.ts`

- 移除/迁移/更名旧节点：`index maintenance detects drift and synchronizes canonical decision states`；原Case：DECISION-INDEX-MAINTENANCE-001。

### `tools/decision-records/tests/lazy-relation-graph/context.test.ts`

- 移除/迁移/更名旧节点：`Decision record snapshots build lazily once across validation trace and adjacent relation filters`；原Case：DECISION-LAZY-GRAPH-CONTEXT-001。
- 当前新增定位：`Decision record snapshots access graphs lazily and reuse identity across validation trace and relation filters`。

### `tools/decision-records/tests/lazy-relation-graph/queries.test.ts`

- 移除/迁移/更名旧节点：`Decision query graph reuse preserves option and index failure priority and complete relation diagnostics`；原Case：DECISION-LAZY-GRAPH-FAILURES-001。
- 移除/迁移/更名旧节点：`Decision content search reuses the published graph while reading current text`；原Case：DECISION-LAZY-GRAPH-CONTENT-001。
- 当前新增定位：`Decision queries preserve option and index failure priority and complete relation diagnostics`。
- 当前新增定位：`Decision content search filters published relations while reading current text`。

### `tools/decision-records/tests/record-shared-transactions.test.ts`

- 移除/迁移/更名旧节点：`Decision shared transaction verifies bytes mode and commit before success`；原Case：RECORD-TRANSACTION-READBACK-001。
- 移除/迁移/更名旧节点：`Decision shared transaction preflight avoids locks and unchanged verifies fresh facts`；原Case：RECORD-TRANSACTION-PREFLIGHT-FRESH-001。
- 移除/迁移/更名旧节点：`Decision shared transaction restores only actual precommit writes`；原Case：RECORD-TRANSACTION-ACTUAL-RECOVERY-001。
- 移除/迁移/更名旧节点：`Decision shared transaction protects later bytes inode mode and unwritten members`；原Case：RECORD-TRANSACTION-WINNER-PROTECTION-001。
- 移除/迁移/更名旧节点：`Decision shared transaction retains committed verification and cleanup failures separately`；原Case：RECORD-TRANSACTION-COMMITTED-VERIFICATION-001。
- 移除/迁移/更名旧节点：`Decision shared transaction recognizes a rejected writer that published the index`；原Case：RECORD-TRANSACTION-REJECTED-WRITER-001。
- 移除/迁移/更名旧节点：`Decision shared candidate commit preserves creation and distinguishes cleanup only`；原Case：RECORD-TRANSACTION-CANDIDATE-COMMIT-001。
- 移除/迁移/更名旧节点：`Decision shared transaction never overwrites a recreated old path`；原Case：RECORD-TRANSACTION-OLD-PATH-WINNER-001。
- 移除/迁移/更名旧节点：`Decision shared recovery never claims a replacement inode between writer close and readback`；原Case：RECORD-TRANSACTION-HANDLE-OWNERSHIP-001。
- 移除/迁移/更名旧节点：`Decision shared native creation binds permission verification and recovery to its actual handle`；原Case：RECORD-NATIVE-CREATION-HANDLE-PROOF-001。
- 移除/迁移/更名旧节点：`Decision shared verification acquires overlapping unchanged protection once in each independent phase`；原Case：RECORD-TRANSACTION-PHASE-VERIFICATION-001。
- 移除/迁移/更名旧节点：`Decision shared verification never reuses different namespace or expected snapshot facts`；原Case：RECORD-TRANSACTION-PHASE-VERIFICATION-001。
- 移除/迁移/更名旧节点：`Decision shared postwrite verification rejects later bytes mode and inode despite overlapping fresh protection`；原Case：RECORD-TRANSACTION-PHASE-VERIFICATION-001。
- 移除/迁移/更名旧节点：`shared plan normalizes only unchanged proposals while retaining order index and conflicting protection`；原Case：RECORD-TRANSACTION-PLAN-NORMALIZATION-001。
- 移除/迁移/更名旧节点：`shared fresh text acquisition binds roots isolates mutable proofs and rejects unsafe invalid or missing sources`；原Case：RECORD-PHASE-TEXT-SAFETY-001。

### `tools/decision-records/tests/relation-filter-complexity.test.ts`

- 移除/迁移/更名旧节点：`Decision type-only relation evidence appends linearly and keeps tuple deduplication and code-unit order`；原Case：DECISION-FILTER-EVIDENCE-LINEAR-001。
- 当前新增定位：`Decision type-only relation evidence keeps first summaries tuple deduplication and stable target order`。

### `tools/decision-records/tests/stage-index-payload.test.ts`

- 移除/迁移/更名旧节点：`Decision stage index acquires one preparation pending payload then independent locked and readback payloads`；原Case：DR-INDEX-PAYLOAD-PHASE-COUNT-001。

### `tools/decision-records/tests/stage/stage-03.test.ts`

- 移除/迁移/更名旧节点：`stage rejects invalid duplicate and missing paths without changing the pending snapshot`；原Case：DECISION-STAGE-INPUT-001。
- 当前新增定位：`stage rejects duplicate IDs and path-shaped selectors before opening a missing workspace`。

### `tools/investigation-report/tests/cli-boundaries.test.ts`

- 移除/迁移/更名旧节点：`CLI rejects repeated single-value options before any collection access or candidate creation`；原Case：INVESTIGATION-CLI-SINGLE-OPTIONS-001。
- 当前新增定位：`CLI rejects repeated single-value options without creating collection files`。

### `tools/investigation-report/tests/cli-search-summary.test.ts`

- 移除/迁移/更名旧节点：`distributed investigation search prints exact metadata and lower-bound content summaries on proper channels`；原Case：RECORD-SEARCH-OUTPUT-001。
- 当前新增定位：`source investigation CLI search prints exact metadata and lower-bound content summaries on proper channels`。

### `tools/investigation-report/tests/discard.test.ts`

- 移除/迁移/更名旧节点：`discard identifies a formal report, a missing target, and ambiguous names`；原Case：INVESTIGATION-DISCARD-IDENTIFICATION-001。
- 当前新增定位：`discard identifies a formal report and rejects a missing target`。

### `tools/investigation-report/tests/index-query.test.ts`

- 移除/迁移/更名旧节点：`relation-filter evidence preserves complete UTF-16 ordering and CLI preview budgets`；原Case：INVESTIGATION-RELATION-FILTER-EVIDENCE-001。
- 当前新增定位：`relation-filter evidence preserves stable target ordering and CLI preview budgets`。

### `tools/investigation-report/tests/publish.test.ts`

- 移除/迁移/更名旧节点：`publish preserves candidate resources and rolls renamed candidates back when index publication fails`；原Case：INVESTIGATION-CANDIDATE-PUBLISH-003。
- 移除/迁移/更名旧节点：`publish rechecks candidate, formal source, and index drift before changing files`；原Case：INVESTIGATION-CANDIDATE-PUBLISH-005。
- 当前新增定位：`publish restores candidate text and preserves owner resource bytes when index publication fails`。
- 当前新增定位：`publish rejects owner resource inode drift before index publication`。
- 当前新增定位：`publish accepts same-inode owner resource byte updates while preserving report text`。
- 当前新增定位：`publish rechecks selected candidate drift before changing files`。
- 当前新增定位：`publish rechecks index drift before changing files`。
- 当前新增定位：`publish accepts unselected dependency body drift while preserving its current bytes`。

### `tools/investigation-report/tests/relation-context.test.ts`

- 移除/迁移/更名旧节点：`investigation plain list and metadata search build no relation graph`；原Case：INVESTIGATION-LAZY-QUERY-001。
- 移除/迁移/更名旧节点：`investigation unknown and ambiguous selectors fail before graph construction`；原Case：INVESTIGATION-LAZY-SELECTOR-001。
- 当前新增定位：`investigation plain list and metadata search omit relation evidence and metadata leaves the graph unaccessed`。
- 当前新增定位：`investigation unknown and ambiguous selectors fail without accessing the graph provider`。

### `tools/investigation-report/tests/rename-phase-verification.test.ts`

- 移除/迁移/更名旧节点：`Investigation rename shares hook fresh source and index observations without crossing postwrite phases`；原Case：INVESTIGATION-RENAME-SHARED-FRESH-001。
- 当前新增定位：`Investigation rename acquires fresh source observations after the hook and shares overlapping guards`。

### `tools/investigation-report/tests/staging-domain.test.ts`

- 移除/迁移/更名旧节点：`stage --scope all writes the index projection, report, and owner tree atomically`；原Case：INVESTIGATION-STAGE-SCOPE-ALL-001。
- 当前新增定位：`stage --scope all writes the index projection, report, and owner tree`。

### `tools/investigation-report/tests/staging-index-payload.test.ts`

- 移除/迁移/更名旧节点：`stage index acquires one preparation pending payload then independent locked and readback payloads`；原Case：IR-INDEX-PAYLOAD-PHASE-001。

### `tools/investigation-report/tests/staging-pending-deletion.test.ts`

- 移除/迁移/更名旧节点：`stage all preserves a pure dependency pending deletion without reading its body`；原Case：INVESTIGATION-STAGE-OWNER-PENDING-DEPENDENCY-001。
- 当前新增定位：`stage all preserves a pure dependency pending deletion until explicitly selected`。

### `tools/investigation-report/tests/strict-preparation.test.ts`

- 移除/迁移/更名旧节点：`strict rename postwrite reads only actual rewritten sources and the expected index`；原Case：INVESTIGATION-STRICT-PREPARATION-FACTS-001。
- 当前新增定位：`strict rename postwrite reads each actual rewritten source once`。

### `tools/investigation-report/tests/transaction-boundaries.test.ts`

- 移除/迁移/更名旧节点：`Investigation shared transaction verifies bytes mode and commit before success`；原Case：RECORD-TRANSACTION-READBACK-001。
- 移除/迁移/更名旧节点：`Investigation shared transaction preflight avoids locks and unchanged verifies fresh facts`；原Case：RECORD-TRANSACTION-PREFLIGHT-FRESH-001。
- 移除/迁移/更名旧节点：`Investigation shared transaction restores only actual precommit writes`；原Case：RECORD-TRANSACTION-ACTUAL-RECOVERY-001。
- 移除/迁移/更名旧节点：`Investigation shared transaction protects later bytes inode mode and unwritten members`；原Case：RECORD-TRANSACTION-WINNER-PROTECTION-001。
- 移除/迁移/更名旧节点：`Investigation shared transaction retains committed verification and cleanup failures separately`；原Case：RECORD-TRANSACTION-COMMITTED-VERIFICATION-001。
- 移除/迁移/更名旧节点：`Investigation shared transaction recognizes a rejected writer that published the index`；原Case：RECORD-TRANSACTION-REJECTED-WRITER-001。
- 移除/迁移/更名旧节点：`Investigation shared candidate commit preserves creation and distinguishes cleanup only`；原Case：RECORD-TRANSACTION-CANDIDATE-COMMIT-001。
- 移除/迁移/更名旧节点：`Investigation shared transaction never overwrites a recreated old path`；原Case：RECORD-TRANSACTION-OLD-PATH-WINNER-001。
- 移除/迁移/更名旧节点：`Investigation shared recovery never claims a replacement inode between writer close and readback`；原Case：RECORD-TRANSACTION-HANDLE-OWNERSHIP-001。
- 移除/迁移/更名旧节点：`Investigation shared native creation binds permission verification and recovery to its actual handle`；原Case：RECORD-NATIVE-CREATION-HANDLE-PROOF-001。

### `tools/investigation-report/tests/transaction-sync.test.ts`

- 移除/迁移/更名旧节点：`set-relations atomically applies multi-source replacements and explicit clears`；原Case：INVESTIGATION-RELATION-TRANSACTION-ATOMIC-001。
- 当前新增定位：`set-relations applies multi-source replacements and explicit clears`。

### `tools/record-operations/tests/reader-batch.test.ts`

- 移除/迁移/更名旧节点：`Decision large discovery retains its first worker failure without a later regular-file probe`；原Case：RECORD-READER-FIRST-FAILURE-001。

### `tools/record-operations/tests/transaction.test.ts`

- 当前新增定位：`Record shared transaction verifies bytes mode and commit before success`。
- 当前新增定位：`Record shared transaction preflight avoids locks and unchanged verifies fresh facts`。
- 当前新增定位：`Record shared transaction restores only actual precommit writes`。
- 当前新增定位：`Record shared transaction protects later bytes inode mode and unwritten members`。
- 当前新增定位：`Record shared transaction retains committed verification and cleanup failures separately`。
- 当前新增定位：`Record shared transaction recognizes a rejected writer that published the index`。
- 当前新增定位：`Record shared candidate commit preserves creation and distinguishes cleanup only`。
- 当前新增定位：`Record shared transaction never overwrites a recreated old path`。
- 当前新增定位：`Record shared recovery never claims a replacement inode between writer close and readback`。
- 当前新增定位：`Record shared native creation binds permission verification and recovery to its actual handle`。
- 当前新增定位：`Record shared verification acquires overlapping unchanged protection once in each independent phase`。
- 当前新增定位：`Record shared verification never reuses different namespace or expected snapshot facts`。
- 当前新增定位：`Record shared postwrite verification rejects later bytes mode and inode despite overlapping fresh protection`。
- 当前新增定位：`shared plan normalizes only unchanged proposals while retaining order index and conflicting protection`。
- 当前新增定位：`shared fresh text acquisition binds roots isolates mutable proofs and rejects unsafe invalid or missing sources`。

### `tools/record-operations/tests/source-acquisition.test.ts`

- 当前新增定位：`Record source reads independently prove canonical namespaces without repeated root resolutions`。
- 当前新增定位：`Record source reads reject same-inode parent replacement and in-read byte drift`。

### `tools/decision-records/tests/cli-node-protocol.test.ts`

- 当前新增定位：`generated Decision Records CLI preserves the Node success and failure protocol`。

### 显式字面注册的新原生入口

`tools/decision-records/tests/index-maintenance/index-maintenance-01.test.ts`：

- `index maintenance validates definition recovery and projection validation`。
- `index maintenance validates canonical index rebuild`。
- `index maintenance validates required purpose metadata`。
- `index maintenance validates legal unaligned state`。
- `index maintenance validates invalid alignment zero-write protection`。
- `index maintenance validates published queries with invalid current body`。
- `index maintenance validates source title length validation`。
- `index maintenance validates published relations despite current relation drift`。
- `index maintenance validates explicit synchronization of current title projection`。

`tools/decision-records/tests/localize-record-operations/identity.test.ts`：

- `Decision date identity uses the UTC calendar day for 2026-01-01T00:30:00+01:00`。
- `Decision date identity uses the UTC calendar day for 2024-03-01T00:30:00+01:00`。
- `Decision date identity uses the UTC calendar day for 2025-03-01T00:30:00+01:00`。
- `Decision date identity uses the UTC calendar day for 2000-01-01T00:00:00Z`。
- `Decision date identity uses the UTC calendar day for 2026-12-31T23:30:00-01:00`。

## 实际验证与首次失败

环境：已安装 Bun 1.4.2，`PATH=/home/dev/.local/share/mise/installs/bun/1.4.2/bin:$PATH`、`TMPDIR=/var/tmp`。没有安装依赖、运行全Gate、提交或push（主代理的既有锁依赖恢复不属于本代理）。

- 共同 transaction/source与两域adapter第一批19 pass；之后全部已修改测试leaf串行独立进程运行（除最后新增的CLI Node leaf另测）并取得通过，详见交接消息。reader-batch 4 pass、真实umask两域各1 pass、CLI Node新leaf1 pass/source args剩12 pass。原生wrapper聚合与最终Case覆盖由主代理/Gate代理统一验收。
- 第一次graph wrapper移除残留2处语法括号、content source锚点漏`kind=`，均为本轮测试编辑错误，修正后相应leaf全部通过。
- 首次CLI stage改resource后，旧written-path正则不再涵盖新增resource，新增blob预期遗漏换行；按真实已声明写集与字节契约修正独立预期，11节点重跑通过，没有改产品。
- 一次直接多DR leaf放同一 `bun test file1 file2 ...`，首leaf的既有support after删除fixtureTemplate、后续同进程缓存promise仍指旧目录，后续15个节点ENOENT。现有项目wrapper单入口与逐leaf独立进程不触发此选择方式；未顺手改既有support生命周期。报告首次失败，不把后续逐leaf通过冒充该直接多file命令通过。
- 46 个目标文件 Oxfmt/Oxlint 与 `git diff --check` 已通过；`node_modules/.bin/tsgo --noEmit` 本次全项目类型自检退出0。未做变异、Windows或最终release验证，不能据本批本地通过宣称跨平台或任意复杂度保证。

## Case 集成复验修正

首次公共 snapshot 采集阻断了 index 9 节点和 Date 5 节点的 tuple 解构参数化注册：真实 runner 能独立报告，但既有静态定位不支持该表达。已仅在原测试 owner 改为14个显式字面 `test("原名称", ...)`，保留 helper、独立 fixture、名称与断言，不扩 snapshot adapter、不新建抽象。按本代理新增/拆分集合复核，activation、publish、共同事务/source与独立Node节点均使用显式字面注册，无同形新增动态名称。

固定 Bun 1.4.2、Node v24.18.0、TMPDIR=/var/tmp 下，修改后的 index leaf 9 pass、identity leaf 8 pass，目标 Oxfmt/Oxlint通过。公共 snapshot 已越过本批14节点，随后因另一owner的 `record stage index reuses immutable deterministic target after two fresh acquisitions` found0而失败，未写出预留快照；已交主代理；主代理已指派原 F owner 修复并接手后续公共 snapshot 与 Case 协作，未越权修改 index-runtime。正式 Case/index 仍由集成代理维护。
