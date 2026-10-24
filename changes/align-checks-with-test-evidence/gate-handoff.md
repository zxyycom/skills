# Gate 实现交接

## 当前结果与 owner

本文件只保存当前 Change 的实施/验证交接；不代替长期 tooling、Gate authoring 或 Case。未提交、未暂存、未执行远端写入；未改动并行调查正文/索引。

- 当前完整 Definition **69 项**，普通 base **66 项**，receipt-managed **58 项**；quick eligible 仍为原 **10 项**。
- 保留完整 ID 集合、learned critical-path 策略、原生 flags/dependencies/resources、精确 receipt、Markdown 完整输入/每轮 links 和 release prepare→authorize→pack 同快照链。
- 输入契约升级为 `project-tool-receipts-v7`，使旧含义的 receipt 不复用；缓存目录沿用既有可丢弃目录，不迁移缓存。调度时长可比性 identity 升为 `gate-native-command-v5`，策略、容量及版本管理 CPU 独占未改。
- 本 owner 修改 Gate 实现/自测、catalog fixture、`package.json#scripts` 和领域 `tests/checks/*.ts`/`tests/run.ts`。其他 agent 拥有的叶子只消费、不并写。Case/index 与长期文档待独立 owner 整合。

## Check 责任与接线

| 项目 | 最终接线 |
| --- | --- |
| RC1 | environment 中真实 `bun run change-plan -- --help` 节点由 repository-tests owner 移至 `tools/change-plan/tests/repository-command.test.ts`；本 owner 接入 CP public-distribution/run。environment 无分发消费，不带生成 provider；其显示名为 Repository bootstrap and maintenance wiring。`scripts/validate.test.ts` 接现有 test:environment，无新增 Check。 |
| RC2/共同 owner | 新 `test:record-operations:shared-contract` → `bun test ./tools/record-operations/tests/checks/shared-contract.ts`。包含 transaction/source-acquisition/reader-batch/reader-snapshot/reader-worker-runtime 五叶；不再挂 DR lifecycle/run。共同运行时、实际共同测试输入、DR/IR 两域 scripts 分发字节及统一 provider 均显式订阅。领域真实 adapter 各自保留。reader-batch 中新增 DR 专属 discovery 节点由 records owner 移回 DR acquisition-safety。 |
| DR source CLI | 新 `test:decision-records:cli-contract` → 同名 wrapper；承接 source 参数/查询/搜索/stage 矩阵。已有 public-distribution ID 保留，只承接 generated-artifacts、search-info（含真实生成 CLI）、cli-query-parity、cli-reallocation、独立 cli-node-protocol；Node protocol 由 records owner 从 cli-args-02 同名移出。不是将真实分发消费当作源码矩阵删除。 |
| RC3 | IR discovery-dependencies、candidate-operations、result-integrity 三叶整体移现有 cli-contract；query/transaction 不再因这三叶静态加载 CLI/stage。保留其所有原生意图，不给窄 Check 盲目追加广 CLI/stage 订阅。 |
| RC4/type-aware lint | `typescript-program` 包含 scripts/tools 及 skills TS/MTS/skill manifests；typecheck 明确覆盖传递程序输入。已安装 lint 使用 `--type-aware`/tsgolint，但本地无 strace，随包 README/help 未提供完整 program-read trace；**未证明它不读取分发 TS**，因此 lint 也保守订阅该能力。format 仍只订阅 repository-code。 |
| RC5/6/7 | skill-validator 包脚本、TE public-boundary、LJ request-and-response 补 `script:check:skill-updaters` 成功前置；原有分发输入保留。 |
| 名称 | TG 显示 CLI contracts and rendering；NC 显示 runtime, history and transactions；LJ 显示 requests, responses, logs and migrations；统一 provider 显示 All skill runtime generation consistency。稳定责任未改变的机器 ID 不变。 |
| E 叶子交接 | 新 `adapter-image-validation.test.ts` 接 LJ request-and-response/run；原 adapter-regressions 的 Node 大 PNG 分发 smoke 留 public-distribution。 |

### typecheck / lint 与生成信任边界

quick 的 typecheck 只证明**当前 TypeScript program 类型有效**，不证明这些分发字节与源码 owner 一致；lint 同样只证明其当前输入的 type-aware 质量政策。这与 RC5/6/7 的语义分发行为/迁移资源消费不是同一证明责任。二者不添加统一生成 provider，不把 quick 变成全生成门禁；源码→产物一致性继续由完整变更/交付范围的既有统一 provider 承担。长期 owner 中泛称“一切分发 consumer”的文字需按此责任澄清，不能为文字一致而扩大 quick。

