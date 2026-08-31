# Design

本设计以能力处置表定义 Vibe 门禁的最终责任，用 Vibe 原生机制替代旧编排；旧任务清单是调查基线而非兼容规格。

## Context

现有 `scripts/check.ts` 与 `scripts/lib/check-plan.ts` 显式维护 31 个项目任务、quick/full、并发、日志捕获和打包顺序；CI 通过 `bun run check --full` 使用它。当前 `scripts/vibe-check.ts` 则是六项通用检查组成的可选入口，还没有项目原生责任或打包依赖。

环境审计已实际解析 SCC 3.7.0 与 Lizard 1.23.0：SCC 二进制带有 `github.com/boyter/scc/v3@v3.7.0` 构建来源，Lizard 由 uv tool 以 1.23.0 提供，两项指标也完成了真实扫描。最终 owner 分工由 `migration-matrix.md` 固定：`scripts/environment.js` 检查本地全局 prerequisite，`docs/tooling.md` 提供恢复命令，现有 CI package job 固定安装并探测相同版本，门禁 invocation 不负责安装。

这两套入口证明了需要迁移的责任，但不证明旧门禁的每个交互和内部模块都值得保留。Vibe 已拥有 check definition、dependency、scheduler、progress、aggregate 和结构化结果；项目只需从同一能力目录构造 default/full Definition。如果继续实现旧计划模型、定制 renderer 和逐项格式兼容，会形成一套套在 Vibe 外部的第二编排器。

项目真正需要保持的是必要能力不被静默删除、必需检查形成可信结果、发布打包 fail closed、CI 有唯一完成信号。任务数量、ID、输出顺序、并发环境变量和具体指标 warning 数量不是替换成立的必要条件。

**Terminology**

- **Blocking check**：finding、failed、unavailable 或意外 not-applicable 都会阻止当前选择通过。
- **Required advisory check**：finding 永远只以 warning 呈现且 check 仍可 passed，不参与 aggregate、退出或打包资格；无法执行、结果不可信或没有预期输入时结算为 unavailable/not-applicable，并阻止当前选择通过。
- **Required check**：blocking check 与 required advisory check 的并集。Full 中的 `pack:skills` 只能在全部 release-required check 形成可信 passed 结果后执行。
- **Release-required check**：full 选择中必须形成可信 passed 结果的 required check；包括发布所需的 blocking check 和 required advisory check。
- **Default selection**：`bun run check` 的日常反馈集合；成功只证明该集合，不代表发布完整性。
- **Full selection**：`bun run check --full` 的 CI/发布集合；包含全部 release-required check，并在其通过后执行 `pack:skills`。

## Goals / Non-Goals

**Goals**

- 用一个 Vibe 配置和入口承接经确认仍必要的门禁能力，并形成日常与发布选择。
- 对现有每项任务给出可追踪处置；审计允许原生替代、合并和退役，但实际结论是保留 30 项脚本能力并替换 `test:check` 的旧门禁测试实现。
- 让发布 aggregate、退出码和 `pack:skills` 副作用边界可注入、可测试、fail closed。
- 完成能力级对照后一次性切换原 CI job，随后删除旧实现和候选入口。

**Non-Goals**

- 31 项项目能力是逐项审计后的实际保留结果，不是按旧数量设定的验收目标；不保留旧 task object、执行顺序、耗时、逐项 skip 和摘要格式。
- 不保留 `--verbose`、`CHECK_CONCURRENCY` 或旧 helper API；当前消费者只要求 default 与 `--full`。
- 文件/函数指标 finding 永远不提升为 blocking，也不要求本 Change 消除全部现有 warning；本 Change 已完成真实 finding 与 waiver 语义审计，结论是不配置 waiver。
- 不以 Vibe 通用 Schema 替代仍有独立语义的领域 checker，不改写无关检查实现。

## Decisions

### Intended Change

#### 1. 以能力处置表确定最终检查集合

`migration-matrix.md` 已建立唯一迁移表，每个现有 package script 都记录旧任务、所保护能力、内容 owner、失败风险或消费者、处置、最终 check/选择和验证证据。处置值只有：

- `retain`：能力仍必要，现有脚本经最小 adapter 调用。
- `replace`：Vibe 原生 check 或另一个现有检查能提供同等或更强的目标证据。
- `merge`：多个旧任务属于同一 owner 和失败边界，由一个 check 承接，但测试仍覆盖各自关键结果。
- `retire`：能力或消费者已不存在，或完全属于旧编排内部形状；必须给出可复核理由，不能仅因迁移麻烦而删除。

迁移表是本次 Change 的权威处置证据，并在切换前保持当前；它不复制为长期工具文档。审计结果保留 30 项现有脚本能力，并用新门禁测试替换 `test:check` 的旧实现；没有项目能力因使用新编排器而退役。

