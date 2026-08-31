# Design

本设计以能力处置表定义 Vibe 门禁的最终责任，用 Vibe 原生机制替代旧编排；旧任务清单是调查基线而非兼容规格。

## Context

现有 `scripts/check.ts` 与 `scripts/lib/check-plan.ts` 显式维护 31 个项目任务、quick/full、并发、日志捕获和打包顺序；CI 通过 `bun run check --full` 使用它。当前 `scripts/vibe-check.ts` 则是六项通用检查组成的可选入口，还没有项目原生责任或打包依赖。

这两套入口证明了需要迁移的责任，但不证明旧门禁的每个交互和内部模块都值得保留。Vibe 已拥有 check definition、selection、dependency、scheduler、progress、aggregate 和结构化结果；如果继续实现旧计划模型、定制 renderer 和逐项格式兼容，会形成一套套在 Vibe 外部的第二编排器。

项目真正需要保持的是必要能力不被静默删除、必需检查形成可信结果、发布打包 fail closed、CI 有唯一完成信号。任务数量、ID、输出顺序、并发环境变量和具体指标 warning 数量不是替换成立的必要条件。

**Terminology**

- **Blocking check**：finding、failed、unavailable 或意外 not-applicable 都会阻止当前选择通过。
- **Required advisory check**：finding 以 warning 呈现且 check 仍可 passed；无法执行、结果不可信或没有预期输入时结算为 unavailable/not-applicable，并阻止当前选择通过。
- **Required check**：blocking check 与 required advisory check 的并集。Full 中的 `pack:skills` 只能在全部 release-required check 形成可信 passed 结果后执行。
- **Release-required check**：full 选择中必须形成可信 passed 结果的 required check；包括发布所需的 blocking check 和 required advisory check。
- **Default selection**：`bun run check` 的日常反馈集合；成功只证明该集合，不代表发布完整性。
- **Full selection**：`bun run check --full` 的 CI/发布集合；包含全部 release-required check，并在其通过后执行 `pack:skills`。

## Goals / Non-Goals

**Goals**

- 用一个 Vibe 配置和入口承接经确认仍必要的门禁能力，并形成日常与发布选择。
- 对现有每项任务给出可追踪处置，允许可靠的原生替代、合并和退役，而非默认一对一包装。
- 让发布 aggregate、退出码和 `pack:skills` 副作用边界可注入、可测试、fail closed。
- 完成能力级对照后一次性切换原 CI job，随后删除旧实现和临时入口。

**Non-Goals**

- 不保证最终仍有 31 个项目 check，或保留旧 check ID、执行顺序、耗时、逐项 skip 和摘要格式。
- 不把 `--verbose`、`CHECK_CONCURRENCY` 或旧 helper API 当作兼容要求；只有确认存在当前消费者时才保留相应能力。
- 不在本 Change 中把文件/函数指标 finding 提升为 blocking，也不顺带消除全部现有指标 warning；SCC/Lizard 的可复现安装仍属于替换范围。
- 不以 Vibe 通用 Schema 替代仍有独立语义的领域 checker，不改写无关检查实现。

## Decisions

### Intended Change

#### 1. 以能力处置表确定最终检查集合

实施前建立唯一的迁移表，每个现有 package script 至少记录：旧任务、所保护能力、内容 owner、失败风险或消费者、处置、最终 check/选择和验证证据。处置值只有：

- `retain`：能力仍必要，现有脚本经最小 adapter 调用。
- `replace`：Vibe 原生 check 或另一个现有检查能提供同等或更强的目标证据。
- `merge`：多个旧任务属于同一 owner 和失败边界，由一个 check 承接，但测试仍覆盖各自关键结果。
- `retire`：能力或消费者已不存在，或完全属于旧编排内部形状；必须给出可复核理由，不能仅因迁移麻烦而删除。

处置结果写入 Change 目录的 `migration-matrix.md`，由任务 0.1 建立并在切换前保持当前；它是本次迁移证据，不复制为长期工具文档。

最终能力至少分为四组：仓库与领域一致性、代码与行为测试、生成与分发一致性、发布打包安全。现有 31 个任务用于保证盘点完整，不作为最终 check 数量或 ID 的验收条件。

#### 2. Vibe 原生优先，项目 adapter 保持最小

重复检测、JSON、已验证兼容的 Task Graph/Test Evidence JSON Schema 和 Markdown 链接优先使用 Vibe 原生 check。只有领域 CLI、type/lint/format、行为测试、生成/hash 等无法由原生 check 可靠覆盖的责任才进入 package-script adapter。

Adapter 使用参数数组启动 Bun，返回稳定的 passed、failed 或 unavailable 结果，并保留足以定位命令、退出类别和受控 stdout/stderr 的诊断。它不维护第二套任务状态机、结果聚合或 renderer。Check ID 按最终能力命名；不要求继承 package script 名称。

`@zxyycom/vibe-check` 使用锁文件中的已验证版本。升级时只复核项目实际依赖的 API 和结果契约，不为未使用功能建立兼容层。

#### 3. 日常与发布选择保留用途，不保留旧映射

`bun run check` 仍是唯一实现入口：默认选择服务日常反馈，`--full` 选择服务 CI 和发布。保留这两个调用方式是因为当前存在两种成本/完成语义，而不是为了维持旧任务清单。

能力处置表决定两种选择的最终集合：full 包含全部 release-required check；default 只包含适合日常执行的其他 required check，但文件/函数指标作为共同 required advisory check 在两种选择中都执行。无需逐项复刻旧 full-only skip，只要输出能让调用方区分 default 与 full，且 default 成功不被描述成完整发布证明。