## 输入裁剪与保守边界

1. DR/IR 的 record/query/maintenance/stage/cli 能力仅承接运行时；新增各实际 Check 的 `*-tests` 能力，测试叶子、fixtures/加载 helpers 归实际 test consumer。live collection checks 不再因共同测试改字节而重跑。
2. 共同 query/candidate/selected-source/sync/native creation/adapter helpers 只进入实际域测试能力。共同 shared-contract 的测试能力只含自己五叶和实际 reader/transaction helpers，不含其他 adapter-only helpers。
3. `domainRuntimeInputs` 不再包含全部 `scripts/**`；Task Graph portable-build 实际完整复制 `scripts/build`、`scripts/lib`，只在 task-graph 能力保留这两树。公共 Definition 实际加载闭包不裁剪。
4. `gate-tests` 保留 scripts、wrappers/run 和全部 `*.test.ts` 叶子字节，并保留其删除/权限/存在事实；去掉不读取的 tools 测试 helper/fixture 内容。当前模型不独立表达路径身份与内容，叶子字节仍保守纳入，没有新建 identity 缓存或依赖推断框架。全局磁盘读取失败/ignored/symlink/起止漂移防护未删。
5. 用一次本地 AST 诊断复核 wrapper 的相对 import 候选；该诊断包含 lazy/type-only 高估，不将候选数量冒充运行闭包。经调用/顶层加载复核，补回 record-stage-evidence、IR CLI 的 publish/resource/index helpers、DR CLI metadata/reallocation helpers 等实际输入。IR transaction 的 cli-contract 候选只有 type import，不因此追加 CLI 运行能力。

## Gate 自测与 Case 交接

### 新增最小原生入口（9）

`impact-check-responsibilities.test.ts`：

- `type-aware checks own conservative generated TypeScript inputs without widening formatter`：生成 TS/MTS/skill manifest 改动选择 typecheck/lint，不扩大 formatter；lint 是保守政策接线证据，不是原生读取 trace。
- `shared readers and transactions own their tests and both generated worker installations`：reader/transaction/source-acquisition 测试及任一域生成 worker 改动选择共同 owner，不误选域 lifecycle/transaction。
- `moved investigation CLI scenarios own their test inputs without rerunning index or transaction checks`：三叶修改归 CLI，旧域 Check 可复用。
- `catalog proof retains leaf removal but ignores unread helper content`：未读 helper/fixture 改内容不重跑 catalog，wrapper/run/叶子改动及真实删除会重跑。
- `generated consumers cannot execute before the unified generation provider passes`：provider failed 时共同/TE/LJ/validator 为 unavailable、原生 duration null，命令未进入 execution。

其他：

- `semantic catalog import collection ignores comments and inert strings`：真实 AST 接线支持 static/dynamic import，comment/block-comment/普通字符串不登记。
- `project automation and test function limits stay independently configured`：独立字面预期锁定 automation/tests 限额，不执行或复测分析算法。
- `project schema validation binds the two owned indexes to authoritative schemas`：独立字面预期锁定两 schema/binding 和身份政策；只消除 native options 的 null prototype 表示差异，不放宽字段观察。
- `CLI consumes native duration facts for quick budgets and report-only scopes`：通过已有 runProject seam 提供受控原生 duration readback，检查 nearest-rank/P90/mean/null/zero 与 quick/full 退出和 machine summary；不靠真实等待构造慢测试，不宣称真实 Gate 性能。

### 名称/证明范围变化

- secret 原容量节点改 `project secret detection keeps its limits and scans selected source and hook files`：删 4097/5121 文件两轮上游容量复测；保留 5120/1MiB/64MiB/空 waiver 独立政策断言和3个真实源/hooks/config选集 smoke。`GATE-SECRET-CAPACITY-001` 不得再声称测试执行了超容量截断。
- `semantic commands match package manifests and retain dedicated integration boundaries` → `semantic commands retain native store, version-control and retired performance entry policies`，不再暗示所有 manifest 全覆盖。
- `incremental Gate rejects corrupt and failed receipts` → `incremental Gate rejects corrupt receipt manifests and unsuccessful Runs`。
- `non-repository fallback executes the complete base catalog` → `non-repository fallback selects all receipt-managed base checks`。
- Novel Cards 输入节点去掉 every，改 representative；构建脚本只影响生成 provider，不冒称直接影响 NC source consumer。
- `incremental Gate proves content across dirty clean commits deletion and rename` → `... deletion and path reintroduction`，当前动作是删除后另路径重建，不是假称 fs.rename。
- 其他既有输入矩阵原生节点名保留，Contract/Proves 应说明 runtime/test 分离、实际 test consumer、typecheck/lint 共享 flag（format 已不同）、helper 与源代码不同传播；不要保留旧的广订阅预期。
- 框架实体 ID 由项目 snapshot 产生，以上仅提供精确 file/name/意图；不手工猜哈希。

