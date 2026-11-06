# Tasks

先完成 Readiness，再按共同能力实现并联合验证两域；设计边界以 [design](design.md) 为准，准备依据见 [Readiness](readiness.md)。各项须有完成与验收证据后才能勾选。

## Readiness

- [x] 0.0 计划通过 AI-Ready Docs 与独立语义审阅，目标、范围、设计及任务覆盖一致，可从 0.1 推进；Change 结构检查与公共 quick 基线通过。
- [x] 0.1 交付两域命令、参数、公开程序化结果及仓库可核实调用者清单，映射现有命令和用户依赖输出到 JSON；外部样本可选补充，明确调查边界、未覆盖需求及确需批准的兼容性差异，默认继承既有 trace JSON 契约。依据见 [能力映射](capability-mapping.md)。
- [x] 0.2 冻结 Linux x64 glibc 的 target、ABI、候选运行基线及平台安全验收语义，列明原生实施与验证环境；仅实际需求缺口或范围取舍需用户确认。依据见 [验证计划](verification-plan.md)，实际运行证据由 2.2 验收。
- [x] 0.3 定稿共同底座和领域适配归属、跨语言 schema 权威源、CLI 契约、阶段与单次复用策略，并核对适用长期决策及同步 owner。依据见 [架构](architecture.md)。
- [x] 0.4 按 Test Design 交付可追踪测试和性能矩阵，明确独立预期、固定私有 fixture、真实 Git 边界、Cargo 原生节点与 Case 的证据采集、Linux 原生候选 CI 和离线制品证据；性能报告真实单次调用及规模变化，不预设统一加速倍数。依据见 [验证计划](verification-plan.md)。
- [x] 0.5 确定候选 Rust 开发工具链、独立构建和测试 scope，以及与既有生成、发布和 quick 入口的隔离方式。依据见 [架构](architecture.md)及[制品设计](delivery-plan.md)。

## Implementation

- [x] 1.1 实现两域共用的 Rust 索引、文件安全和记录操作底座，以及独立领域适配和现有持久格式支持；满足编码规范和阶段证明边界。代码规范优化、事务独立正确性审查及本地完整 Gate 通过。
- [x] 1.2 实现两域全部查询与候选读取，交付按清单映射的 CLI JSON、诊断和输出契约，并保留单次操作的快照与惰性图复用。查询 owner 已交接双域入口，31 项私有集成测试、Cargo 格式与全目标 Clippy 通过；完整联合与原生平台验收由 2.1 / 2.2 承接。
- [x] 1.3 实现两域全部写操作、同步与 stage，覆盖现有多对象行为和事务阶段、pending 保护及恢复事实。Linux 原生 312 个测试节点及事务审查通过；最终输入的完整命令重验由 2.1 承接。
- [x] 1.4 实现正式 Cargo 测试和隔离 fixture，接入项目 Case 证据采集与 Linux 原生候选 CI，依据测试矩阵核对覆盖。Test Design 审核完成，49 个新 Case 与项目 2,148 个测试实体的完整来源、引用及覆盖检查通过；冻结平台实际运行由 2.2 验收。
- [x] 1.5 实现隔离的本地候选构建、打包及 installer/update 试验，交付未来 GitHub 资产、manifest/hash 接线与旧入口迁移和清理契约。真实 A/B 构建及更新回退入口已实现，交付单测与代码门禁通过；冻结平台最终制品由 2.4 验收。
- [x] 1.6 按 Readiness 判断维护适用的稳定 owner 和长期决策，清楚区分候选契约与现行生产行为。稳定协议、兼容性、维护及分发 owner 已更新并经 AI-Ready Docs 优化；共享候选方向及 DTO 重复取舍均已核对并对齐，生产接线继续由后续独立决定。
- [x] 1.7 按已确认范围移除候选 Windows 专属实现、依赖与测试接线，收敛 Linux 原生构建、安装和 CI。独立正确性、编码规范与 Test Design 复验完成；312 个原生节点、2,148 个实体覆盖、真实本地 A/B 构建与更新回退及完整 Gate 70 项通过。现行 TS 和视频 Windows 支持不变；Ubuntu 22.04 基线由 2.2 / 2.4 验收。

## Verification

- [x] 2.1 按映射联合验收两域全部操作及用户依赖输出，核对 JSON、诊断、顺序/预算、状态与退出契约，并记录经批准的差异。[联合验收](joint-acceptance.md) 对最终 Linux-only 提交 `8ba448ea` 独立冻结、release 构建和复验：DR 18 / IR 14 个命令、110 次零跳过真实进程观察及同源 312 个原生节点通过，来源和外部 fixture 前后无漂移。孤立 UTF-16 代理项输入拒绝已获批准，正常文字及旧版预览截断兼容。
- [x] 2.2 在冻结的 Linux 环境运行正式测试和 CI，按测试矩阵验证文件安全、Unicode、并发、阶段及失败恢复，核对项目 Case 和覆盖证据。[原生平台验收](platform-acceptance.md) 记录 `8ba448ea` 的 Ubuntu 22.04 x64 / glibc 2.35 原生 CI：312 个 Cargo 节点、3 个交付协议测试及 2,148 个实体覆盖通过；Windows 不属于本轮候选验收。
- [x] 2.3 在代表性规模运行真实单次 CLI 新旧性能对照，记录版本、环境、fixture、冷暖条件、命令、样本、结果和限制，不以旧实验倍数代替结果。[独立性能报告](../../docs/investigations/261106-record-cli-final-candidate-performance.md) 已在最终 Linux-only 提交 `8ba448ea` 补测 32 / 100 / 500 条三规模、57 单元、2,280 正式样本及 114 预热；全部进程、正确性和首尾守卫通过。初轮数据原字节保留，新增资源独立标识最终输入与窗口；Node 成簇波动及原因未明如实披露，不把端到端差异归因于纯语言。AI-Ready Docs 及全量 93 份调查报告检查通过，索引 current。
- [x] 2.4 验收本地离线制品的身份绑定、错误及回退，核实生产边界未切换。[原生平台验收](platform-acceptance.md) 记录同次 Ubuntu 运行的真实 A/B 构建、安装、更新与故障回退，四个下载资产的长度及 SHA-256 与 manifest 独立核对一致。最终 `bun run check -- --scope full` 为 70 passed、0 failed、0 unavailable（3 项不适用），调用 `20261106T143001033Z-1c72abd8-72df-4925-b515-2ec5a046b9d3`；两域记录检查、项目测试证据和规范审阅完成。生产 TS、skill/updater 未切换，未发布原生包；其他平台及在线分发不在本轮证明范围。
