# Design

本 design 保存统一 JSON 测试阻断资格的一轮形成时探索结果，供未来重启时恢复当时事实、取舍和待验证边界。它不是当前协议或实施规格。

## 阅读与权威边界

| 内容 | 后续使用方式 |
| --- | --- |
| 当前长期方向 | 分别以[Runner 生产边界结果协议](../../../../../docs/decisions/test-evidence-review/standardize-runner-results-at-producer-boundaries.md)和[正式结果证据资格](../../../../../docs/decisions/test-evidence-review/qualify-formal-results-by-evidence-integrity.md)为 owner；旧的[统一测试结果延期决策](../../../../../docs/decisions/test-evidence-review/defer-standard-test-result-blocking.md)已归档，只是两条当前演进链的共同历史前序 |
| “已核实的仓库边界” | 只表示本材料形成时的调查快照；重新规划前必须用届时仓库事实复核 |
| 候选 Schema、状态、runner 映射、执行顺序和加固方式 | 只作为比较输入，不是冻结契约或验收标准 |
| 实施与授权 | 本资源不提供当前 plan 或实施授权；是否重新选择推进应以当前决策 owner、现实需求和届时授权为准，[`tasks.md`](tasks.md) 只保留形成时的重启清单 |

## Context

### 形成时核实的仓库边界

- 本轮探索形成时，13 个稳定 `test:*` scripts 覆盖 416 个已登记最小原生测试入口 Case。实施前必须重新核对该基线，不能把调查数量当成永久不变量。
- 形成时的测试使用 `node:test` API；大部分由 Bun 执行，`test:task-graph-cli` 还包含 Node native `--test`。
- 形成时，[`scripts/check.ts`](../../../../../scripts/check.ts) 只按聚合进程退出码判断前置检查通过或失败，[`scripts/lib/check-plan.ts`](../../../../../scripts/lib/check-plan.ts) 让测试与 catalog 检查并发运行；当时的门禁没有 Test、Case、协议完整性或 runner 故障模型。
- 形成时，[`test-evidence-review`](../../../../../skills/test-evidence-review/SKILL.md) 和 catalog 只维护、校验显式 Case；它们不扫描测试源码、不运行 `Entry:`、不发现真实测试，也不消费测试结果。
- 调查时，提交 `5b1284a0971309e7c0f8617274c1b6ac217b9bc7` 已形成内部 Test–Case ledger 机制，但当时尚未激活 public skill 或真实账本。该提交只证明历史探索结果；未来必须重新核对 Test ID、locator、测试发现和账本切换的当前 owner 与状态。
- 在材料形成时，让 test-evidence 能力拥有 JSON consumer 和正式阻断资格属于后续明确的 skill/tool 行为扩展，不是当时已有能力；当前实现状态仍须从行为 owner 核对。

### 术语

| 术语 | 本轮探索中的唯一含义 |
| --- | --- |
| Test 实体 | Runner 能独立报告最终结果的最小原生测试入口；由稳定 Test ID 标识，不保存单次执行状态 |
| Test 运行结果 | 一次 invocation 中对某个 Test ID 的临时结果；只存在于协议消费链路，不回写测试实体或 ledger |
| Case | 描述测试语义、契约和证明信号的账本记录；由 Case ID 标识，不保存单次执行状态 |
| JSON producer | Runner-specific 生产边缘；读取原生结果、取得 Test ID、映射统一状态并输出协议 JSON |
| Test-evidence consumer | Runner-agnostic 消费核心；校验 JSON、核对 Test 集合、查询 ledger、分类并渲染诊断 |
| 资格快照 | 同一次门禁使用的测试实体索引、ledger 关系及其 revision 证据 |
| 预期 Test 集合 | 本次 invocation 按资格快照和显式过滤派生、应当产生结果的 Test ID 集合 |
| 正式门禁 | 能影响稳定 `test:*`、`bun run check` 或项目 CI 结论的测试执行路径 |
| Raw runner | 未进入统一 producer/consumer 链路的临时测试命令；只能提供本地反馈 |

Test 实体与 Case 是多对多关系。Runner 的原生结果始终引用 Test 实体；Case ID 只用于解释该 Test 证明的语义，不把 Case 转成 runner 节点或聚合状态。行为通过、行为失败和完整性错误都是一次 invocation 的临时分类，不成为 Test 实体或 Case 的持久状态。

## 探索目标与边界

未来方案需要满足：

