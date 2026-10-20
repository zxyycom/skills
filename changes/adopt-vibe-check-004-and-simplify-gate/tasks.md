# Tasks

Readiness 记录实施前审计，Implementation 与 Verification 记录升级和交付证据。
全部 28 项工作与验证已完成；历史结果与本轮完成态按[升级证据](upgrade-evidence.md)分别保存。
最终 base、本地 CI、冷 release、Case 和独立审查通过；接续保存完成态并由主代理实际 finalize。

## Readiness

- [x] 0.1 核对依赖、仓库模型、Gate owner、68 项声明及长期契约。
  依据：[Gate 清单](gate-inventory.md)与 proposal 的 Affected Owners。
- [x] 0.2 校验精确 0.0.4 发布包，读取跨版本 breaking contracts，记录隔离安装身份。
  依据：[来源与身份](upgrade-evidence.md#来源与身份)。
- [x] 0.3 明确 Markdown 六规则和维护范围，核对实际项目材料扫描。
  依据：design 的 Check 组成与内容规则及[项目成本](upgrade-evidence.md#项目成本基线)。
- [x] 0.4 核对统一生成调用、真实输入及外围入口，确定八项后继和三项 MCPShell 离线结果。
  依据：[生成与外围入口](upgrade-evidence.md#生成与外围入口)及[身份映射](gate-inventory.md#目标身份映射)。
- [x] 0.5 核对既有 31 Check/33 文件的执行成本，确定独立命令与原生智能调度，明确批次替代边界。
  依据：[特殊结构结论](upgrade-evidence.md#特殊结构的必要性结论)。
- [x] 0.6 审计原生路径证据、计算缓存与项目真实输入，明确最小成功证明和保守执行边界。
  依据：[输入边界](upgrade-evidence.md#输入边界)。
- [x] 0.7 核对包根 API、项目 imports 和类型影响，覆盖保留的实际调用方。
  依据：[API 清单](api-migration-matrix.md)。
- [x] 0.8 实施就绪审计：目标、结构选择、输入边界、身份后继、任务与成功标准一致；
  按 ai-ready-docs 复核重心、历史残留、重复及格式，确认可从 1.1 直接推进。
  审计记录：[实施就绪审计](upgrade-evidence.md#实施就绪审计)。

## Implementation

- [x] 1.1 用项目固定 pnpm 升级精确 0.0.4 与 lock，按 API 清单迁移 callback/context、类型、flags、
  patterns、聚合和结果消费；以类型检查定位真实调用缺口。
- [x] 1.2 实现 native / 领域函数 / 独立 commandCheck 接入，配置环境、transcript、限额和重跑诊断，
  按 design 责任表清理被替代的执行与批次层。
- [x] 1.3 接入新版原生 learned helper，迁移实际 descriptor/terminalEffect 调用，
  维护最小 identity/history 与命令方式的可比性，保持全部资源和隔离约束。
- [x] 1.4 原生构造器直接承接声明；release prepare → authorization → pack 使用 typed handoff，
  保持同一快照、provider 身份和跨 Run 隔离，完成外置状态替代。
- [x] 1.5 实现项目最小成功证明：逐项声明真实输入域、新身份、保守执行、最终发布和漂移保护；
  原生材料实际结算。按责任收敛输入辅助层，并定位输入采集及过宽触发的实际成本。
- [x] 1.6 落实清单的身份及前置映射，新增 Markdown 和三项 MCPShell 离线结果，
  保持专用集成/性能入口的边界；更新 catalog 与 release-required 集合。
- [x] 1.7 对照实际项目 Records 逐条归因五条指标，必要整改进入源码 owner 并验证行为。
  发现分析器 Bug 时形成针对性最小反例；保持现行阈值与阻断政策。
  依据：[实施验证记录](upgrade-evidence.md#实施验证记录)中的指标与分发结果。
- [x] 1.8 随实际改动同步项目测试、catalog fixture、Case/index、工具链、Check 编写说明及必要决策。
  最小导出对应的生成物、独立版本与输入闭包已核对；三条本 Change 的继任决策公开 mark-aligned 后 strict check 通过。
- [x] 1.9 逐项审计调查报告全部原最小原生入口，实施有依据的规则下沉与测试调整。
  [审计 JSON](test-layer-audit/investigation-report.json)逐项覆盖 310 个原节点，最终 309 个；45 个整节点下沉、3 处辅助精简、1 个弱重复删除、3 个真实入口断言加强。
- [x] 1.10 逐项审计决策记录全部原最小原生入口，实施有依据的规则下沉与测试调整。
  [审计 JSON](test-layer-audit/decision-records.json)逐项覆盖 302 个原节点，最终仍为 302 个，39 个下沉；边界与最小导出见[分层结果](upgrade-evidence.md#测试分层结果)。

## Verification

- [x] 2.1 使用项目固定 pnpm 执行 frozen-lock 安装，运行 `bun run typecheck`、`bun run test:check`
  和受影响真实 Node 调用方；
  核对项目构造/参数、callback 传参、调度配置与身份、Run 结果及 CLI 退出码。
- [x] 2.2 验证项目命令 argv/cwd、环境、transcript capability、限额声明、诊断和重跑信息；
  自有结果映射覆盖真实分支，测试范围符合 design 的验证边界。
- [x] 2.3 验证成功证明的输入与发布：源码/fixtures/生成/配置/环境、ignored 磁盘输入、TS/MTS、
  删除/重命名、symlink、未知/越界/读取失败、起止漂移，以及首次、clean、dirty 和提交后行为。
  确认原生材料实际执行、项目精确命中才省略、未闭合输入保守执行。
- [x] 2.4 验证项目 release DAG 消费同一授权快照，缺失前置、版本/pack 失败及取消保持阻断；
  machine 输出为摘要，最终 Run 未成功时不发布证明；CI/cold 实际执行。
  历史冷 release 已 64/64 通过，本地 `CI=1` 完整 Gate 已 61 passed、3 release 未激活且不发布 receipt；
  仅证明当时输入，测试分层后的最终完整验证由 2.7 承接；远端 CI 未验证。
- [x] 2.5 核对五条指标的归因与处置；验证本项目 Markdown 规则/范围/呈现、链接和 Schema 配置，
  缓存命中后仍按当前规则结算。
- [x] 2.6 核对旧身份后继、统一生成等价及三项离线结果，运行受影响项目测试、
  `bun run check:test-evidence-catalog`、`bun run check` 和 `bun run check --tag release --cold`。
  Release 使用明确保存的 pending snapshot，保留无关工作区及 index 内容。
  [final2 与冷 release](upgrade-evidence.md#final2-完整-cli-与冷-release)记录当时结果和两项 skill 的制品输入边界，不替代 2.7 的本轮完成态验证。
- [x] 2.7 在 1.8 与 2.9/2.10 完成后，重新运行最终 `bun run check`、必要本地 CI 及 `bun run check --tag release --cold`，明确保存的 pending snapshot 和版本基线。
  同机对比无输入变化、单 owner、共享 owner 与冷 release 的完整 CLI wall、CPU、进程/并发与执行/复用量，记录智能调度 history 状态及生成准备成本。
  [最终完整验证](upgrade-evidence.md#最终完整验证)记录 base 61 passed、本地 CI 61 passed、冷 release 64 passed 及全部成本；
  无变化三轮 <10s，单/共享 owner 没有稳定提速或达历史 ≤15s 的证据；按逐项真实义务完成验收。
- [x] 2.8 依赖 1.8、2.7、2.9/2.10，按 ai-ready-docs 与代码优化原则完成最终复核，核对全部成功标准、稳定 owner 和 Case 交接。
  AI-ready 文档与最终代码优化复核完成；公开 Node 24 入口、Linux 本地 CI、244 路径 pending tree 和实际 24 个 skill 制品已报告。
  远端 CI/Windows/外部发布未验证，最终提交与 finalize 尚待执行；本轮完成态与历史样本分别保存。
- [x] 2.9 对 1.9/1.10 的全部原入口完成审计对账，运行两个领域的最小入口及聚合自验证、必要真实 Node/分发调用，补齐边界失败用例。
  核对重 Git、真实 Node、同进程 CLI、纯函数与轻量领域函数的实际层级及成本；每项原义务均有保留或后继证据。
  按 Case owner 维护 Tests/Contract/Proves，运行 `bun run sync:test-evidence-catalog`、`bun run test-evidence -- check --root .` 和 `bun run check:test-evidence-catalog`；
  两领域聚合、静态验证、最低 Node 入口与生成检查通过；最终 1152 个 Case 覆盖 1305 个项目实体。
  全部 612 个原节点与 611 个最终节点的实际 locator 对账通过，仅删除授权弱重复节点，无新增、移动或改名。
- [x] 2.10 由独立审查者核对两领域完整 diff、逐项审计及 Case 证明：下沉后真实接线、Git 索引/原子性/路径漂移、命令分发、失败阻断与恢复语义未丢失。
  两项审查跟进补强并复验，Case 过宽措辞已收窄；Case、版本/生成及修复的最终独立复核完成，无未闭合发现。