最终能力分为四组：仓库与领域一致性、代码与行为测试、生成与分发一致性、发布打包安全。31 行用于证明盘点完整；切换验收仍比较每行责任和证据，而不是只比较数量。

#### 2. Vibe 原生优先，项目 adapter 保持最小

重复检测、JSON、已验证兼容的 Task Graph/Test Evidence JSON Schema 和 Markdown 链接优先使用 Vibe 原生 check。只有领域 CLI、type/lint/format、行为测试、生成/hash 等无法由原生 check 可靠覆盖的责任才进入 package-script adapter。

Adapter 使用参数数组启动 Bun，返回稳定的 passed、failed 或 unavailable 结果，并保留足以定位命令、退出类别和受控 stdout/stderr 的诊断。它不维护第二套任务状态机、结果聚合或 renderer。项目 adapter 统一使用 `script:<package-script>` check ID；这是迁移表的稳定追踪约定，不要求 Vibe 原生 check 继承旧任务身份。

`@zxyycom/vibe-check` 使用锁文件中的已验证版本。升级时只复核项目实际依赖的 API 和结果契约，不为未使用功能建立兼容层。

#### 3. 日常与发布选择保留用途，不保留旧映射

`bun run check` 仍是唯一实现入口：默认选择服务日常反馈，`--full` 选择服务 CI 和发布。保留这两个调用方式是因为当前存在两种成本/完成语义，而不是为了维持旧任务清单。

能力处置表已经固定两种选择：default 实例化六项 Vibe 原生检查和 25 项 `D+F` 项目能力；full 在 default 上增加 6 项 `F` 项目能力和终结打包。文件/函数指标作为共同 required advisory check 在两种选择中都执行。Default 不实例化、不运行也不检查 `pack:skills`。无需逐项复刻旧 full-only skip，只要输出能让调用方区分 default 与 full，且 default 成功不被描述成完整发布证明。

Vibe aggregate 选择本次全部 required check，采用 `all`、`unavailable: fail`、`notApplicable: fail` 与 `empty: failed`。Required advisory check 的 finding 以带 warning 的 passed 结算，因此不会阻断；它的 unavailable/not-applicable 会由同一 aggregate fail closed。

#### 4. 指标 finding advisory，但指标执行是必需门禁责任

文件和函数指标使用 Vibe 原生 check，并作为 default/full 共用的 required advisory check。任何 finding 无论当前或未来数值都只形成 warning，永不使 aggregate failed，也不影响打包资格；检查必须真实完成，不能把 SCC/Lizard 缺失、版本不兼容、执行失败或结果无法解析解释为“没有 finding”。

`scripts/environment.js` 精确探测 SCC 3.7.0 与 Lizard 1.23.0，并把它们作为与 CodeGraph 相同的本地全局 prerequisite：检查与 setup 都复用已就绪命令，不在脚本内联网安装；缺失或不匹配时输出工具、期望版本和 `docs/tooling.md` 中的恢复命令。现有 CI package job 在同一 job 内固定 Go/Python runtime，安装并探测这两个版本，再运行 `bun run check --full`。门禁本身只探测和执行 PATH 上的命令。相关 unavailable 使 aggregate 失败并让 full 跳过打包。

指标审计已得到 59 条文件 finding 和 140 条函数 finding，没有 input rejection、blocking finding 或已有 waiver。这些 finding 是完整扫描形成的可信测量：文件 waiver 在 non-blocking policy 下不会改变门禁结果，只会增加对账信息；函数指标 0.0.1 没有 waiver API。因此 `fileMetrics.findingWaivers` 明确保持空数组，本 Change 不建立其他 waiver，全部 finding 继续以 warning 可见。

#### 5. 发布打包只依赖发布必需检查

`pack:skills` 只存在于 full 发布选择，并把本次全部 release-required blocking check 和 release-required advisory check 声明为直接依赖。执行体逐项读取依赖结果；全部 passed 才调用一次打包，任何 failed、unavailable、not-applicable 或无法读取的结果都不调用打包并给出原因。指标 check 带 warning 的 passed 不阻止打包。

Default selection 不实例化、不运行也不检查 `pack:skills`，因此不产生发布包。Full selection 的打包自身失败进入 aggregate 并使进程退出非零。测试使用注入式 process adapter 和隔离输出目录证明调用次数及零写入边界。

#### 6. 使用 Vibe 原生调度和输出

使用 Vibe scheduler、progress 和结构化结果。项目显式使用静态 `scheduler.maxParallel: 4`；现有项目 checks 没有共享写资源，`pack:skills` 由直接依赖排序，因此不声明 mutex，也不保留 `CHECK_CONCURRENCY` 公共契约。CLI 只为非 completed RunResult 输出稳定 kind、reason code 和恢复动作，不增加 check renderer，不实现旧 `--verbose` 和摘要快照。