- 只有身份完整、关系闭合且来源新鲜的 Test 结果才能形成行为 pass/fail。
- 用一个版本化 JSON 公约数隔离 Bun、Node 和未来 runner 差异，使 consumer 无需场景知识。
- 对所有正式测试阻断来源默认拒绝；缺少合格 JSON 或 Test ID 时硬阻断为 `test-integrity`。
- 从同一资格快照双向核对预期/实际 Test 集合并派生 Case ID，避免第二关系真源。
- 让直接 script、quick/full check 与 CI 使用同一分类和诊断。
- 保存局部删除能够机械发现、完整自洽删除仍需代码审查的能力边界。

本轮探索不处理：

- 形成时方案不实现协议、producer、consumer、check 或 CI 变更。
- 不让 consumer 解析 TAP、JUnit、console 文本或 runner 原生事件。
- 不把 Case ID 写入测试源码、producer JSON、测试实体索引或独立 manifest。
- 不计算 Case 级 pass/fail、覆盖率、权重、顺序、AND/OR 或 quorum。
- 不监控任意外部进程，也不从脚本名称或自然语言日志推断隐藏测试。
- 不判断完整 Test/Case 删除的产品正当性。

## 候选设计

以下内容说明形成时的统一 JSON 方案如何形成闭环，以及未来需要用真实证据验证什么。本节中的字段、名称、顺序和 owner 分工均是历史候选；当前长期方向只由“阅读与权威边界”列出的两个决策 owner 确定。

### 1. 阻断资格先于行为结果

正式门禁先判断结果是否有资格，再解释 pass/fail。候选主分类如下；最终名称和机器枚举尚未确定：

| 主分类 | 成立条件 | 行为结论 | 整体门禁 |
| --- | --- | --- | --- |
| 已资格化 pass | JSON、身份、集合、revision 和 Test → Case 关系全部有效，原生状态为通过 | 形成可追溯通过证据 | 不阻断 |
| 已资格化 fail | 与上项相同，原生状态为失败 | 形成行为回归；报告 Test ID 与全部 Case ID | 阻断 |
| `test-integrity` | JSON/版本/Schema 非法，Test ID 缺失/未知/重复，集合不闭合，来源陈旧或 Test 无 Case | 不形成行为 pass/fail | 硬阻断 |
| Runner/基础设施失败 | Producer 或底层 runner 无法启动、被外部终止或超时，协议生产无法正常完成 | 无法形成可靠行为结论 | 阻断 |
| 工程检查失败 | lint、类型、schema、生成漂移等非行为检查失败 | 不解释为测试结果 | 按现行工程门禁阻断 |

分类优先级遵循以下规则：

1. Producer 无法启动、被外部终止或超时，先归 runner/基础设施失败。
2. Producer 返回控制后，stdout 缺失、混杂、版本/Schema 非法或没有逐项 Test ID，归 `test-integrity`；不能用裸退出码代替协议。
3. JSON 合法但实际/预期集合、revision 或 ledger 关系不闭合，归 `test-integrity`。
4. 只有完整性全部通过后，原生失败才是行为回归。
5. 同一次 invocation 同时观察到行为失败和完整性错误时，主分类是 `test-integrity`；可以附带已观察失败，但不能声称得到完整行为结论。

### 2. Test 实体 ID 与 Case ID 分属不同 owner

以下规则描述相关账本与发现工作的目标模型，不是当前已激活的 public skill 行为：

- 测试实现或 runner metadata 只声明 Test ID；具体声明、发现和 locator 方式由未来重启时确认的 Test 身份 owner 决定。
- 测试实体索引保存 Test ID 与 locator，不保存 Case ID。
- Case Markdown 的 `Tests:` 是唯一 Case → Test 可写关系面；ledger 投影负责闭合查询。
- Producer JSON 完整列出本次实际产生的原生 Test 运行结果；每项只携带 Test ID，不携带 Case ID。
- Consumer 先按 Test ID 判断问题 Test 实体，再从同一资格快照派生全部 Case ID；派生结果不回写 producer、测试实体、Case 或执行计划。
- 若某项原生结果缺少 Test ID，consumer 只能用 producer 提供的 locator、显示名和诊断报告“未绑定测试结果”，不能为它推断或伪造 Case ID。

这条边界允许一个 Test 支持多个 Case、一个 Case 由多个 Test 支持，同时避免源码 marker、JSON 或 manifest 与 Case Markdown 双写关系。

### 3. 一个版本化 JSON 是唯一测试结果协议

统一协议只应承接所有 runner 共同具备、且 consumer 必须依赖的语义。具体 JSON Schema 要在 Test ID 契约与真实 runner 事件核对后决定；候选语义组成如下：