Vibe aggregate 选择本次全部 required check，采用 `all`、`unavailable: fail`、`notApplicable: fail` 与 `empty: failed`。Required advisory check 的 finding 以带 warning 的 passed 结算，因此不会阻断；它的 unavailable/not-applicable 会由同一 aggregate fail closed。

#### 4. 指标 finding advisory，但指标执行是必需门禁责任

文件和函数指标使用 Vibe 原生 check，并作为 default/full 共用的 required advisory check。当前配置产生的 finding 保持 warning，不因基线数量使 aggregate failed；检查必须真实完成，不能把 SCC/Lizard 缺失、版本不兼容、执行失败或结果无法解析解释为“没有 finding”。

仓库标准环境入口幂等安装并探测 SCC 3.7.0-compatible 与 Lizard 1.23-compatible 工具，现有 CI job 复用同一入口或等价的固定版本步骤。缺失或不兼容必须输出工具、期望版本和恢复命令；相关 unavailable 使 aggregate 失败并让 full 跳过打包。将指标 finding 升级为 blocking 需要后续独立决策固定阈值、waiver 和 owner。

#### 5. 发布打包只依赖发布必需检查

`pack:skills` 只存在于 full 发布选择，并把本次全部 release-required blocking check 和 release-required advisory check 声明为直接依赖。执行体逐项读取依赖结果；全部 passed 才调用一次打包，任何 failed、unavailable、not-applicable 或无法读取的结果都不调用打包并给出原因。指标 check 带 warning 的 passed 不阻止打包。

默认选择不产生发布包，避免日常检查留下未经完整发布选择证明的制品。打包自身失败进入 aggregate 并使进程退出非零。测试使用注入式 process adapter 和隔离输出目录证明调用次数及零写入边界。

#### 6. 使用 Vibe 原生调度和输出

优先使用 Vibe scheduler、progress 和结构化结果。项目可以在配置中设置经资源测试确认的保守 `maxParallel` 或 mutex，但不保留 `CHECK_CONCURRENCY` 公共契约；只有原生诊断缺少 check、状态、原因或恢复动作时才增加薄 formatter，不实现旧 `--verbose` 和摘要快照。

默认关闭没有消费者的 machine artifact 写入。结构化 RunResult 作为测试接口；CI 依赖进程退出和同一 job 日志，不增加第二个上传或发布完成信号。

#### 7. 能力级对照后切换和退役

候选实现先由临时 `bun run vibe-check` 运行，但对照单位是能力与失败结果，不是任务行数。至少验证默认/发布选择、领域校验失败、代码检查失败、Vibe blocking finding、指标 advisory finding、SCC/Lizard unavailable 和打包失败；确认必要责任有证据、应阻断状态能阻断且打包不越过前置。

对照满足后让 `package.json#check` 指向 Vibe 入口，现有 CI job 继续执行 `bun run check --full`。随后删除旧 `scripts/check.ts`、`scripts/lib/check-plan.ts`、旧专属测试和临时 package script，并更新配置、文档、决策及 Test Evidence。最终不存在能绕过 Vibe 获得权威门禁通过的旧入口。

### Resulting Impacts

- 门禁代码只保留 Vibe 配置、能力选择、最小 process adapter 和 full-only 打包 check；旧计划、调度和 renderer 模块不迁移。
- 标准环境、环境测试和项目配置 validator 要求唯一 `check` script、Vibe 入口、SCC/Lizard 兼容版本和新测试入口，并移除旧/临时文件要求。
- CI 仍在原 job 使用 `bun run check --full`，但 full 的任务集合由能力处置表重新形成；不增加并行 job。
- 工具文档说明 default/full 的用途、aggregate、advisory 与打包边界，不承诺旧任务数量或输出格式。
- 新 Decision Record 记录能力级替换、Vibe 原生优先和 full-only 打包，并说明既有 quick/full、简洁输出和打包决策哪些语义继续有效。
- 测试与 Test Evidence 以最终公开责任为单位迁移；旧内部 helper、格式和任务计数 case 可以在处置表说明后删除。

## Risks / Trade-offs

- **合并或退役可能漏掉隐含责任。** 迁移表要求 owner、消费者、失败风险和证据，任何旧任务没有处置结论都阻止切换。
- **默认选择不再代表发布完整性。** 输出和文档明确 default/full 边界，只有 full 成功和打包成功形成发布证明。
- **使用原生输出会改变操作者体验。** 验收聚焦可定位原因和恢复动作；仅在真实诊断缺口处增加薄适配，不为文本一致性重建 renderer。
- **Vibe Check 仍为 0.0.1。** 锁定版本并对实际使用的 aggregate、dependency、selection 和 RunResult 建立契约测试。
- **指标会增加运行时间、warning 和外部依赖。** 两项指标共享 default/full，finding 维持 advisory；标准环境固定兼容工具，只有检查无法形成可信结果时才阻断，避免 warning 基线和工具故障混为一类。
- **一次性 CI 切换可能出现环境差异。** 切换前运行干净安装和 CI 等价 full；回退边界是切换提交，不长期维护双门禁。

## Open Questions

无。Plan 固定采用能力级处置而非逐项兼容；保留 default/full 用途和 full 发布边界。文件/函数指标在两种选择中都必须真实执行，finding advisory，检查 unavailable/not-applicable fail closed。

## Plan Use Contract

- Change 只有在全部旧任务已有处置结论、六类 Vibe 检查和其他必要能力由新门禁证明、SCC/Lizard 可复现提供、full 打包 fail closed、旧实现与临时入口退出后才可完成或归档。
- “不要求一致”不授权静默删除责任；任何 retire 或 merge 都必须在迁移表中给出 owner、理由和替代证据。
- 对照期允许两套本地命令并存，但不增加并行 CI job；切换后只有 Vibe `bun run check` 能形成权威完成结果。