## 实际验证与首次失败

全部命令使用已固定 Bun 1.4.2 的 PATH 与 `TMPDIR=/var/tmp`，没有安装/升级工具。

- 19 个 catalog/Definition/native/profile 目标：最终 **19 pass / 0 fail / 0 skip**。首次 18 pass/1 fail 是新增 schema options 断言将上游 null-prototype 对象与普通字面对象直接 deepStrictEqual；已只规范化原型表示，保持独立字段预期，复跑通过。单次 AST catalog 采集约 40ms，仅为本机该次测试观察。
- 初次完整 impact 聚合：55 个节点，48 pass/6 fail/1 skip。6 fail 都是旧测试固定已裁剪的输入传播，按当前真实 consumer 重写矩阵；不是删除失败分支或恢复无关广订阅。
- 改动 impact 子集复跑：**23 pass / 0 fail / 0 skip**，16.44s，非 Gate 性能基准。
- proof + 责任目标（含保守 lint）：**9 pass / 0 fail / 0 skip**，6.52s。
- 最终增加 source-acquisition/skill manifest 输入并收紧共同 helper 订阅后，单独复跑责任文件：**5 pass / 0 fail / 0 skip**，3.43s。
- 本次唯一 skip 精确为 `Gate batch capture rejects expanding or multiline arguments before launch`：它声明 `skip: process.platform !== "win32"`，Linux 不执行 Windows batch 专属协议。当前 dev uid1000；Markdown/输入权限负例均实际执行通过，不是 root skip。
- 只格式化本 owner 的32个实现/接线文件；未写其他 owner leaf。最终类型检查、全 test:check、Case/index、quick/changed、Linux release/Windows 同次制品仍交整合者执行，目标测试不替代它们。

### 本轮精确 runner 命令

以下均加固定 Bun PATH、`TMPDIR=/var/tmp`；不同批次不把耗时相加当 Gate 实测：

```text
node --test scripts/vibe-check-semantic-catalog.test.ts scripts/vibe-check-definition.test.ts scripts/vibe-check-native-selection.test.ts scripts/vibe-check-profiles.test.ts
node --test scripts/lib/vibe-gate/impact.test.ts
node --test scripts/lib/vibe-gate/impact-decision-operation-inputs.test.ts scripts/lib/vibe-gate/impact-local-inputs.test.ts scripts/lib/vibe-gate/impact-input-ownership.test.ts scripts/lib/vibe-gate/impact-routing.test.ts scripts/lib/vibe-gate/impact-check-responsibilities.test.ts
node --test scripts/lib/vibe-gate/impact-proof.test.ts scripts/lib/vibe-gate/impact-check-responsibilities.test.ts
node --test scripts/lib/vibe-gate/impact-check-responsibilities.test.ts
```

`impact.test.ts` 只有首次失败批次，修复后以列明子集验证；不冒称最终完整聚合已运行。首次输出和最终目标结果已在会话与本文件汇总，临时 `/var/tmp/gate-*-output.log` 不进入仓库，完成交接后清理。

## 剩余验证/交付

1. 集中运行 typecheck/lint/format 与完整 test:check；保守 lint 输入调整后复核 quick/source flag 预期。
2. 用当前 snapshot 维护全部新增/迁移/重命名节点的 Case/index，尤其 secret Proves 收窄、共同15+2节点归位、Node protocol 及RC1原意图连续性；不要登记 wrapper。
3. 对新 shared/source CLI Check 运行精确 Bun 入口，结合各 leaf owner 的实际运行证据；机器 catalog/access 检查不替代行为执行。
4. 长期文档同步69/66/58、provider consumer、type-aware边界和输入/调度版本；不将本临时审计路径写入长期 owner。
5. 最终 changed/release/Windows 仍由 root 在稳定工作区窗口核对；并行调查不是本 Change 的输入所有权，不随手 stage 或回滚。

## 阶段复核 G1–G3 修复回应

独立报告 `review-gate-repository.md` 的原发现保留不改；本节记录后续修复，不把修后状态改写成原审查结论。

