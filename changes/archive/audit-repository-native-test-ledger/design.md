# Design

本设计以 runner 的实际报告节点作为当前历史账本的审计单位，复核既有框架转换，只对仍缺少独立报告边界的聚合脚本继续改造，并把修正后的 case 写入最终 topic 目录。

## Context

- 已提交基线中的多组测试通过 `run.ts` 顺序调用导出的 `test*` 函数，进程只有整体成功或失败；函数名虽可被代码调用，但不自动成为 runner 原生节点。
- 当前基线已经把许多测试改成 `node:test` 并修改 package scripts，同时登记了 90 个 case。提交存在只证明实现可运行，不证明每次节点拆分和 case 映射都符合最终粒度；本 change 逐组确认、修正或补齐。
- 恢复后的 `test-evidence-review` 以“一个保留的最小原生测试入口对应一个 case”为核心，并明确排除工程校验、marker、采集和自动注册。
- `organize-test-evidence-by-topic` 与 `migrate-repository-test-evidence-to-topic-layout` 必须先提供最终目录、topic 表和合法 case 基线。

## Goals / Non-Goals

目标：

- 证明当前独立测试意图已经获得 runner 级名称、选择和结果归因，并修复实际缺口。
- 让每项保留或修正的测试代码改造都可由既有断言集合和执行结果证明行为未变。
- 一次性审计全部历史稳定测试，而不是只登记本次修改触及的入口。
- 让最终 ledger 的 case 粒度、测试节点粒度和失败归因一致。

非目标：

- 不把每个断言、helper、fixture、参数值或步骤机械拆成独立节点。
- 不要求不同 tool 使用同一框架；框架只需常见、已可用、输出稳定且接入成本小。
- 不通过扫描器长期证明全仓完整性；历史清单是本 change 的迁移证据。
- 不因改造 runner 顺手增加新行为测试、重命名产品 API 或重构实现。

## Decisions

1. 先从稳定 `test:*` package scripts、其导入的 run 文件、直接测试模块和当前 case 生成一次性人工审计清单，记录容器、现有原生节点、独立测试意图、case 映射和工程校验排除项。
2. 已经由常见框架注册并独立报告的 `test`、`it`、测试方法或等价节点保持现状；只补充缺失 case，不为格式统一重写。
3. 当前框架转换按测试组审阅；普通脚本仍包含多个可独立命名、独立失败的测试意图时，才继续把这些意图注册为框架原生节点。优先使用当前运行时原生或仓库已有框架，例如 Bun 环境可选择 `bun:test`，Node 兼容边界适合时可选择 `node:test`。
4. 框架选择以最小整体维护面为准：无需新增依赖、与现有 runtime 和 TypeScript 配置兼容、支持异步清理、产生稳定名称与退出码。不同测试组可以作出不同选择。
5. `run.ts` 只负责导入注册测试或作为 package script 的单一 runner 入口，不拥有 case；suite 只组织名称和共享 fixture，也不拥有 case。
6. helper 只有在被注册为 runner 最终节点且拥有完整测试意图后才可对应 case。单纯 export、可单独调用或技术上可筛选不构成原生测试入口。
7. 多个断言可以保留在一个节点中，但必须共同服务同一测试意图；若失败能分别归因于不同稳定意图，则先拆节点，再分别登记 case。
8. 每个保留节点在最终 topic 目录中恰好创建或更新一个 case。Entry 首选“文件路径 + runner 完整测试名”，可附加精确选择同一节点的命令，但不把 package script 或文件本身当作入口。
9. topic 归属按被证明契约的主要 owner 选择，不按测试文件目录机械决定。共享基础设施测试只有在确属跨工具契约时进入共享 topic。
10. 工程校验脚本即使由 `bun run check` 执行，也不进入测试账本；它们继续由项目工具链和各自测试验证。
11. 改造前后运行同一测试组并比较断言路径、fixture 生命周期、临时目录清理、退出状态和 bundled/source parity，避免框架并发或隔离语义改变结果。
12. 当前 `node:test` 基线逐文件审阅：满足上述边界的保持，不必要的包装、仅为计数的拆分或改变测试语义的改动予以收敛；不因已经提交就默认全部正确，也不整体回退。
13. 历史完整性通过一次性清单、runner 报告和最终 case ID/Entry 对照验收。工具仍不获得源码扫描、自动注册或未登记入口 gate。

## Risks / Trade-offs

- 测试框架默认并发可能改变共享全局状态、临时目录或 process mutation 的时序；需要按测试组显式串行、隔离或恢复环境，而不是假设包装后语义不变。
- 将一个长脚本拆成多个节点可能重复昂贵 setup；可以使用框架 fixture 或 suite 生命周期，但不能因此重新合并独立失败意图。
- 不同框架并存会增加少量命令差异；相比强制统一造成的大面积重写，这是更小的维护面，Entry 必须记录精确定位。
- 一次性历史审计无法持续自动证明未来完整性；后续完整性依靠 skill 在修改测试时显式维护，而不是重新引入采集器。
- 当前大面积测试转换可能混有必要节点拆分与纯格式变化；实施需要按文件审阅并用实际 runner 输出证明取舍。

## Open Questions

无统一框架选择问题需要提前决定。每个测试组在实施时按已有运行环境和上述最小维护面标准选择常见框架，并在对应任务证据中记录选择。

## Implementation Observations

### 2026-07-27 实施起点

