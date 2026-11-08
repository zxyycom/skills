# Tasks

先完成 A 阶段交付能力，再以私有目标完成 B 阶段验收，最后进入 C 阶段正式切换。审计完成仅表示方案可实施；全部实施、平台验收和发布任务仍独立计数。

## Readiness

- [x] 0.1 确认结果、顺序与平台：两域原生业务 CLI、退出旧领域 TS SDK；先 Schema/更新、再私有验收、最后入口与文档；首批 Linux x64、Windows x64。依据为本次用户确认及 proposal。
- [x] 0.2 核对当前 owner 与接线边界：Schema 导出、生成、打包、发布、updater 和 Gate；区分应退役领域代码与仍有消费者的共享能力。已核对的事实和后续消费者盘点范围见 resources/audit.md。
- [x] 0.3 审计交付方案：固定源码、分离资产、旧资产改名、显式引导、激活/清理状态及隔离输出已有明确处理；基础 manifest 扩展兼容与旧资产缺失路径已做只读探针。此项不声明新安装器已验证。
- [x] 0.4 完成 AI-Ready Docs 使用复核、正文/资源与任务覆盖审计，运行 Change 结构检查和 quick 基线；确认无阻止开始 1.1 的关键设计待决项后提升为 Plan。结果见 resources/audit.md。

## Implementation

- [ ] 1.1 A：交接格式源。先盘点两域 Schema、定义和真实消费者，建立 `tools/record-contracts/schemas/{decision-index,investigation-index}.schema.json`；旧导出器与候选生成器改用同一源，保持 schemaVersion 4、definitionVersion 11。核对 Schema、领域规则与 Rust 差异，按现行格式契约裁决；无法保持承诺时先修订方案，不能用当前 Rust 行为直接缩窄格式。同步维护导航、契约例外和必要决策；正式业务入口/说明保持。
- [ ] 1.2 A：建立隔离的构建与发布准备。按交付契约捕获 pending 原生源码与 skill 快照，生成描述符、原生 manifest 扩展、四个平台/角色资产与引导包；输出使用独占 staging，禁止清空整个 `dist/`。以原生专用协议模块和候选模式接入生成器、pack、release prepare/version/pack 与发布器，校验版本、源码和全部资产身份；默认正式分发映射在 C 才切换。
- [ ] 1.3 A：实现原生 updater 和显式引导。复用既有认证、release 查询及适用安装原语，由 `tools/skill-updater/src/native/` 负责验证、权限、激活和清理；记录支持的旧版清单、冲突处置与恢复位置。新装、旧版交接、同版本修复和后续更新使用同一引擎，其他 skill 保持原 updater。按 resources/delivery-contract.md 的状态与成功标准实现，依赖安装保持显式。
- [ ] 1.4 A：准备隔离候选包与仓库运行时。候选包带匹配 Schema、说明、专用 updater 和描述符；增加 `prepare:record-native`、其 `--check` 及仅用 Node 内置模块的调度器。候选命令显式选用，现行根命令及正式 skill 指令保持；生成检查可辨别候选与正式映射。
- [ ] 1.5 B：依据 2.1–2.3 的当前版本证据完成切换准入。核对两平台、两角色、支持的旧版清单、恢复状态、其他 skill 回归和制品一致性；任一失败或缺证据均停在 A/B，不能先更新正式使用说明。
- [ ] 1.6 C：在 1.5 完成后，同批切换根命令、记录健康 Gate、两域 skill 及操作/恢复参考、生成与发布映射。同步工具 README、共同操作模型、导航、分发/发布 owner 和对应决策的生产适用范围，提供 SDK 退役后的 CLI 使用方案；当前版本提升、Schema、二进制与说明作为同一交付身份验收。
- [ ] 1.7 C：按消费者清单退出旧领域 SDK、业务 CLI、声明、生成任务与专属依赖；迁移仍有价值的 fixture 和测试。逐项裁决受影响测试、Case 与索引，保留其他工具仍用的 shared/index-runtime/updater 能力及历史调查；新正式包和受支持的成功升级均只留下原生业务后端。

## Verification

- [ ] 2.1 B：验证格式与业务契约。用独立于 Rust 实现的固定有效/无效样例核对 Schema 和校验，以私有数据覆盖 Markdown/索引/资源格式、真实记录读取、代表性写入/暂存/恢复及 CLI JSON/退出码。核对候选/正式、关系/生命周期、资源归属与未选 Git pending；依据领域规则裁决差异，Schema 通过不替代业务验收。
- [ ] 2.2 B：在 Linux 与 Windows 各验证真实两版本制品，同一版本的两平台制品来自同一冻结来源；验证两个 skill 新装、清单内旧版引导、原生升级、同版本修复。覆盖 Linux 可执行权限、Windows 占用/权限失败、写前冲突拒绝、激活前恢复和激活后清理失败再续；实际运行 `--version`/help 及代表性业务命令，回读文件与无关 sentinel，而非只看安装返回码。
- [ ] 2.3 B：验证分发接线。低成本 fixture 检查角色/版本/target/hash/源码错配、缺资产、别名路径、旧 updater 零安装写入、其他 skill 基础 manifest/updater 兼容、输出目录 sentinel 和 rolling 发布先后顺序；真实构建检查两目标资产齐全且来自指定快照。首次引导说明由干净环境走通，私有成功不冒充远端上线。
- [ ] 2.4 C：最终对账并复验。检索源码、正式文档、生成产物、registry、Gate 和 Case 的有效引用；运行 quick、实际受影响能力组、生成检查、测试账本与真实平台检查，最终以固定待发布快照运行完整 release 门禁。发布证据绑定源码/skill/资产身份；C 的改动使先前证据失效时补做受影响验收。
- [ ] 2.5 在取得对应授权后发布并验证真实安装/升级，记录 release、资产身份、平台结果和恢复路径。授权缺失时停在此项，保留完整可发布制品和操作说明，不把本地提交或 CI 通过计作上线。
