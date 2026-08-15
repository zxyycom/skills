# Design

本设计用一个领域入口和一个薄 CLI adapter 兑现 task-graph 的直接程序化调用，不创建 SDK 实现层。

## Context

### 当前事实

- [`tools/task-graph/src/service.ts`](../../tools/task-graph/src/service.ts) 已承接索引读写、查询、apply、lease 与终态操作；它调用 [`engine.ts`](../../tools/task-graph/src/engine.ts)、[`graph.ts`](../../tools/task-graph/src/graph.ts)、[`staging.ts`](../../tools/task-graph/src/staging.ts) 和 store，成功时返回结构化 `ServiceResult`。
- [`tools/task-graph/src/cli.ts`](../../tools/task-graph/src/cli.ts) 当前完成 argv 解析、runtime gate、Service dispatch、`TaskGraphError` envelope、JSON serializer 和两个专用 renderer；CLI 领域命令没有通过子进程或 JSON round trip 调用 Service。
- [`tools/task-graph/src/index.ts`](../../tools/task-graph/src/index.ts) 当前导出 Service、领域纯操作、projection、错误、类型与 parse/serialize 能力；`cli.ts` 在文件末尾 `export * from "./index.ts"`，所以源码和生成声明仍以 CLI 入口拥有这组导出。
- [`scripts/build/task-graph.ts`](../../scripts/build/task-graph.ts) 以 `cli.ts` 同时作为 bundle 与 TypeScript 声明根，只保留编译器发出的可达声明闭包；分发根模块运行时导出和声明已经由测试逐项核对。
- 活动决策 [`derive-sdk-declarations-from-runtime-source`](../../docs/decisions/derive-sdk-declarations-from-runtime-source.md) 已拒绝独立 SDK 实现和手写声明，但仍把 `cli.ts` 的公开导出称为共同接口事实源；本 Change 的单向责任会改变这项长期判断，不能直接编辑既有已建立记录。
- [`docs/tooling.md`](../../docs/tooling.md) 当前把生成 `.d.mts` 与“稳定程序化接口”绑定；本任务只需要可类型检查的直接调用，不由声明文件自动产生独立稳定性或版本承诺。

### 术语与责任

- **领域实现**：`TaskGraphService`、engine、graph、projection、Schema、staging 和 store 等当前行为 owner。领域规则只在这里实现。
- **领域直接入口**：`tools/task-graph/src/index.ts`。它组合并导出领域实现已有的 Service、operation、错误和类型，但不另写行为。
- **CLI 适配入口**：`tools/task-graph/src/cli.ts`。它解析 argv 与输入载体，调用领域能力，并映射 JSON/text 输出、错误 envelope 和退出码。
- **分发组合入口**：新的 `tools/task-graph/src/entry.ts`。它组合领域直接入口与 CLI runner，并独占主模块启动，不实现领域规则。
- **SDK**：consumer 直接 import 分发根模块中的领域导出这一调用方式。它不是源码层、领域模型、便利协议、独立版本或稳定性等级。

CLI 与领域的责任按输入含义区分。重复 option、缺失 operand、整数 token、stdin/`--file` 选择、全局 `--json` 和 renderer route 属于 CLI 表示；Task content、control/reason 组合、lease duration、恢复三元组、revision、图关系、状态转移、Schema、持久化和 Git pending 语义属于领域操作。CLI 可以在构造领域请求前拒绝不能形成领域输入的 argv；请求形成后，领域语义由领域实现独立校验，直接调用不得依赖 CLI 才能获得完整校验。

### 当前与目标调用链

当前调用链是：`cli.ts（主模块启动 + argv/output 适配 + 领域 re-export） → TaskGraphService/领域实现`，`index.ts` 的领域公开面由 `cli.ts` 反向转出；构建器也以 `cli.ts` 作为运行时与声明根。

目标调用链是：`entry.ts → {cli.ts, index.ts}`，`cli.ts → index.ts 公开领域能力或必要的内部 runtime/output helper`，`index.ts → 领域实现`。只有 `entry.ts` 判断并启动主模块；`index.ts` 和领域实现不依赖 CLI，`cli.ts` 不再拥有领域 re-export。生成 bundle 和声明闭包均从 `entry.ts` 出发。

## Goals / Non-Goals

目标：

1. 让领域实现成为 CLI 和程序化调用唯一共享的行为事实源，领域直接入口只负责组合和导出。
2. 让 SDK 只表示“从分发模块直接 import 领域操作”，不表示另一层实现或更强兼容承诺。
3. 保持既有单文件自包含分发、根模块 import 路径、运行时导出集合和 CLI 协议不变。
4. 用生成与测试机械证明源码入口、运行时导出、声明闭包和 CLI dispatch 仍指向同一实现。

非目标：

