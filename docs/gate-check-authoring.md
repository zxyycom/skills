# Gate Check 编写与接入

本文指导维护者在本仓库新增、修改或移除 Gate Check：选择最小责任类型，声明独立可归因的结果、完整输入与成功前置，并交付可复核的测试和门禁证据。

[项目工具链](tooling.md#权威-vibe-门禁)拥有当前 catalog、运行、输入证明、调度、输出与 release 行为；本文拥有接入流程。Vibe 公共 API 的精确字段与生命周期由当前安装版本的随包文档和类型声明承接。

## 推荐工作流

编辑前检查主仓库状态，读取[编码规范](coding-style.md)，确认目标 catalog、测试与 Case 可以安全延续。随后按顺序执行：

1. 明确证明契约、直接失败 owner、完整实际输入、稳定重跑命令、成功前置与 base/release 归属。
2. 按下表选择原生、语义命令、包脚本、自定义或 release DAG Check。
3. 在直接 owner 模块构造 Check，由完整 Definition 组合；身份、依赖、flags 与资源直接进入原生构造器。
4. 项目命令补齐输入 patterns；同步 catalog fixture、受影响项目测试与 Test Evidence Case/index。
5. 运行直接入口、Gate 接入测试和适用门禁，分别报告实际结果与未验证边界。

| 实施前要明确的输入 | 完成标准 |
| --- | --- |
| 证明契约与失败 owner | 结果可独立陈述、验收并直接定位领域责任。 |
| 实际输入 | 覆盖源码、测试/fixtures、磁盘生成物、manifest/lock、配置、共享依赖及必要工具链/环境；未闭合时保守执行。 |
| 重跑入口 | 一条精确 Bun/Node 命令可从项目根独立重现命令 Check。 |
| Check 关系 | 区分成功前置、任意终态观察、数据交接与纯调度压力。 |
| Profile | 普通产品验证进入 base，只有实际交付事务进入 release-only。 |

新验证与既有 Check 证明相同契约且失败 owner 相同，扩展原 Check；契约或失败 owner 独立时建立新稳定身份。粒度不按耗时均衡或进程数量决定。

## 选择 Check 类型

| 目标 | 类型 | 声明位置 |
| --- | --- | --- |
| 重复、指标、JSON、Schema、Markdown 或密钥检查 | 原生 Check | `scripts/lib/vibe-gate/checks/native.ts` |
| 以精确 Bun/Node 测试入口证明项目契约 | 语义命令 Check | `scripts/lib/vibe-gate/checks/semantic.ts` |
| 让稳定 package 维护命令成为独立门禁 | 包脚本 Check | `package.json` 与 `scripts/lib/vibe-gate/checks/package-script.ts` |
| 领域计算需要 prepare、结构化 data、Records 或私有 handoff | 自定义 Check | 直接 owner 模块，由 `definition.ts` 组合 |
| 捕获、授权或消费同一 release snapshot | release DAG Check | `scripts/lib/vibe-gate/checks/release.ts` |

项目测试默认选语义命令 Check；包脚本保留稳定人工维护/聚合身份，不重复承载已有语义 leaf。普通外部命令直接使用 `commandCheck`；只有真实结构协议需要解析完整命令结果时才增加 `afterCommand`。

当前 release-only 只有 prepare、version authorization 与 packaging。新增 release-only Check 改变[交付边界决策](decisions/native-gate-execution-and-project-receipts.md)，须先按 Decision Records 流程判断演进，再复核 release DAG、同快照授权与失败恢复。

## 按需读取随包 API

依赖安装后读取 lockfile 对应的 `node_modules/@zxyycom/vibe-check/`；该目录是下表路径的共同前缀。项目直接使用 TypeScript Definition。

| 任务 | 随包入口 |
| --- | --- |
| 内置 Check 与最小定义 | `README.md` |
| Definition、Run controls、有效 aggregate 与 RunResult | `docs/api-mechanics.md` |
| callback 业务输入与声明式 context | `docs/guides/callbacks.md` |
| 自定义 prepare / execute、终态与 Records | `docs/guides/extending-check-lifecycle.md` |
| 命令 argv/cwd、环境、输出限额与 transcript | `docs/guides/command-check.md` |
| 成功前置、typed provider data 与私有 handoff | `docs/guides/check-dependencies.md` |
| 文件 patterns、原生 region 与计算缓存 | `docs/guides/collecting-project-files.md`、`docs/guides/file-region-index.md`、`docs/guides/cache-results.md` |
| 资源与 learned prepared strategy | `docs/guides/scheduling.md`、`docs/guides/learned-scheduling.md` |
| 运行输出与 machine publication | `docs/guides/run-outputs.md`、`docs/output.md` |
| 某个原生 Check 的完整配置 | `docs/checks/<check-name>.md` |
| 精确签名与泛型 | `types/**/*.d.ts` |

按已安装精确版本的文档与类型核对契约。

## 共同编写契约

### 身份、构造与结果

1. `checkId` 是稳定 machine 身份，显示名、顺序、耗时和资源变化不改语义身份。语义 Check 用 `test:<owner>:<contract>`，包脚本由适配器派生 `script:<package-script>`；`displayName` 用简短英文描述对象。
2. 每次 invocation 保留相同完整 ID 集合。项目输入证明通过原生 flags 选择，不动态删除成员；新增公开 tag 需要独立产品契约设计。
3. 普通命令通过现有 `createSemanticGateCheck` / `createPackageScriptCheck` 构造独立 `commandCheck`，复用共享命令政策和 `gateCheckDeclaration`，取得环境前置及资源声明。argv 保持参数数组；cwd、继承环境、transcript、限额与失败重跑按[运行时 owner](tooling.md#调度与命令执行)维护。
4. 自定义 Check 使用 `prepare` 验证/准备本项 options，使用 `execute` 运行并决定终态。第一业务参数是 options，需要框架字段时通过 `defineContextCallback` 声明第二参数的 context；不依赖未声明字段。
5. `passed` 表示契约成立，`failed` 表示违反规则，带稳定 reason code 的 `unavailable` 表示无法形成可信结论，`not-applicable` 表示本次不适用。passed/failed 的 data 为 object；Records 只作补充事实。可等待 I/O 与子进程协作响应取消，不遗留未等待工作。
6. machine data、Records 与 message 只含安全、有界摘要；完整命令原文进入 Check transcript，敏感业务材料留在授权的 Check-owned artifact。

### 关系、资源与私有交接

1. `dependsOn` 是成功前置，Vibe 只在直接 provider 全部 passed 后启动 consumer；`observes` 等待并审计任意终态。普通依赖无需 wrapper 重复判断状态。
2. 消费公开业务 data 时使用 provider 的 `parseData` 与 dependency reader。消费同 Run 私有对象时用 typed handoff，并以原 provider 对象读取；原生构造器直接接收声明，避免复制 Check 破坏对象身份。
3. `mutex` 表达逻辑互斥，`resourceClaims` 表达可计数压力。命令通常占一个 `external-process`，全仓扫描通常占一个 `repository-scan`，实际同时消耗才组合。
4. 通过现有声明 helper 保留 root、进程、扫描和 release CPU 容量，以及版本管理测试的 CPU 独占。性能 history 不能放宽硬约束；改变任务或命令方式时核对调度 identity 的时长可比性。
5. 消费当前分发生成物的 Check 依赖 `script:check:skill-updaters`。它是 Gate 的统一生成 provider；领域 `check:*` / `sync:*` 是人工定位与同步入口。

### 项目输入证明

原生材料与基础环境每轮实际执行，不进入项目 receipt 集合。语义与包脚本 Check 必须由 `impact-catalog.ts` 完整覆盖，只有已评审闭包才允许复用。

1. 在 `projectInputs` 或领域 `domainInputs` 声明实际读取的 patterns，组合 `commonGateInputPatterns`；共享运行时、build adapters、fixtures、内部 ignored 文件、生成物、TS/MTS、manifest/lock 和配置均按真实消费纳入。新 Check 未识别时空 patterns 保守执行，不臆造安全复用。
2. 新读取域不在现有采集范围时，同步 `impact-paths.ts` 的磁盘目录/配置及已知 owner 判定，覆盖 Git ignore 下仍被命令读取的材料。路径归属与匹配使用原生 region，成功前置仍由独立的 `dependsOn` 表达。
3. Check 读取新外部工具或环境时，核对 `impact-toolchain.ts`。必要 probe 失败扩大执行；基础环境 Check 只承接既定 Git/Node/Bun/pnpm/SCC 政策，业务测试前置不自动扩成全 Gate 环境要求。
4. 跨 owner import、构建/测试入口或动态读取来源变化时，同步复核 consumer 的静态输入声明，纳入新依赖及其传递闭包。consumer 自身源码变化会使当轮执行，但只有声明完整，才会覆盖新依赖后续单独变化；闭包无法确认时使用较宽输入或保持保守执行。
5. 输入含义变化时更新相应契约版本，防止旧 receipt 被误认。新增/收窄模式应验证受影响与不受影响场景、删除/重命名、ignored 输入、未知/symlink/错误和起止漂移；完整事务由[输入证明 owner](tooling.md#项目输入与成功证明)承接。

## 按类型接入

### 语义命令 Check

按证明义务选择最小充分层级：规则矩阵由纯函数或轻量领域函数验证，真实接线、失败与恢复由必要集成测试验证。
同进程 CLI、真实 Node 和 Git fixture 的边界见[工具链](tooling.md#工具-cli-与-git-fixture-测试边界)。
调整层级时逐项核对覆盖后继并更新 Case/index，成本按同机实际工作量另行报告。

1. 确认精确测试入口。多个文件共同证明同一契约时，可建立只导入这些文件的 `tests/checks/<contract>.ts` 容器；Test Evidence 登记框架可独立选择与报告的最小原生测试入口，而非容器。
2. 在 `semanticGateChecks` 增加声明，例如消费分发制品的 Check：

   ```ts
   {
     checkId: "test:<owner>:public-distribution",
     displayName: "<Owner> public distribution",
     requiredTag: undefined,
     command: bunTest("./tools/<owner>/tests/checks/public-distribution.ts"),
     dependsOn: ["script:check:skill-updaters"]
   }
   ```

3. 为该 ID 核对项目输入 patterns；精确 runner/路径直接来自实际 `command`，Bun 与 Node 均独立执行。
4. 更新 `scripts/vibe-check-catalog-fixture.ts` 的 ID、runner、命令与前置期望；catalog 测试从 wrapper 的磁盘 imports 推导 leaf，并核对领域聚合入口，不另维护逐文件副本。
5. 当前数量变化时同步[工具链 catalog 事实](tooling.md#catalog-与选择)，测试变化按 Test Evidence owner 同步 Case/index。

### 包脚本 Check

1. 在 `package.json#scripts` 建立或确认稳定维护命令，将名称加入 `releaseRequiredPackageScripts`。
2. 适配器构造独立 `commandCheck`；需要生成物时在 `packageScriptDependencies` 声明统一 provider。
3. 补齐输入 patterns 与 Definition/package-adapter/catalog 测试期望。

已有语义 Checks 完整覆盖的 `test:*` 聚合 script 保留人工领域回归入口，不重复登记 Gate leaf。统一生成入口已覆盖的领域生成命令也保留人工入口，由统一 Gate Check 承接。

### 原生 Check

1. 读取对应随包文档，确认完整 patterns、默认排除、finding policy、限制、waiver、工具及 unavailable 边界。
2. 在 `createVibeNativeChecks()` 直接调用 package-root 构造器，以 `gateCheckDeclaration` 加入环境与资源声明；项目质量 finding 显式 blocking。
3. 新增项将稳定 ID 加入 `vibeNativeCheckIds`；调整 options 时保留 ID，并核对完整 Definition 与 release-required 集合。
4. 复用适合的 selection/exclusion；维护范围变化同时复核安全上限与历史材料边界。原生材料每次实际结算，计算事实缓存不替代规则判断。
5. 使用现有 selection、blocking、metrics 或 Definition 测试验证项目配置、范围与阻断义务。

### 自定义与 release DAG Check

1. 只有原生材料或独立命令不能表达领域契约时，才使用 `defineCheck`；领域实现保留直接 owner，`definition.ts` 只组合。
2. 明确 options、context needs、取消、data/Records/handoff 和可信终态；只在需要验证/准备时增加 `prepare`。
3. release prepare → authorization → pack 传递同一 private snapshot。依赖声明、provider 原对象、跨 Run 隔离与 machine 摘要边界须保持；pack 不重读 index。
4. 需要必达清理的调用方资源使用自身 `try/finally`，不把 scheduler terminal effect 当作 `finally`。

## 验证与交付

按实际改动逐层取得证据：

1. 运行新 Check 的精确 Bun/Node 命令；调用外部工具的测试先确认其真实前置。
2. 修改 catalog、构造器配置、输入证明、CLI 或调度接线时运行 `bun run test:check`。
3. 修改测试/Case 时按 [Test Evidence Review](../skills/test-evidence-review/SKILL.md)审查最小入口，再运行 `bun run sync:test-evidence-catalog` 与 `bun run check:test-evidence-catalog`。前者写派生索引，后者采集项目实体并检查引用和覆盖；需交接快照时用 `bun run snapshot:test-evidence -- --output <new-file>`。
4. 运行唯一权威门禁 `bun run check`。
5. 改变 release DAG、全执行路径、版本授权或打包时，运行 `bun run check --tag release --cold`；先明确 pending snapshot 和版本基线，并保留无关 index 内容。

项目测试验证实际传参、输入声明、依赖、领域结果、诊断及 CLI/release 消费。上游原生机制按精确包契约使用，发现具体 Bug 时做针对性复现。

交付确认完整 Definition、输入 patterns、catalog fixture、依赖与资源、Test Evidence 及长期 owner 一致。直接命令、接入测试、base Gate、冷 release 和性能测量分别报告；未执行或未覆盖的平台/CI/发布边界明确保留。