- **G1**：新增既有能力模型内的 `test-evidence-project = common + scripts/test-evidence/**`，只由 project-snapshot、project-reference-check、migration 三个语义 Check 订阅；核心 Case/runtime 与 public-boundary 不订阅项目 adapter 树。没有恢复 domain-wide `scripts/**`。
- **G2 / strict preparation**：`decision-record` 运行时显式纳入 `decision-strict-preparation.ts`，覆盖 scan-snapshot 的值 import，而不是误当成 type-only。
- **G2 / 新 frontmatter CLI 节点**：检查时 `source-frontmatter-reuse.test.ts` 是无 Git 历史的当前 untracked 文件，同时另一会话在修改 DR 产品源码、分发和新 Case；root 已确认归属。本 owner **没有修改或迁移该文件/节点**。只给当前实际执行它的 record Check 补 decision-query/maintenance/stage/cli/file-text-search 运行时订阅；这些是当前真实 `runSourceCli(sync-index)` 的加载闭包，不是任意新增测试输入。它不消费生成入口，不添加生成 provider。待另一会话提交并稳定后，可另行决定是否把单节点归现有 source CLI；当前以充分输入保护正确性。既有 maintenance/stage/file-text 输入矩阵同步反映这个实际 consumer，域 sibling 测试字节仍不互相传播。
- **G3**：environment 能力补 `tools/skill-validator/src/validation.ts`；它的 Markdown/Node 依赖已在公共输入中。新增 validate 回归仍消费源码，不需要生成 provider。

### 本轮新增 Case 定位（3 个最小原生节点）

均在 `scripts/lib/vibe-gate/impact-check-responsibilities.test.ts`，由现有 impact 聚合注册，不新增 Check/包装文件：

1. `Test Evidence project checks own their adapter tree without widening core or unrelated script inputs`：snapshot/check/migrate 实现、叶子或项目 helper 改动使三项 project Check execute，core/public-boundary reuse；无关 publish 脚本仍不使三项 project Check 重跑。
2. `Decision record acquisition checks own strict preparation and their current source CLI closure`：strict/cli/query/maintenance/stage/shared-search 各代表输入单独变化使当前 record consumer execute；无无必要的生成前置。这是 Gate 输入接线证据，不替另一会话新产品测试判断其语义。
3. `repository environment validation owns its source validator without a generation prerequisite`：源码 validation 单独变化使 environment execute，而无关 CP lifecycle reuse；显式核对无生成前置。

此前“新增9个 Gate 原生节点”在本轮加3后合计12；69/66/58 Check/receipt 数量不变。没有新增/改写其他会话的 frontmatter Case；其6个节点及已创建 Case 不归本 Change 的产品测试实施。

### G1–G3 实际验证

使用固定 Bun PATH、`TMPDIR=/var/tmp`，低并发串行执行：

```text
node --test --test-concurrency=1 scripts/lib/vibe-gate/impact-check-responsibilities.test.ts scripts/lib/vibe-gate/impact-decision-operation-inputs.test.ts scripts/lib/vibe-gate/impact-local-inputs.test.ts scripts/lib/vibe-gate/impact-input-boundaries.test.ts
```

结果 **21 pass / 0 fail / 0 skip**，20.32s；包含3个新增输入回归及受影响旧runtime矩阵、输入预算、权限、共享能力与provider行为。随后把“无生成 provider”断言收窄为仅排除统一生成前置（不无谓禁止未来其他前置），按两个节点名选择复跑，**2 pass / 0 fail / 0 skip**。只格式化本轮6个Gate文件，定向 `git diff --check` 通过。未运行另一会话产品新测试、完整test:check、类型检查或全Gate，仍由root集中执行。

## 隔离 staged snapshot 验收后的定向修复

### 首次失败与处置

root 的隔离 changed 首次报告：native-selection 389、profiles 422 code lines 超过项目 file-metrics 的360上限；input-ownership 的组合 callback code-density 110 超过100。另 DR/IR 人工测试 `run.ts` 未归入任何域能力，触发 unowned-domain-input，使输入计划 fallback。它们都是本方需要修复的问题，不能把“最终都执行了”当作精确复用承诺成立。

- 将已有独立政策节点从原生 file-selection 行为测试分到 `scripts/vibe-check-native-policy.test.ts`；没有为指标抽 helper，预期仍是原独立字面政策。
- 将 CLI 性能事实消费的3个已有节点从 scope/quick-selection/receipt 测试分到 `scripts/vibe-check-cli-performance.test.ts`；两文件按不同责任组织，不改变性能预算或断言。
- 将原 combined ownership callback 的 runtime传播、adapter-helper输入隔离、domain逐路径归属三个独立证明意图直接拆为三个原生命名节点；没有把内部步骤改成只供隐藏调用的 helper。
- 两个新测试文件通过 `scripts/vibe-check.test.ts` 的显式 static import 接入。当前完整 Check/receipt 数仍69/66/58，quick原10项和所有质量政策不变。