| 语义组成 | 必需约束 | 不承担的内容 |
| --- | --- | --- |
| 协议身份与版本 | 显式标识协议及版本；consumer 只接受声明支持的版本 | 不做猜测性兼容或 runner fallback |
| Invocation identity | Producer 回显本次调用身份，防止旧报告、并发串线和错误输入 | 不作为长期 Test 或 Case 身份 |
| Producer metadata | 标识 producer 名称/版本，服务诊断和兼容审计 | 不改变 Test 资格 |
| Test results | 完整列出本次实际产生的原生结果；每项恰好包含一个 Test ID 和一个协议结果 | 显示名、路径和退出码不能替代 Test ID；不能只报告失败项 |
| Producer errors | 表达 producer 已启动后能够结构化报告的 runner/生产故障 | 不把协议非法包装成行为失败 |
| Diagnostics | 可选地承载 locator、显示名、时长、stack 或原始上下文 | 不参与身份或关系判定 |

候选传输边界如下：

1. 正式协议模式的 producer stdout 是 UTF-8 编码的一个完整 JSON 文档；允许末尾换行，不允许 banner、console 日志、多个 JSON 值或 NDJSON。
2. Runner 日志进入 stderr 或 JSON diagnostics。Consumer 不解析 stderr 来恢复 Test 身份或状态。
3. Consumer 无论 producer 退出码为何都先尝试解析 stdout。退出码只作为 transport 诊断，不能决定行为回归或协议完整性。
4. JSON 不包含 Case ID。汇总计数若进入最终 Schema，只能是 consumer 可重新计算并严格核对的冗余信息。
5. 最终运行结果集合必须用 Bun 与 Node native test 的真实事件收敛；无法形成共同语义的 runner 细节留在 diagnostics 或 producer 内部，不扩展为 Test 实体或 Case 状态。

### 4. 资格执行使用同一快照闭环

候选资格闭环按以下顺序执行：

1. 项目发现 owner 证明测试实体索引相对真实测试全集完整且新鲜。
2. Ledger 严格检查证明 Test、Case 和关系闭合，并返回实体、Case 与项目 revision 证据。
3. 调用方从同一快照和显式过滤条件派生预期 Test ID 集合、locator 与 invocation identity。
4. Runner-specific producer 执行预期集合，并返回 stdout JSON、stderr 和 transport 事实。
5. Test-evidence consumer 严格校验协议、版本、Schema、invocation identity、逐项 Test ID 和预期/实际集合；producer 只报告问题项时，实际集合不完整并归 `test-integrity`。
6. 分类前重新确认资格快照 revision 未变化；变化时整次结果归来源漂移。
7. Consumer 从内存中的同一 ledger 快照派生 Case ID，应用主分类，并先按问题 Test 实体输出 reason、定位和原生诊断，再附加能够解析出的关联 Case ID。
8. 项目门禁只消费 consumer 的最终分类，不从 producer 日志或退出码重新解释测试。

有意过滤运行以过滤后的 Test ID 集合为预期集合，因此未选择的 Test 不是假缺失。Runner 的非标准结果和执行故障如何映射到协议结果或 producer error，需要由真实 producer 证据收敛；该映射只影响单次运行结果，不给 Test 实体或 Case 增加状态。

### 5. 正式阻断面是封闭集合

- 项目拥有的稳定 `test:*` 自动属于测试步骤，必须编排 JSON producer 与共同 consumer。
- Check plan 必须显式区分测试步骤和非测试工程检查；测试步骤没有合格 JSON 时不能回退为普通进程退出码。
- 项目 CI 只调用 `bun run check --full`，并通过项目校验拒绝额外裸测试旁路；workflow 不解析或转换测试协议。
- Raw runner 仍可供开发者本地调试，但其结果不进入正式门禁。
- 形成时方案只约束项目拥有的正式阻断面。把测试隐藏在伪装工程脚本中仍需要代码审查；若未来需要拦截任意外部进程，应另立产品策略。

### 6. Owner 按领域、生产边缘和编排分层

| 候选 Owner | 未来责任 | 明确不承担 |
| --- | --- | --- |
| Test 身份与发现 owner | Test ID、locator、真实测试发现、新鲜度和 `sourceRevision` | JSON 协议消费与 Case 关系 |
| Test-evidence skill 及可分发工具 | JSON Schema/版本、严格 consumer、Test → Case 查询、资格分类、固定 reason code 和诊断渲染 | Runner 原生事件读取 |
| Runner 侧 JSON producer | 原生事件读取、Test ID 取值、统一状态映射、JSON 输出 | Case 查询、Case ID 和项目门禁策略 |
| 项目 check 编排 | 资格前置、步骤分类、invocation/预期集合传递、producer/consumer 编排、最终退出 | Runner 格式解析和协议 Schema 副本 |
| CI | 调用统一项目门禁并展示结果 | 测试身份、关系、协议转换和分类逻辑 |

