# Tasks

本清单只实施 `task-000026`：按“Schema 与来源 → 闭合关系 → 派生索引 → API/CLI → 测试证据”的顺序交付仓库内部机制。完成全部任务只证明内部机制可用，不激活 skill 或形成发布候选；真实账本重建和下一次正式分发由依赖它的 `task-000035` 一次性完成。

## Readiness

- [x] 0.1 确认三个 artifacts 使用同一产品模型和交付边界：项目拥有测试实体索引，Case Markdown 拥有唯一关系事实，ledger 拥有可重建 Case 索引；本 change 只实现内部机制。
- [x] 0.2 固定目标路径、实体索引 Schema、Test/Case ID 生命周期、Case `Tests`/`Tags` 格式、双方无悬空不变量、派生 state/key、双来源 revision、查询命令、机器结果和退出状态。
- [x] 0.3 核对实现 owner：新领域代码进入 `tools/test-evidence/src/ledger/`，Valibot 是机器 Schema 真源，派生索引复用现有 `index-runtime`，项目发现器不进入共享实现。
- [x] 0.4 固定发布边界：本 change 不修改构建适配、skill 目录、公共声明或版本；`task-000035` 验收真实账本后才生成下一次正式分发。最终激活前被迫打包允许失败，不为其增加兼容路径。
- [x] 0.5 确认中央 `task-000035` 依赖 `task-000026`，并拥有旧账本暂存、真实实体索引、全部新 Case 零起点重建、审计问题子任务、遗漏对照、最终激活、升级验证和旧档删除。
- [x] 0.6 确认新旧真实布局不能同根并存：`task-000035` 必须先把整个旧账本暂存到固定根外；暂存只用于最后的遗漏对照，不成为第二读取路径。
- [x] 0.7 确认空账本是合法默认状态：空实体索引、缺失或为空的 `cases/` 和零条目派生索引组成闭合双空集合；目录只在添加首个 Case 时建立。
- [x] 0.8 确认当前测试证据责任仍然生效：本 change 新增或修改的每个最小原生测试入口按现行 Topic/Entry 契约维护 Case 并同步旧索引；这些 Case 只满足当前仓库门禁，不参与后续新 Case 设计。

## Implementation

- [x] 1.1 在 `tools/test-evidence/src/ledger/` 定义实体索引、ledger state index、API options、统一诊断、check、sync、Case query/show 和 Test query result 的严格 Valibot Schema 与推导类型；使用 design 固定的领域 `schemaVersion: 5`、字段、排序和未知字段拒绝规则。
- [x] 1.2 实现固定路径的实体索引读取器：检查普通文件与独立文件身份，严格解析和规范化 JSON，拒绝重复或失序实体与 locator，并按 design 的固定词法顺序和规范 JSON 字节计算包含项目 `sourceRevision` 的内容指纹。
- [x] 1.3 实现按需存在的平面 `cases/` 来源读取和 Markdown 解析：把缺失或空目录解释为零 Case；校验唯一首行 Case、Case ID、`Tests`、可选 `Tags`、`Contract`、`Proves`、文件名、目录成员、排序与重复项，以首条 `Proves` 生成 summary，并按 design 生成 Case source revision。添加首个 Case 的维护路径才创建目录。
- [x] 1.4 实现同一 reader 快照上的关系闭合校验：拒绝未知 Test 端点、未关联 Test 实体、空 Case 关系和重复边，生成 Case → Tests 与 Test → Cases 的同源投影及可定位诊断；不实现同时改写两个权威源的中央事务。
- [x] 1.5 以 `definitionVersion: 4` 建立 ledger 的 `index-runtime` 领域适配，按 Case ID 生成精简 state、`search`/`test`/`tag` keys、实体索引 metadata 与双来源 revision；实现投影后的 revision 复核、缺失/无效/陈旧索引内存回退和确定性原子写入，并能写出合法空索引。
- [x] 1.6 在 `tools/test-evidence/src/ledger/index.ts` 实现 `validateTestEvidenceLedger`、`syncTestEvidenceLedgerIndex`、`queryTestEvidenceCases`、`showTestEvidenceCase`、`queryTestEntities` 和对应 Schema；每项操作接收 design 固定的单一 options 对象，异步返回通过 Schema 的机器结果。`show` 在复核来源后组合实体详情，Test → Cases 只从 `test` key 派生。
- [x] 1.7 在 `tools/test-evidence/src/ledger/cli.ts` 实现 `runTestEvidenceLedgerCli` 的 `check`、`sync-index`、`list`、`show` 和 `tests` argv 协议、过滤交集、分页、`0`/`1`/`2` 退出状态和 JSON 输出。`workspaceRoot` 只由 `--root` 提供，`show` 保留 `<case-id>` 位置参数；测试直接导入源码运行。
- [x] 1.8 把独立 ledger fixture 和源码接口测试接入 `test:test-evidence-cli`；按现行 `test-evidence-review` 契约为本 change 新增或修改的每个最小原生测试入口维护旧格式 Case，并用 `bun run sync:test-evidence-catalog` 从合法旧目录同步 `test-evidence-index.json`。在 `task-000026` 结果中记录模块、目标测试、账本检查和延期激活边界。

## Verification

- [x] 2.1 验证 1.1–1.2：用 Schema 与文件系统 fixture 覆盖实体索引合法/非法结构、空集合、重复和失序 ID/locator、未知字段、固定路径、文件身份冲突与内容指纹稳定性。
- [x] 2.2 验证 1.3：用 Markdown fixture 覆盖缺失/空 `cases/`、首个 Case 建目录、合法 Case、零/多 Tag、多 Test、Case ID/文件名、必需段落、重复/失序项、非法 Tag、嵌套目录和非普通文件诊断。
- [x] 2.3 验证 1.4：用关系 fixture 证明空双集合、一对多、多对一和多对多通过；只有一侧为空、未知 Test、未关联 Test、空 `Tests` 和重复边稳定失败。
- [x] 2.4 验证 1.5：验证 ledger index 的 definition、metadata、首条 `Proves` summary、逐 Case revision、三类 key、确定性写入、缺失/无效/陈旧回退、读取中来源漂移、Case → Tests、Test → Cases、Tag 过滤和 `show` 同 revision 组合结果。
- [x] 2.5 验证 1.6–1.7：验证内部 API/CLI 的成功、参数错误和阻断失败，默认/最大分页、过滤交集及全部 `--json` 输出均通过对应 Valibot Schema；确认 `workspaceRoot`、`caseId` 和各过滤参数只出现在 design 规定的接口位置。
- [x] 2.6 验证 1.8：运行 `bun run test:test-evidence-cli` 和 `bun run check:test-evidence-catalog`；确认每个本 change 新增或修改的最小原生测试入口都有合法旧格式 Case，且 1.8 同步的派生旧索引为当前状态。
- [x] 2.7 运行相关类型检查和 `bun run check`，分别记录源码/测试检查与打包或激活检查的结果。内部机制及所有不依赖最终激活的检查必须通过；若统一检查只因 `task-000035` 尚未生成最终 skill 制品而在打包步骤失败，记录为预期延期门禁，不增加兼容实现，也不把该状态声明为可分发。
- [x] 2.8 仅依据三个 artifacts 做实施阅读复核，并审查最终 diff：实现者必须能恢复两份权威源、派生视图、闭合规则、revision 语义、API/CLI、当前旧 Case 维护责任和最终激活边界；持久修改只能落在 design 允许的本 change owner，真实新账本、skill、构建链、版本和长期决策不得提前切换。