- `organize-test-evidence-by-topic` 与
  `migrate-repository-test-evidence-to-topic-layout` 已归档；v3 目录基线包含
  9 个受控 topic、106 个 case，test-evidence runner 报告 31/31 节点通过且
  strict 目录检查通过。
- 一次性历史清单覆盖 11 个稳定 `test:*` 命令。最初可达 104 个节点，
  `tools/test-evidence/tests/repository-catalog.test.ts` 的 2 个历史节点恢复到
  稳定 runner 后，当前实施基线为 106 个可达原生节点。
- 清单已区分 package script、`run.ts`、测试文件、support、fixture、helper 和
  断言；前五类中的容器或内部环节不登记 case，工程校验继续排除在账本之外。
- 本 change 不修改通用 topic 工具、Schema、配置、topic 表或源码采集行为。
  当前并行实施按测试责任分区；本分区只处理 index-runtime、version-control 和
  skill-package-hash 的自然节点拆分及对应 case。

### 2026-07-27 index-runtime、version-control 与 skill-package-hash 分区

- 三组继续使用现有 `node:test` 与 Bun runner，不修改 package script 或
  `run.ts` 容器。index-runtime 从 5 个聚合节点拆为 33 个稳定节点，
  version-control 从 1 个拆为 8 个，skill-package-hash 从 1 个拆为 5 个；
  本分区账本因此由 7 个 case 调整为 46 个 case。
- index-runtime 按定义协议、物化与序列化、查询、新鲜度、reader 快照、
  runtime 覆盖和持久化恢复等行为边界拆分；已有性能节点保持单一尺度证据，
  没有把 helper、fixture 或 `run.ts` 登记为 case。
- Git 相关节点各自建立并清理临时仓库。skill-package-hash 的首次隔离运行
  暴露旧聚合节点顺序依赖：新增 skill 场景暗中依赖前一段已把 alpha 提升到
  v4；节点内显式建立该前置状态后独立通过。
- 逐节点对照确认 index-runtime 33/33、version-control 8/8、
  skill-package-hash 5/5 的 runner 名称与 case Entry 完全一致；46 个本分区
  case 文件各含一个 Case、Entry、Contract 和 Proves，case ID 无重复。
- 目标验证结果为 `bun run test:index-runtime` 33/33、
  `bun test ./tools/shared/tests/version-control.test.ts` 8/8 和
  `bun test ./scripts/lib/skill-package-hash.test.ts` 5/5。代表性的 pending
  Git 内容节点随后单独重复运行并通过，未观察到共享状态污染或临时资源泄漏。
- 本分区没有修改统一派生索引、topic 表、test-evidence 配置或其他测试组；
  这些全局产物与完整 strict 验证留给各分区汇总后的统一步骤。

### 2026-07-27 全仓汇总与最终验收

- 三个实施分区均已结束且没有跨分区写入冲突。106 个基线节点最终调整为
  178 个自然 runner 节点，净增加 72 个：change-plan 18→20、
  decision-records 13→29、check 8→11、generated-file 3→3、
  skill-package-hash 1→5、index-runtime 5→33、version-control 1→8、
  investigation-report 10→13、skill-validator 5→10、test-evidence 31→31、
  skill-updater 11→15。
- 最终 topic 数为 9，case 分布为 change-plan 20、decision-records 29、
  index-runtime 33、investigation-report 13、repository-tooling 19
  （check 11、generated-file 3、skill-package-hash 5）、skill-updater 15、
  skill-validator 10、test-evidence 31、version-control 8，总计 178。
- 一次性源清单覆盖 `package.json` 中全部 11 个稳定 `test:*` runner。逐文件
  提取原生注册节点，并按 runner 的实际报告粒度展开 test-evidence 的 v1/v2
  参数化升级节点；与全部 case 的“文件路径 > 完整节点名”Entry 双向比较后，
  missing、extra、重复源节点、重复 case locator、重复 case ID、无定位 case、
  多节点 locator 和文件结构问题均为 0。
- 导入型 `run.ts` 只作为容器；skill-validator、test-evidence 和 skill-updater
  的 `run.ts` 直接注册原生节点，因此 case 定位其中的具体节点而非整个文件。
  Package script、suite、support、fixture、helper、断言与 `check:*` 工程 gate
  均未登记为独立 case。
- 统一索引只通过 `bun run sync:test-evidence-catalog` 重建。最终索引使用
  `schemaVersion: 2`、`namespace: test-evidence`、`definitionVersion: 3`，
  包含 178 个 entry；官方 catalog check 返回 0 diagnostics，索引为 current。
  全量 `list --limit 200` 返回 178/178，九个 topic 各自执行 `list` 与 `show`
  均无诊断，并能从索引定位到权威 Markdown。
- 11 个稳定 runner 均单独通过，报告数量依次为 20、29、11、3、5、33、8、
  13、10、31、15，总计 178。Git pending、skill package pending、
  `process.platform` 恢复和 `console.log` 恢复节点随后按精确名称隔离重跑通过，
  未发现并发污染、临时资源泄漏或剩余顺序依赖。
- generated-file 的 3 个既有节点和 test-evidence 的 31 个保留节点无需为账本
  形式更换框架，证明登记契约只依赖 runner 的自然最终节点，不依赖特定注册
  API 或本 change 是否改造过测试。
- `bun run typecheck`、`bun run validate`（18 个 skill、413 个 Markdown）、
  `bun run check:decisions`（19 个 domain、134 条 decision）均通过。
  `bun run check --strict` 的 23 个 preflight、全部测试与最终 packaging 在
  19.95 秒内全部通过；最终没有阻塞诊断或未解释的账本缺口。
