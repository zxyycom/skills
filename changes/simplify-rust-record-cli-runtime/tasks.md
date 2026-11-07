# Tasks

按边界核对、并行实现、集成验证的顺序推进；勾选须有对应完成证据。

## Readiness

- [x] 0.1 核对目标、既有改动、领域和事务入口、当前接口及各 owner 写入边界，确认用户已批准的目标与非目标；冻结计划后协调实现。
- [x] 0.2 阅读适用的测试设计、测试证据、编码规范、决策和门禁契约，确认最小平台与私有 fixture 验收路径；不把旧测试当作保留旧机制的依据。

## Implementation

- [x] 1.1 source/transaction owner：用跨平台成熟库收敛文件访问和已有文件的原子更新，删除已取消的锁、身份、权限、多阶段证明、备份和回滚机制；保留工作区范围、独占新建和准确部分/未知事实，新建初始化失败允许部分文件而不覆盖既有目标。
- [x] 1.2 domain owner：调整 DR/IR 操作到单次准备和必要领域校验，保留 IR 发布身份与成员事实；资源冲突预检后目录 rename，顺序更新引用和索引，按实际结果处理部分失败。
- [x] 1.3 Git/delivery owner：以 `hash-object` 和一次 `update-index --index-info` 实现所选记录同 JSON 合成，保留未选暂存，由 Git 管锁；删除自持锁、备用 index 和 HEAD/pending CAS；接线 Linux 私有离线交付和 Windows bins、manifest/.exe；Windows 仅做目标编译及接线 mock/单元验证，不新增 Windows CI、native 运行或下载 SDK。
- [x] 1.4 集成候选 envelope version 2：删除不再产生事实的 verification、outcome 恢复状态、recoveryBackups、recoveryDirectories、cleanupErrors，不保留兼容壳；保留业务信息粒度及 status、changed、committed、writtenPaths、unknownPaths、errors 和可区分的失败步骤/路径，成功 trace 特殊形状不变。计划 review 和实际结果各有依据，不伪造 postverify review；其他形状变化先交主线程集中审查。
- [x] 1.5 文档 owner：同步候选 README、协议与兼容清单，限定共同操作 README/model 的候选边界，不改变生产 TS 契约；建立替代旧文件保障决策的真实后继并同步索引。
- [x] 1.6 按目标行为重新设计及调整测试，覆盖正常、冲突、部分执行与未知结果以及 Git 未选暂存；删除仅证明退场机制的测试，更新必要 Case。

## Verification

- [x] 2.1 各阶段独立 correctness review，复核接口整合、领域身份、资源顺序、JSON 及 Git 未选暂存；问题修复后再声明对应任务完成。
- [x] 2.2 Linux 运行全部适用 Rust 测试和私有离线交付；运行 Windows x64 MSVC bins 的 cargo check 并以 mock/单元验证 manifest/.exe 接线；不新增 Windows CI、native 运行或下载 SDK，记录其不构成 Windows 原生资格证明。
- [x] 2.3 最终独立执行 AI-ready 文档、编码规范与 Test Design 审阅及必要优化；在最终代码稳定后独立重采 Case 和实体 source，确保账本与证据一致。
- [x] 2.4 运行 quick、`record-rust` 与 `repository-code` 对应门禁及最终 full Gate；不弱化质量政策或阈值。记录命令、结果和未验证边界；性能重测不是门槛。
- [x] 2.5 核对交付范围、长期 owner、决策演进和所有验收证据；保留无关工作，不执行生产切换、真实用户操作或未经授权的发布。

### 验收证据

- 主要实现由 6.1 terra 分担；两阶段独立正确性审查闭环。Git 路径前缀冲突会隐式驱逐未选暂存项的问题已修复并记录为[独立调查](../../docs/investigations/261107-git-index-update-prefix-collisions.md)；IR 计划资源移动字段已与实际结果分开。复核者独立执行相关 Git 6 项及计划 DTO 1 项，均通过。
- 最终编码规范、AI-Ready Docs 和 Test Design 优化完成，未降低阈值或新增豁免。最终公开 `record-rust` 与 `repository-code` 范围门禁为 16 通过、0 失败；随后 `bun run check -- --scope full` 为 70 通过、0 失败、3 项发布检查不适用，invocation 为 `20261107T082211420Z-c23c2514-6816-4298-b6f9-10c5b3cf5a38`。
- Linux Cargo 原生测试共 235 个节点通过：library 116、integration 119。最终实体快照共 2072 个；Case 目录、索引、完整引用和覆盖检查通过，独立计算的来源 revision 在采集前后一致，为 `3322c9c3464b0795bcd1c6baedab7b54943c7b08d69b591326a49be60c014b83`。退役 9 个纯旧证明 Case，新增 7 个按保留意图组织的 Case；实体枚举与执行证据分别核对。
- 最终 `cargo +1.98.1 check --manifest-path tools/record-cli/Cargo.toml --locked --offline --bins --target x86_64-pc-windows-msvc` 通过；Windows manifest/.exe 接线由单元模拟检查，未构建或运行 Windows 原生程序，也未增加 Windows CI。
- `node tools/record-cli/delivery/verify-real.ts --build record-runtime-sequential-20261107` 在私有 Linux fixture 完成 A/B 真实构建、安装运行、故障回退、无关文件保留及升级；A/B 源码摘要分别为 `9b424fbb316d28c5433eef4424991ca4efbd31f94f1b5ef7863827e381843890` 与 `77fc9808ed9a852bfb381e7813e737374bc209ffeb9bf26bb0c9b267d3c6c6e8`，不代表发布或真实用户安装。
- 长期记录：[顺序本地运行时决策](../../docs/decisions/261107-rust-record-candidate-sequential-local-runtime.md)已对齐；423 条决策、96 份调查及其索引检查通过。生产 TypeScript、skill 分发与 updater 未切换；历史性能样本未改写，本轮未重新采集性能数据。