1. 不把 CLI 每个 command 复制为同名 SDK method；已有 `TaskGraphService.apply` 和领域 methods 继续是程序化写入面。
2. 不把 CLI envelope、help catalog、renderer context、track/layer 或 stdout 行为变成领域 API。
3. 不缩减或扩展现有根模块的 runtime export key；低层纯操作是否长期公开不在本 Change 重新取舍。
4. 不统一其他工具的 API 目录、声明生成策略或稳定性等级。

## Decisions

### 1. 三个源码入口单向组合

- `tools/task-graph/src/index.ts` 是直接领域入口，继续组合现有 Service、纯领域操作、projection、错误、类型与 parse/serialize 导出；它不导入 CLI。
- `tools/task-graph/src/cli.ts` 是 CLI adapter，只公开 `runTaskGraphCli` 与其调用 options，不再 `export *` 领域入口。CLI 优先从 `index.ts` 取得公开领域能力；仅服务 runtime 注入、输出或测试的 internal helper 可以由 CLI 直接从内部模块导入，但不会进入分发根公开面。
- 新增 `tools/task-graph/src/entry.ts` 作为分发组合与主模块入口。它机械 re-export `index.ts` 的领域面和 `cli.ts` 的 runner/options，并只在自身是主模块时调用 runner。SDK 不是 `entry.ts` 内的新对象，而是 consumer 从同一根 MJS 直接取得 `index.ts` 导出的称呼。

该结构保留一个可执行、可导入的 `task-graph.mjs`。`entry.ts` 是组合 owner，`index.ts` 是领域导出 owner，`cli.ts` 是适配 owner；三者都不得复制领域校验或状态转移。

### 2. 领域结果与 CLI 输出保持两种边界

直接调用继续取得 `TaskGraphService` 的结构化成功值，并以 `TaskGraphError` 接收可预期领域失败；它不模拟 argv，不返回退出码，不包裹 CLI `TaskGraphResult` envelope，也不运行 CLI serializer 或 renderer。CLI 将 argv 映射为同一 Service/operation 输入，再把成功或 `TaskGraphError` 映射为现有 envelope、文本和退出码。

等价性按可观察结果验证，而不是要求两种调用返回同一包装类型：

1. 读取：在同一 workspace 和固定 clock 上，直接 `listTasks()` 的 `revision`/`data` 与 CLI `task list --json` envelope 的对应字段深度相等。
2. Mutation：从两个内容相同且相互独立的 workspace 出发，以相同 request 和固定 clock 分别运行直接 `apply()` 与 CLI `apply --json`，比较领域结果和规范化持久化索引；测试不让两次写入共享 revision 或锁状态。
3. 领域失败：同一个非法领域值由直接调用抛出既有 `TaskGraphError.code`，由 CLI 映射成相同 error code；argv 语法错误不伪装成直接调用协议。

### 3. 声明从组合入口的实现闭包生成

`scripts/build/task-graph.ts` 改以 `entry.ts` 构建运行时 bundle，并由 TypeScript 编译器从实际组合入口发出可达声明闭包。根 `.d.mts`、`cli.d.mts`、`index.d.mts` 和依赖声明仍是生成产物；生成器不得维护字段、方法或类型的手写 SDK 清单。测试分别核对：

- 源码组合入口与生成根模块的运行时 export key 都等于 `tools/task-graph/tests/generated-artifacts.test.ts` 中 `publicRuntimeExports` 的既有基线。该测试常量是兼容集合的唯一机械 owner；Change 文档不复制 key 清单。
- CLI 声明只拥有 runner/options，领域声明从 `index` 闭包可达；internal store、锁、runtime 注入和测试 hook 继续被 `@internal` 剥离。
- 根模块直接 import 不触发 main、文件 mutation、runtime 安装或网络；作为主程序运行时仍进入同一个 CLI runner。

现有 `task-graph-sdk/` 目录名可以保留为生成声明树的位置，避免无行为价值的文件迁移；该目录不代表存在 SDK 实现层。

### 4. 兼容性、版本与长期 owner

本 Change 不改变 CLI protocol version，因为命令、参数、输出、错误码和根运行时 export key 都保持不变。分发源码、声明和说明发生变化时按仓库规则提升 task-graph skill 独立版本；skill 内容版本与 CLI protocol version 是两个 owner，不互相代替。`docs/coding-style.md` 与 `docs/tooling.md` 记录通用边界：声明只提供当前实现的类型化直接调用，除非行为 owner 另行承诺，否则不自动建立独立稳定性或版本。

实施时创建一条 task-graph 后继候选决策，以“修订”关系指向 `derive-sdk-declarations-from-runtime-source.md`；由 decision-records 的统一关系事务建立新记录并归档前序记录，禁止直接改写已建立记录。后继必须自包含地说明领域入口、CLI adapter、分发组合、机械声明和非稳定性边界，不能只记录文件移动。候选 ID/标题按 decision-records 命名规则在实施时生成，不由本 Change 另造第二套标识规则。