### Case 精确 old → new 定位

以下移动5个节点名称不变、意图连续；更新实体引用/locator，不因移动另造行为责任：

| 旧文件 | 新文件 | 保持的完整原生节点名 |
| --- | --- | --- |
| `scripts/vibe-check-native-selection.test.ts` | `scripts/vibe-check-native-policy.test.ts` | `project automation and test function limits stay independently configured` |
| 同上 | 同上 | `project schema validation binds the two owned indexes to authoritative schemas` |
| `scripts/vibe-check-profiles.test.ts` | `scripts/vibe-check-cli-performance.test.ts` | `CLI enforces only quick budgets including input preparation and late report overhead` |
| 同上 | 同上 | `CLI blocks quick report failure without adding a complete-scope I/O gate` |
| 同上 | 同上 | `CLI consumes native duration facts for quick budgets and report-only scopes` |

`impact-input-ownership.test.ts` 原 `incremental Gate recognizes shared record operations only in actual domain consumers` 原生节点的3个意图现为：

1. **保留原名**：只承担共同 query/sync/candidate runtime传播与精确发布后的 warm复用。
2. **新增** `incremental Gate isolates shared query adapter helpers from unrelated checks`：承担 query-contract helper 只激活DRquery/IRCLI而不激活其它域测试、共同测试、live checks、Gate自测。
3. **新增** `incremental Gate assigns domain-owned inputs to their actual consumers`：承担 `domainInputOwnershipCases` 逐路径矩阵、无未知输入/跨域扩散、发布后warm。现有 `GATE-RECORD-OPERATIONS-INPUTS-001` 的原3条Proves分别归以上节点；按独立意图拆分Case，保留原ID给runtime意图，新增Case ID由Case owner决定。

新输入回归仍在 `impact-check-responsibilities.test.ts`：

- **新增** `domain test aggregates stay owned by their real catalog consumers without fallback`：两域run文件单独变化时plan为incremental、unclassifiedPaths为空，test:check和实际Case catalog检查execute，领域leaf checks复用。

本轮净增3个原生节点（2个意图拆分 + 1个输入回归），此前本方Gate新增12个，因此当前本方Gate新增共15个；移动5节点不计新增。实体ID请由项目snapshot生成，不手工猜hash。

### 人工聚合入口的输入 owner

新增 `decision-test-catalog`、`investigation-test-catalog` 两个现有模型内的精准能力，分别只含common和本域 `tests/run.ts`。ID保持域归属，使 narrowed-domain ownership可闭合；只由真实读取它们的 `script:test:check`（AST catalog）和 `script:check:test-evidence-catalog`（实际项目实体采集）订阅。没有恢复整域tests/runtime广订阅，没有让领域leaf、collection或生成Check假托读取人工run入口。

TE project单元测试使用各自临时workspace，不能因名称含snapshot就声称读取实际仓库两域run；故没有把两个catalog能力盲目订阅到这些unit Check。真正面向当前仓库的Case采集仍通过既有repository-material能力和这两个显式域能力建立输入责任。

### 实际验证

- 使用固定 Bun1.4.2、`TMPDIR=/var/tmp`，六个受影响测试文件以 `node --test --test-concurrency=1` 串行实际执行：**27 pass / 0 fail / 0 skip**，28.25s。包含两个新文件、拆分3意图与新run归属回归；没有运行全Gate或另一会话产品测试。
- 使用当前项目 `createVibeNativeChecks()` 的原生file/function options，**仅缩小文件选集为本轮9个改动文件**（tests与automation沿用各自原area政策），用实际SCC和随包函数analyzer结算：Node24.18下两项 **passed、0 finding、0 blocking finding**。未改policy/limits/waiver，未复测上游算法。
- 首次临时metrics harness以stdin `--input-type=module` 执行时function analyzer为analysis-failed，不能当作源文件指标失败；另一次harness使用CJS require.resolve定位import-only包而启动失败。改为仓库ignored临时`.mjs`文件的公开ESM import、固定Node24.18后原生指标可信通过；不改上游或产品来迎合诊断harness。
- 只格式化本轮9个owner文件；定向`git diff --check`通过。没有stage/commit；原index与另一会话mixed正文/import/11Case均保持。root需要重新精确stage本轮改动、同步Case、再重验完整必要边界。临时metrics harness在交接后删除，不进入长期文件。
