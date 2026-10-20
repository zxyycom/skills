# Tasks

Readiness 记录实施前审计，Implementation 与 Verification 记录升级和交付证据。
按 1.1 → 1.2–1.6 → 1.7–1.8 推进，验证随对应实现执行；全部成功标准满足后结项。

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

- [ ] 1.1 用项目固定 pnpm 升级精确 0.0.4 与 lock，按 API 清单迁移 callback/context、类型、flags、
  patterns、聚合和结果消费；以类型检查定位真实调用缺口。
- [ ] 1.2 实现 native / 领域函数 / 独立 commandCheck 接入，配置环境、transcript、限额和重跑诊断，
  按 design 责任表清理被替代的执行与批次层。
- [ ] 1.3 接入新版原生 learned helper，迁移实际 descriptor/terminalEffect 调用，
  维护最小 identity/history 与命令方式的可比性，保持全部资源和隔离约束。
- [ ] 1.4 原生构造器直接承接声明；release prepare → authorization → pack 使用 typed handoff，
  保持同一快照、provider 身份和跨 Run 隔离，完成外置状态替代。
- [ ] 1.5 实现项目最小成功证明：逐项声明真实输入域、新身份、保守执行、最终发布和漂移保护；
  原生材料实际结算。按责任收敛输入辅助层，并定位输入采集及过宽触发的实际成本。
- [ ] 1.6 落实清单的身份及前置映射，新增 Markdown 和三项 MCPShell 离线结果，
  保持专用集成/性能入口的边界；更新 catalog 与 release-required 集合。
- [ ] 1.7 对照实际项目 Records 逐条归因五条指标，必要整改进入源码 owner 并验证行为。
  发现分析器 Bug 时形成针对性最小反例；保持现行阈值与阻断政策。
- [ ] 1.8 随实际改动同步项目测试、catalog fixture、Case/index、工具链、Check 编写说明及必要决策。

## Verification

- [ ] 2.1 使用项目固定 pnpm 执行 frozen-lock 安装，运行 `bun run typecheck`、`bun run test:check`
  和受影响真实 Node 调用方；
  核对项目构造/参数、callback 传参、调度配置与身份、Run 结果及 CLI 退出码。
- [ ] 2.2 验证项目命令 argv/cwd、环境、transcript capability、限额声明、诊断和重跑信息；
  自有结果映射覆盖真实分支，测试范围符合 design 的验证边界。
- [ ] 2.3 验证成功证明的输入与发布：源码/fixtures/生成/配置/环境、ignored 磁盘输入、TS/MTS、
  删除/重命名、symlink、未知/越界/读取失败、起止漂移，以及首次、clean、dirty 和提交后行为。
  确认原生材料实际执行、项目精确命中才省略、未闭合输入保守执行。
- [ ] 2.4 验证项目 release DAG 消费同一授权快照，缺失前置、版本/pack 失败及取消保持阻断；
  machine 输出为摘要，最终 Run 未成功时不发布证明；CI/cold 实际执行。
- [ ] 2.5 核对五条指标的归因与处置；验证本项目 Markdown 规则/范围/呈现、链接和 Schema 配置，
  缓存命中后仍按当前规则结算。
- [ ] 2.6 核对旧身份后继、统一生成等价及三项离线结果，运行受影响项目测试、
  `bun run check:test-evidence-catalog`、`bun run check` 和 `bun run check --tag release --cold`。
  Release 使用明确保存的 pending snapshot，保留无关工作区及 index 内容。
- [ ] 2.7 测量无输入变化、单 owner、共享 owner 和冷 release 的完整 CLI 耗时、进程数与资源成本，
  记录智能调度历史状态；按 proposal 的反馈标准验收，未达标继续定位并处理瓶颈。
- [ ] 2.8 核对成功标准与稳定 owner/Case 交接，报告实际安装、运行平台、CI 和发布的已验证边界。
