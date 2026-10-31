# Gate Check 编写与接入

本文指导维护者在本仓库新增、修改或移除 Gate Check：选择最小责任类型，声明独立可归因的结果、完整输入与成功前置，并交付可复核的测试和门禁证据。

先以[项目验证模型](validation-model.md)理解整体证明责任；[项目工具链](gate-execution.md#权威-vibe-门禁)拥有当前 catalog、执行范围与 release 主线，[Gate 项目运行与质量政策](gate-policy.md)承接精确运行政策和输入证明，本文拥有接入流程。Vibe 公共 API 的精确字段与生命周期由当前安装版本的随包文档和类型声明承接。

## 推荐工作流

编辑前检查主仓库状态，读取[编码规范](coding-style.md)，确认目标 catalog、测试与 Case 可以安全延续。随后按顺序执行：

1. 明确证明契约、直接失败 owner、完整实际输入、稳定重跑命令、成功前置与执行范围归属。
2. 按下表选择原生、语义命令、包脚本、自定义或 release DAG Check。
3. 在直接 owner 模块构造 Check，由完整 Definition 组合；身份、依赖、flags 与资源直接进入原生构造器。
4. 维护统一领域声明和 Check 的实际订阅，分别核对领域文件、额外输入及维护代码投影；同步 catalog fixture、受影响项目测试与 Test Evidence Case/index。
5. 按[验证与交付](#验证与交付)运行直接入口、Gate 接入测试和适用门禁，分别报告实际结果与未验证边界。

| 实施前要明确的输入 | 完成标准 |
| --- | --- |
| 证明契约与失败 owner | 结果可独立陈述、验收并直接定位领域责任。 |
| 实际输入 | 覆盖源码、测试/fixtures、磁盘生成物、manifest/lock、配置、共享依赖及必要工具链/环境；未闭合时保守执行。 |
| 重跑入口 | 一条精确 Bun/Node 命令可从项目根独立重现命令 Check。 |
| Check 关系 | 区分成功前置、任意终态观察、数据交接与纯调度压力。 |
| 执行范围 | 普通产品验证进入完整 base；quick 仅承接明确批准的必要 eligible 范围，只有实际交付事务进入 release-only。 |

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

当前 release-only 只有 prepare、version authorization 与 packaging。新增 release-only Check 改变[验证边界决策](decisions/261027-prefer-explicit-local-gate-scopes.md)，须先按 Decision Records 流程判断演进，再复核 release DAG、同快照授权与失败恢复。

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
2. 每次 invocation 保留相同完整 ID 集合。显式能力 scope、自动 changed 输入证明和成功前置通过原生条件与 flags 选择，不动态删除成员。能力分组复用下方统一领域声明及 Check 的实际订阅；新 Check 须声明其真实能力与前置，不能把显式组自动扩散为所有受变更影响的组。新增 quick eligible 项改变基线责任和性能预算，应显式复核并测试；新增公开 tag 需要独立产品契约设计。
3. 普通命令通过现有语义或包脚本适配器构造独立 `commandCheck`，复用共享命令政策、环境前置及资源声明。argv 保持参数数组；cwd、继承环境、transcript、限额与失败重跑按[运行时 owner](gate-policy.md#调度与命令执行)维护。
4. 自定义 Check 使用 `execute` 运行并决定终态；需要验证或准备本项 options 时增加 `prepare`。第一业务参数是 options，需要框架字段时通过 `defineContextCallback` 声明第二参数的 context；不依赖未声明字段。
5. `passed` 表示契约成立，`failed` 表示违反规则，带稳定 reason code 的 `unavailable` 表示无法形成可信结论，`not-applicable` 表示本次不适用。passed/failed 的 data 为 object；Records 只作补充事实。可等待 I/O 与子进程协作响应取消，不遗留未等待工作。
6. machine data、Records 与 message 只含安全、有界摘要；完整命令原文进入 Check transcript，敏感业务材料留在授权的 Check-owned artifact。

### 关系、资源与私有交接

1. `dependsOn` 是成功前置，Vibe 只在直接 provider 全部 passed 后启动 consumer；`observes` 等待并审计任意终态。普通依赖无需 wrapper 重复判断状态。
2. 消费公开业务 data 时使用 provider 的 `parseData` 与 dependency reader。消费同 Run 私有对象时用 typed handoff，并以原 provider 对象读取；原生构造器直接接收声明，避免复制 Check 破坏对象身份。
3. `mutex` 表达逻辑互斥，`resourceClaims` 表达可计数压力。命令通常占一个 `external-process`，全仓扫描通常占一个 `repository-scan`，实际同时消耗才组合。
4. 通过现有声明 helper 保留 root、进程、扫描和 release CPU 容量，以及版本管理测试的 CPU 独占。性能 history 不能放宽硬约束；改变任务或命令方式时核对调度 identity 的时长可比性。
5. 需要可信当前分发产物来证明语义行为的 Check，依赖统一生成 provider `script:check:skill-updaters`，并在消费者声明中维护其实际生成 skill。显式模式按选中消费者收窄 provider，仍校验完整可达源码、manifest/lock 和受管产物；changed/full/release 保留联合检查。领域 `check:*` / `sync:*` 仍供人工定位与同步。typecheck/type-aware lint 不证明生成一致性，也不增加 quick 的生成前置。

### 项目输入证明

自动 changed 模式的语义命令、包脚本和 Markdown 内容 Check 由 `impact-catalog.ts` 完整覆盖；只有已评审完整输入闭包才允许复用 receipt。quick/显式 scope 不进行这项全域采集或证明复用。各模式的适用范围与发布权限按[运行时 owner](gate-policy.md#项目输入与成功证明)维护。

1. 先按[领域范围与检查订阅](#领域范围与检查订阅)维护领域声明，使用 `gateToolInputs` 的完整输入投影，不另写输入路径表。共享运行时、build adapters、fixtures、内部 ignored 文件、生成物、TS/MTS、manifest/lock 和配置均按真实消费纳入。区分目录/文件身份与字节消费；现有模型能表达时按事实建模，不能无损表达时保守保留字节。catalog 仍需覆盖 leaf 存在、可访问与删除，裁剪未读 helper 内容不等于去掉 leaf 输入。
2. 在语义 Check、包脚本或原生 lint 的对应订阅声明中显式订阅所需能力；能力选择与 `dependsOn` 的成功前置分别声明。新读取域不在现有采集范围时，同步 `impact-paths.ts` 的磁盘目录/配置及已知 owner 判定，覆盖 Git ignore 下仍被命令读取的材料。
3. Check 读取新外部工具或环境时，核对 `impact-toolchain.ts`。必要 probe 失败扩大执行；基础环境 Check 只承接既定 Git/Node/Bun/pnpm/SCC 政策，业务测试前置不自动扩成全 Gate 环境要求。
4. 跨 owner import、构建/测试入口或动态读取来源变化时，同步复核 consumer 的订阅及领域额外输入，纳入传递闭包。consumer 自身源码变化会使当轮执行，但只有声明完整，才会覆盖新依赖后续单独变化；闭包无法确认时使用较宽输入或保持保守执行。两领域未归属文件检查是遗漏提示，不能代替依赖审查。
5. 输入含义变化时按范围更新全局 `gateImpactContractVersion` 或逐 Check `version`。新增/收窄模式应验证受影响与不受影响场景、删除/重命名、ignored 输入、未知/symlink/错误、共享 flag 扩散、成功前置带入和起止漂移；带入项必须如实执行并通过后才可发布证明。receipt 复用条件与完整事务由[输入证明 owner](gate-policy.md#项目输入与成功证明)承接。

### 领域范围与检查订阅

能力 ID、领域文件范围与额外检查输入由 [`gateToolScopes`](../scripts/lib/vibe-gate/impact/impact-tools.ts) 唯一声明。每个条目包含：

| 字段或投影 | 责任 |
| --- | --- |
| `kind` | owner 显式声明的质量类别：`code`、`declarations` 或 `material`；决定显式选组自动带入的通用质量检查，不从 patterns 或当前磁盘文件推断。 |
| `files` | 领域自身文件的包含/排除 patterns；维护代码投影只从此字段取得。源码及其分发副本属于同一能力时，在这里共同声明，不能把领域源码仅放入额外依赖。 |
| `additionalInputs` | 该领域检查实际读取、但不属于其文件范围的传递依赖，例如共同运行时、构建适配或 fixture。它扩大检查输入闭包，不扩大该领域的代码扫描范围。 |
| `gateToolInputs` | 从同一声明派生的完整检查输入投影，包含领域文件、额外输入与适用共同输入，供 changed 输入证明使用；不是另一份手工维护的领域路径表。 |

公共运行时与独立测试各自声明能力，Check 继续在语义、包脚本或原生声明中订阅实际能力；flag 由能力 ID 派生。`dependsOn` 仍独立表达必须真实通过的成功前置，额外输入或共同配置不自动形成 Check 订阅或新增显式 scope。

显式选组的类别契约如下；类别不改变领域 Check 的真实输入、订阅或成功前置：

| `kind` | 领域责任与自动带入的质量检查 |
| --- | --- |
| `code` | 维护实现或测试代码；带入 `file-metrics`、`function-metrics` 和完整现有输入上的 `typecheck`、`lint`、`format:check`。 |
| `declarations` | 维护声明或其分发边界；只带入上述三个质量命令，不启动代码指标。当前 `decision-distribution` 与 `investigation-distribution` 属于此类。 |
| `material` | 维护非代码材料；只按领域订阅与成功前置选择，不自动带入通用代码质量检查。 |

类别由长期责任决定，不因文件当前存在、缺失或为空而改变。`code` 的 `files` 必须声明以 `scripts/` 或 `tools/` 起始的正 pattern，缺失时构造失败；声明存在但已选中的指标材料意外为空时仍严格失败，不能把空选集改判为声明/材料域、跳过或通过。领域自身源码必须进入 `files`；例如 `version-control` 同时拥有 `tools/shared/src/version-control/**` 及其测试，而其他真实共享依赖仍保留在 `additionalInputs`，不能通过删除依赖闭包实现扫描收窄。

多个领域各自按原生 patterns 顺序应用包含与排除，再取文件集合的并集；后续正 pattern 可以重新包含本领域先前排除的文件，不能把各组 patterns 直接拼接为一个全局排除列表。文件指标和函数指标只投影所选 `code` 领域：`files` 中以 `scripts/` 或 `tools/` 起始的正 patterns 定义维护代码候选，再与现有 JavaScript/TypeScript 维护代码 selection 相交；路径前缀只负责这一步投影，不负责类别判定。其他 patterns 承接领域材料或生成副本。投影保留原 selection 的文件政策开关及排除保护，精确要求见[原生政策](gate-policy.md#原生材料范围与质量政策)。`additionalInputs`、共享配置以及被前置带入的 Check 输入不自动成为指标领域。重复检测保留 `repository-code` 订阅及完整维护代码范围，不使用该投影。代码质量命令的完整实际输入和不同执行模式的材料范围仍按[执行范围](gate-execution.md#catalog-与选择)及原生政策保持。

调整领域声明时，应验证三种类别、代码选集意外为空、领域内/外材料、共享输入、多个 scope 交叉包含与排除，以及 selected 与完整模式的差异。保留已有公开 scope ID、Check ID、阻断阈值和环境前置；新增领域或改变这些长期边界时，另按对应 owner 复核。

## 按类型接入

### 语义命令 Check

按证明义务选择测试层级；真实分发验证依赖统一生成 provider。声明、输入、catalog 与 Case 的具体步骤见[语义命令接入](gate-check-types.md#语义命令-check)。

### 包脚本 Check

稳定人工命令可以作为独立门禁，但已有语义 leaf 不重复登记。具体声明与订阅见[包脚本接入](gate-check-types.md#包脚本-check)。

### 原生 Check

先核对随包配置与 unavailable 边界，再维护项目 selection、阻断和输入证明；具体步骤见[原生 Check 接入](gate-check-types.md#原生-check)。

### 自定义与 release DAG Check

仅在原生或命令无法表达契约时自定义；release 的 prepare、authorization 和 pack 必须共享同一快照。具体生命周期和清理责任见[自定义与 release DAG 接入](gate-check-types.md#自定义与-release-dag-check)。

## 验证与交付

按实际改动逐层取得证据：

1. 运行新 Check 的精确 Bun/Node 命令；调用外部工具的测试先确认其真实前置。
2. 修改 catalog、构造器配置、输入证明、CLI 或调度接线时运行 `bun run test:check`。
3. 修改测试/Case 时按 [Test Evidence Review](../skills/test-evidence-review/SKILL.md)审查最小入口，再运行 `bun run sync:test-evidence-catalog` 与 `bun run check:test-evidence-catalog`。前者写派生索引，后者采集项目实体并检查引用和覆盖；需交接快照时用 `bun run snapshot:test-evidence -- --output <new-file>`。
4. 先以 `bun run check` 核对 quick 基线及预算；Gate 实现与测试改动追加 `--scope gate-tests`，其他影响按实际能力追加。所选检查通过后按覆盖交付；范围无法确认或明确需要全工作区变更验收时，再使用 `bun run check:changed`，不把它当作每次维护的固定步骤。
5. 改变 release DAG、全执行路径、版本授权或打包时，运行 `bun run check --tag release --cold`；先明确 pending snapshot 和版本基线，并保留无关 index 内容。

项目测试验证实际传参、输入声明、依赖、领域结果、诊断及 CLI/release 消费。上游原生机制按精确包契约使用，发现具体 Bug 时做针对性复现。

交付确认完整 Definition、输入 patterns、catalog fixture、依赖与资源、Test Evidence 及长期 owner 一致。直接命令、接入测试、quick、changed、全量 base、冷 release 和性能测量分别报告；未执行或未覆盖的平台/CI/发布边界明确保留。