### 5. 其他工具按 owner 分批处理

本 Change 不建立全仓 SDK registry 或统一迁移脚本。后续只有在某个工具出现真实直接调用需求或当前声明已经妨碍维护时，才在该工具 owner 下建立独立 Change；届时复用相同责任边界，但不复制 task-graph 的 Service 形态。

## Risks / Trade-offs

| 风险或取舍 | 处理方式 |
| --- | --- |
| 新 `entry.ts` 的 main-module 判断在源码 import 与 Bun 单文件 bundle 中表现不同 | 把进程启动唯一放在组合入口，并同时测试源码 import、生成模块 import 与真实 Node CLI 执行。 |
| 生成声明根从 `cli.ts` 改为组合入口后可能遗漏类型或意外暴露 internal 类型 | 继续由编译器闭包生成，逐项比较 runtime key，编译独立 consumer，并保留 internal name 拒绝断言。 |
| 为强调边界而重命名 `task-graph-sdk/` 会制造大量无行为价值 diff | 本 Change 保留目录名，只在 owner 中明确它是生成声明树。 |
| CLI 早期参数错误与领域错误容易被误写成两套验证 | 设计按 argv 表示与领域对象划界；测试证明绕开 CLI 后领域非法值仍由相同 operation 拒绝。 |
| 已知并行事项 `support-explicit-task-ids`、`add-task-tags-and-find` 与中央 task-000037 可能修改同一源码和生成物 | 实施前从最新集成基线重读这些事项的当前阶段、状态与相关 diff；只合并与本 Change 相交的入口结构，串行再生共享产物，不复制它们的领域功能。若状态已经变化，以最新事实更新兼容基线和任务说明。 |
| 仓库其他工具继续使用手写声明或 CLI re-export，短期不完全统一 | 审计结果明确保留，按工具分别处理；首个 Change 的验证不以全仓迁移为门禁。 |

## Open Questions

没有阻塞本 Change 实施的问题。以下取舍已明确暂缓，不应由实施者在本 Change 中顺手决定：

1. 是否缩减现有低层 runtime export key；若需要，必须以兼容性影响为范围另建判断，本 Change 只保持既有 `publicRuntimeExports` 基线。
2. 是否迁移其他工具；只有真实直接调用需求或当前声明 owner 已妨碍维护时，才在对应工具 owner 下建立独立 Change。

## Implementation Observations

### 真实调用面审计

| 工具 | 当前直接调用与 CLI 关系 | 本 Change 判断 |
| --- | --- | --- |
| task-graph | `cli.ts` dispatch 直接调用 `TaskGraphService`/领域函数，`index.ts` 已有完整领域导出，声明从 `cli.ts` 编译闭包生成；唯一缺口是 CLI 仍拥有根公开面。 | 纳入首批；结构最接近目标且可保持 runtime export 与协议不变。 |
| change-plan | `cli.ts` 直接 re-export lifecycle、catalog、check 与 metadata 函数；行为 owner 明确它是无声明、无稳定承诺的当前实现表面。 | 已符合“不另建 SDK”方向但没有独立领域入口；没有现实消费缺口，不在本 Change 调整。 |
| decision-records | CLI 调用 query/lifecycle/stage service，但根模块只 re-export scan/validate；`tools/decision-records/api/decision-records.d.mts` 手写运行时与领域类型。 | 涉及公开能力取舍和声明 owner，必须独立审计与 Change。 |
| investigation-report | CLI 调用 `execute*` 边界并 re-export query/stage/sync/validate；根声明由 `api/check-investigations.d.mts` 手写。 | 已共享领域实现，但声明来源迁移是独立范围。 |
| skill-validator | CLI 薄调用 `validateSkillDirectory` 并 re-export；根声明由 `api/validate-skill.d.mts` 手写。 | 可作为后续小型迁移候选，不与 task-graph 生成器改动合并。 |
| test-evidence | Catalog CLI re-export 多个领域 operation 与 Schema，根声明部分手写、结果类型由 Schema 生成；ledger 分层入口还在独立演进。 | owner 与分层边界正在变化，单独处理，禁止塞入本 Change。 |
| skill-updater | 分发模块只公开内嵌 config 与 CLI runner，更新、网络、计划和安装能力没有建立直接 SDK 入口。 | 当前没有领域 SDK 需求；不为了形式统一扩大公开面。 |

### 实施起点

实施者先从最新集成基线重新读取 `tools/task-graph/src/{cli,index,service}.ts`、构建器、`publicRuntimeExports` 测试基线、已知并行 task-graph 事项与相关决策。若其他工作已经建立等价的组合入口，应合并到现有 owner 而不是新增第二个 entry；若 runtime export、CLI 协议或领域行为已经变化，应先把最新事实及其来源写回本 Change，再判断原兼容目标是否仍成立，不把并行功能纳入本 Change。