### 7. 选择统一 JSON，而不是扩大 consumer

| 候选 | 结论 | 原因 |
| --- | --- | --- |
| Test-evidence 核心逐 runner 适配 | 不采用 | 每增加 runner 都修改核心，状态和错误分支持续膨胀，consumer 无法保持场景无关 |
| Runner 边缘 producer → 统一 JSON → 单一 consumer | 采用 | Producer 吸收局部差异，consumer 只依赖共同身份、状态、invocation 和故障语义 |
| 从 TAP/JUnit/console 或退出码猜测结果 | 不采用 | 文本不稳定、名称可重复，无法证明 Test ID 或完整结果集合 |
| 可写 manifest 或 JSON 直接保存 Case ID | 不采用 | 与 Case Markdown 形成第二关系真源并产生双写漂移 |

每种不能原生输出协议的 runner 仍需要一个 reporter、converter 或 wrapper，但该接入只发生在生产边缘，不扩展 test-evidence consumer。

### 8. 删除与迁移边界

在测试发现新鲜且 ledger 闭合的前提下：

- 只删除 Case 关系会留下无 Case Test，由 ledger 闭合检查拒绝。
- 只删除实体登记而测试仍存在，由测试发现新鲜度检查拒绝。
- 只删除测试实现而保留实体或关系，由实体新鲜度或未知端点检查拒绝。
- 同时删除测试实现、实体和全部关系可以形成新的闭合集合。该变化是否合理属于代码审查；形成时方案不增加 tombstone、受保护 Case 列表或第二 manifest。

未来若重启，可以按以下顺序重新评估迁移：

1. 重新确认 Test ID、locator、发现和 revision 契约已经由当前 owner 提供，并据此重审本 design。
2. 固定 JSON Schema、版本兼容、状态枚举和 producer error；用 runner-agnostic consumer fixtures 验证共同语义。
3. 为一个小型、结果稳定的容器建立边缘 producer，先以只读对照证明原生结果与 JSON Test ID 一一对应。
4. 在试点启用硬资格，验证合法结果、协议非法、身份非法、集合漂移和 producer 故障。
5. 验证直接 script、quick/full check 和 CI 一致后逐容器迁移；新增 runner 只能增加 producer，不能修改 consumer 的领域分支。
6. 全部正式入口迁移后移除裸退出码路径，同步 test-evidence、工具链和 CI owner。

迁移期间，“尚未迁移”与“非法”必须由显式试点范围区分；不得为迁移状态在 Test 或 Case 上增加永久字段。

## Risks / Trade-offs

| 风险或取舍 | 控制方式 |
| --- | --- |
| Test ID 无法从 runner 结果稳定恢复 | 在硬门禁前做 producer 一一绑定试验；无法证明时停止迁移该容器 |
| Producer 把日志混入 stdout | 协议模式独占 stdout；混杂输出固定为 `test-integrity` |
| 统一 JSON 吸收 runner 专属事件 | Schema 只保留 consumer 共同依赖的语义；局部细节留在 diagnostics 或 producer |
| 旧 producer 与新版本 Schema 静默错读 | 显式协议版本、严格拒绝未知版本、兼容/拒绝 fixture；不做猜测性 fallback |
| 运行期间实体或关系变化 | Invocation 前后复核 revision；变化时要求重跑 |
| 测试编写中间态暂时不闭合 | Raw runner 保留本地反馈；只有正式门禁要求完整资格 |
| 资格前置增加运行成本 | 同一次 check 复用资格快照；单个 script 只处理自身预期集合 |
| 完整自洽删除可以移除测试约束 | 保留可审阅 diff；若需要机械删除授权，另建明确策略 owner |
| Test ID 或发现模型继续变化 | 本资源保持形成时方案输入；身份模型稳定只满足重启条件之一，仍需重新审查 Schema、owner 和迁移计划 |

## Open Questions

长期方向已经确认：非法测试应硬阻断但不计为行为回归；正式结果采用统一版本化 JSON；test-evidence consumer 不逐 runner 适配。具体协议和接入语义仍要在未来重启时按真实证据重新收敛。

未来若明确重启，至少需要重新核对两个技术依赖：

1. 届时的 Test 身份 owner 提供什么 Test ID、locator、发现新鲜度和 `sourceRevision` 契约，producer 如何取得并回显该 Test ID？
2. Bun 与 Node native test 的真实事件如何共同映射为闭合运行结果和 producer error，同时保持 Test 实体与 Case 不承载执行状态？

这两个问题需要真实 runner 和身份模型证据。它们完成并不自动启动工作；只有出现实际需求、优先级和明确实施授权后，维护者才能依据当前 owner 重新判断是否建立新的 `plan`。