默认关闭没有消费者的 machine artifact 写入。结构化 RunResult 作为测试接口；CI 依赖进程退出和同一 job 日志，不增加第二个上传或发布完成信号。

#### 7. 能力级对照后切换和退役

候选实现由 `bun run vibe-check` 运行，对照单位是能力与失败结果，不是任务行数。按 `migration-matrix.md` 固定的夹具验证 default/full、项目脚本失败、Vibe blocking finding、指标 advisory finding、SCC/Lizard unavailable、意外 N/A、invocation failure 和打包失败；能力处置表与测试一旦证明新门禁已接管全部原有必要能力、应阻断状态能阻断且打包不越过前置，即可切换，不另设自然日、运行次数或 revision 数量门槛。

对照满足后让 `package.json#check` 指向 Vibe 入口，现有 CI job 继续执行 `bun run check --full`。随后删除旧 `scripts/check.ts`、`scripts/lib/check-plan.ts`、旧专属测试和候选 `vibe-check` package script，并更新配置、文档、决策及 Test Evidence。最终不存在能绕过 Vibe 获得权威门禁通过的旧入口。

### Resulting Impacts

- 门禁代码由 `scripts/vibe-check.ts` 薄 CLI、`scripts/lib/vibe-gate.ts` 的能力目录/Definition/process adapter/full-only 打包 check，以及 `scripts/vibe-check.test.ts` 的契约测试组成；旧计划、调度和 renderer 模块不迁移。
- `scripts/environment.js`、环境测试、项目配置 validator 和现有 CI package job 共同保证唯一 `check` script、Vibe 入口、SCC/Lizard 精确版本和新测试入口，并移除旧入口要求。
- CI 仍在原 job 使用 `bun run check --full`，但 full 的任务集合由能力处置表重新形成；不增加并行 job。
- 工具文档说明 default/full 的用途、aggregate、advisory 与打包边界，不承诺旧任务数量或输出格式。
- `use-vibe-check-as-authoritative-project-gate` Decision Record 归并并归档迁移表点名的五条旧编排决策，明确保留的 default/full 与失败后继续语义，以及被 Vibe 调度、progress、aggregate 和 full-only 打包取代的语义。
- 测试与 Test Evidence 以最终公开责任为单位迁移；旧内部 helper、格式和任务计数 case 可以在处置表说明后删除。

## Risks / Trade-offs

- **合并或退役可能漏掉隐含责任。** 迁移表要求 owner、消费者、失败风险和证据，任何旧任务没有处置结论都阻止切换。
- **默认选择不再代表发布完整性。** 输出和文档明确 default/full 边界，只有 full 成功和打包成功形成发布证明。
- **使用原生输出会改变操作者体验。** 验收聚焦可定位原因和恢复动作；仅在真实诊断缺口处增加薄适配，不为文本一致性重建 renderer。
- **Vibe Check 仍为 0.0.1。** 锁定版本并对实际使用的 Definition 构造、aggregate、dependency 和 RunResult 建立契约测试。
- **指标会增加运行时间、warning 和外部依赖。** 两项指标共享 default/full，finding 永远非阻断；本地复用当前已安装工具，环境检查精确诊断版本，CI 在原 job 固定安装，避免重复安装和把 warning 与工具故障混为一类。
- **一次性 CI 切换可能出现环境差异。** 切换前运行干净安装和 CI 等价 full；回退边界是切换提交，不长期维护双门禁。

## Open Questions

无。Plan 固定采用能力级处置而非逐项兼容；default 不检查打包，full 承接发布与打包。文件/函数指标在两种选择中都必须真实执行，finding 永远非阻断且不配置 waiver，检查 unavailable/not-applicable fail closed。SCC/Lizard owner、Vibe 0.0.1 API、测试处置和失败夹具均已由 `migration-matrix.md` 固定。全部原有必要能力被证明接管后即可切换，不另设时间或次数门槛。

## Plan Use Contract

- Change 只有在全部旧任务已有处置结论、六类 Vibe 检查和其他原有必要能力由新门禁完全接管、当前 SCC/Lizard 来源及目标环境保证已实现、full 打包 fail closed、旧实现与候选入口退出后才可完成或归档；不要求额外 soak 时长或运行次数。
- “不要求一致”不授权静默删除责任；任何 retire 或 merge 都必须在迁移表中给出 owner、理由和替代证据。
- 对照期允许两套本地命令并存，但不增加并行 CI job；切换后只有 Vibe `bun run check` 能形成权威完成结果。
