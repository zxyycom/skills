# Proposal

本 Change 把 task-graph 的程序化入口明确落在 CLI 实际调用的领域操作层，并让 CLI 只保留外部表示与输出适配。实施者应能只依据本 Change 的三个 artifacts 及其链接的稳定 owner，恢复入口职责、兼容边界和验收方法，不需要本次调查对话。

## Why

当前 task-graph 已经由 `TaskGraphService`、engine、projection、Schema 与 staging 模块承接领域行为，CLI dispatch 也直接调用这些能力；分发模块能够无副作用导入，TypeScript 声明由实现机械生成。可是分发 bundle、声明闭包、源码测试和长期决策仍以 `tools/task-graph/src/cli.ts` 作为共同公开入口，并由 CLI 文件反向 `export *` 领域入口。这使“CLI 是适配层”与“CLI 是接口事实源”同时成立，调用关系和维护责任不够单向，也容易让后续实现把 SDK 误作需要独立模型、稳定性或便利方法的第二层。

仓库中其他可导入工具还存在手写声明、分层接口或仅导出 CLI runner 等不同形态。一次重写全部工具会混合多个领域 owner、兼容边界和正在推进的 Change，无法形成小而可验证的实施批次。task-graph 已最接近目标结构，适合作为首个明确实施范围。

## Outcome

task-graph 形成单向调用面：领域操作与类型由 `tools/task-graph/src/index.ts` 组合，CLI runner 只把进程参数转换为领域输入并把领域结果转换为 JSON 或文本，新的 `tools/task-graph/src/entry.ts` 同时导出二者并独占主模块启动。程序化调用从同一分发模块直接取得 CLI 所调用的领域能力，跳过进程、argv 和序列化。本文中的“SDK”仅指这种直接 import 的消费方式，不指另一套实现、模型、校验、便利协议、接口版本或稳定性承诺。

## Scope

### Intended Change

本 Change 为 Outcome 采用的核心调整是把 task-graph 的领域直接入口、CLI 适配入口与分发组合入口拆成单向依赖，同时保持同一领域实现和既有根模块外部行为：

- 为 task-graph 增加独立的分发组合入口；让 `cli.ts` 不再作为领域公开导出的 owner，让 `index.ts` 保持直接操作入口。

该入口调整继续受以下范围边界约束：

- 不在本 Change 中迁移 decision-records、investigation-report、skill-validator、test-evidence、skill-updater 或 change-plan 的程序化入口与声明来源。
- 不新增逐命令 SDK wrapper、service factory、alias、registry、独立包、独立版本或兼容性承诺。
- 不改变 task index、领域请求、状态转移、错误码、CLI 命令、CLI 输出或现有根模块运行时导出集合。
- 不实施当前其他 task-graph Change 的显式 ID、tag/find、关系继承、纠错或重开能力。

### Resulting Impacts

入口 owner 从 `cli.ts` 转移到单向组合结构后，生成链、仓库说明和兼容证据必须随之对齐；这些是核心入口调整触发的必要影响，不是另一套 SDK Outcome：

- 明确仓库级“领域操作层 → CLI 适配 / 直接 import”责任边界，并纠正“生成声明天然等于稳定 SDK”的工具链表述。
- 调整 task-graph 构建与生成声明闭包，使运行时根模块继续同时提供 CLI runner 和既有领域导出，但声明来源与源码责任边界一致。
- 更新 task-graph 行为 owner、人类说明、长期决策、生成产物、测试与测试证据。

## Success Criteria

1. task-graph 源码存在明确的领域直接入口、CLI 适配入口和分发组合入口；`cli.ts` 不再通过 re-export 拥有领域公开面。
2. CLI 的领域命令继续调用与直接 import 相同的 Service/operation；CLI 只拥有 argv、stdin/`--file`、renderer、envelope 和退出码等适配责任。领域对象、状态、图、租约、revision 与持久化规则由领域层独立校验和执行，绕过 CLI 时仍不能绕过这些规则。
3. `skills/task-graph/scripts/task-graph.mjs` 的运行时 export key 与 `tools/task-graph/tests/generated-artifacts.test.ts` 中既有 `publicRuntimeExports` 基线一致；CLI 命令、参数、输出、错误码和 protocol version 不变。源码入口与生成模块被 import 时均不启动 CLI，也不产生文件 mutation、runtime 安装或网络副作用。
4. `.d.mts` 根入口及其可达声明树从实际 TypeScript 入口机械生成，不新增手写 SDK 声明源，也不把内部 store、锁、runtime 注入或测试 hook 暴露为公开能力。
5. task-graph 稳定 owner 与后继决策明确 SDK 只是同一领域操作的直接调用方式，不单独承诺稳定性、版本或第二套契约；其他工具只保留审计结论和独立后续边界。
6. 等价性测试至少覆盖一条读取、一条 mutation 和一条领域失败：在固定 clock 下比较直接结果与 CLI JSON envelope 的对应 `revision`/`data`，在相同 request、固定 clock 和独立同构 workspace 下比较持久化结果，并比较 `TaskGraphError.code` 与 CLI error code；受影响原生测试、生成漂移、声明 consumer、决策与测试证据检查以及仓库完整门禁通过。

## Affected Owners

- [`docs/coding-style.md`](../../docs/coding-style.md)：入口、领域规则、直接 import 与错误映射的仓库级实现边界。
- [`docs/tooling.md`](../../docs/tooling.md)：可分发源码、声明来源、生成闭包与稳定性含义。
- [`skills/task-graph/SKILL.md`](../../skills/task-graph/SKILL.md) 与 [`docs/skills/task-graph.md`](../../docs/skills/task-graph.md)：task-graph 当前调用面、行为和人类说明。
- [`docs/decisions/derive-sdk-declarations-from-runtime-source.md`](../../docs/decisions/derive-sdk-declarations-from-runtime-source.md)：需要通过后继决策修订的现有 CLI/SDK 入口判断。
- [`tools/task-graph/src/`](../../tools/task-graph/src/) 与 [`scripts/build/task-graph.ts`](../../scripts/build/task-graph.ts)：领域入口、CLI 适配、分发组合和生成实现。
- [`skills/task-graph/scripts/`](../../skills/task-graph/scripts/) 与 [`skills/task-graph/references/task-graph-index.schema.json`](../../skills/task-graph/references/task-graph-index.schema.json)：机械生成的分发 bundle、声明树、source map 与同一同步批次中的 Schema；本 Change 预期 Schema 语义和内容不变，但仍由统一同步入口核对。
- [`tools/task-graph/tests/`](../../tools/task-graph/tests/) 与 [`docs/test-evidence/task-graph/`](../../docs/test-evidence/task-graph/)：源码、分发与直接/CLI 调用边界的验证证据。
