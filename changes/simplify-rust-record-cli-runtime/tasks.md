# Tasks

按边界核对、并行实现、集成验证的顺序推进；勾选须有对应完成证据。

## Readiness

- [x] 0.1 核对目标、既有改动、领域和事务入口、当前接口及各 owner 写入边界，确认用户已批准的目标与非目标；冻结计划后协调实现。
- [x] 0.2 阅读适用的测试设计、测试证据、编码规范、决策和门禁契约，确认最小平台与私有 fixture 验收路径；不把旧测试当作保留旧机制的依据。

## Implementation

- [ ] 1.1 source/transaction owner：用跨平台成熟库收敛文件访问和原子写，删除已取消的锁、身份、权限、多阶段证明、备份和回滚机制；保留工作区范围、独占新建和准确部分/未知事实。
- [ ] 1.2 domain owner：调整 DR/IR 操作到单次准备和必要领域校验，保留 IR 发布身份与成员事实；资源冲突预检后目录 rename，顺序更新引用和索引，按实际结果处理部分失败。
- [ ] 1.3 Git/delivery owner：以 `hash-object` 和一次 `update-index --index-info` 实现所选记录同 JSON 合成，保留未选暂存，由 Git 管锁；删除自持锁、备用 index 和 HEAD/pending CAS；接线 Linux 私有离线交付和 Windows bins、manifest/.exe；Windows 仅做目标编译及接线 mock/单元验证，不新增 Windows CI、native 运行或下载 SDK。
- [ ] 1.4 集成候选 envelope version 2：删除不再产生事实的 verification、outcome 恢复状态、recoveryBackups、recoveryDirectories、cleanupErrors，不保留兼容壳；保留业务信息粒度及 status、changed、committed、writtenPaths、unknownPaths、errors 和可区分的失败步骤/路径，成功 trace 特殊形状不变。计划 review 和实际结果各有依据，不伪造 postverify review；其他形状变化先交主线程集中审查。
- [ ] 1.5 文档 owner：同步候选 README、协议与兼容清单，限定共同操作 README/model 的候选边界，不改变生产 TS 契约；建立替代旧文件保障决策的真实后继并同步索引。
- [ ] 1.6 按目标行为重新设计及调整测试，覆盖正常、冲突、部分执行与未知结果以及 Git 未选暂存；删除仅证明退场机制的测试，更新必要 Case。

## Verification

- [ ] 2.1 各阶段独立 correctness review，复核接口整合、领域身份、资源顺序、JSON 及 Git 未选暂存；问题修复后再声明对应任务完成。
- [ ] 2.2 Linux 运行全部适用 Rust 测试和私有离线交付；运行 Windows x64 MSVC bins 的 cargo check 并以 mock/单元验证 manifest/.exe 接线；不新增 Windows CI、native 运行或下载 SDK，记录其不构成 Windows 原生资格证明。
- [ ] 2.3 最终独立执行 AI-ready 文档、编码规范与 Test Design 审阅及必要优化；在最终代码稳定后独立重采 Case 和实体 source，确保账本与证据一致。
- [ ] 2.4 运行 quick、`record-rust` 与 `repository-code` 对应门禁及最终 full Gate；不弱化质量政策或阈值。记录命令、结果和未验证边界；性能重测不是门槛。
- [ ] 2.5 核对交付范围、长期 owner、决策演进和所有验收证据；保留无关工作，不执行生产切换、真实用户操作或未经授权的发布。
