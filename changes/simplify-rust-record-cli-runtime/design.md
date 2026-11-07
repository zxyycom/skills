# Design

采用合作型单用户顺序模型，把跨文件事务简化为有序文件操作和精确结果报告。

## Context

候选入口见 [README](../../tools/record-cli/README.md)，当前机器字段及事务见 [protocol](../../tools/record-cli/protocol.md)、[compatibility](../../tools/record-cli/compatibility.md)；共同生产模型见 [record-operations](../../tools/record-operations/model.md)。现行 [合作型文件保障决策](../../docs/decisions/261107-rust-record-candidate-cooperative-file-safety.md) 含本轮将替代的保障，而不是新方案验收依据。用户已确认目标及风险取舍；旧协议和测试不能自行证明旧机制必须保留。

## Goals / Non-Goals

目标是在两域候选中大量删除特殊机制，使用成熟跨平台库处理单文件原子写，保留领域正确性和真实结果；Linux x64 GNU 实际构建交付，Windows x64 MSVC 验证目标编译与接线。非目标：生产切换、发布、真实用户目录操作、SDK、batch、性能实验或 Windows 专用安全层。历史性能报告原始数字和 source hash 不变；本轮不以性能重测为门槛。

## Decisions

### Intended Change

- 单操作者、顺序操作为适用前提；不承诺对非合作进程的跨文件原子隔离。取消主动 readonly 策略、权限漂移及 exact mode 证明、根父链/inode 跨阶段身份、多阶段 fresh 和全范围 readback、自定义 casefold/hardlink/链接竞争策略、CLI 集合锁及残锁协议、普遍磁盘备份、自动条件 rollback 与完整恢复证明、额外强制 `sync_all` 和 owned-temp 清理协议。
- 保留基本工作区路径范围、正常 `create_new` 不覆盖、成熟库单文件原子写以及每次必要领域校验；IR 发布身份和成员等不能从正文猜测的业务事实仍要保护。资源普通冲突预检后以目录 rename，按顺序更新引用与索引；允许失败后部分完成，不声称事务回滚。
- Git 对所选记录合成同一 JSON 中的内容并保留未选暂存；用 `hash-object` 和一次 `update-index --index-info`，由 Git 管理锁；取消 CLI 手持 real lock、alternate index 和 HEAD/pending CAS。普通预检只展示计划、不保存执行 token；正式调用读取并准备一次。
- 候选 envelope 升至 `version: 2`；成功 trace 的特殊形状不变。移除不再产生事实的 `verification`、`outcome` 恢复状态、`recoveryBackups`、`recoveryDirectories`、`cleanupErrors`，不保留恒空或 NotRun 兼容壳。保留业务 result 信息粒度及 `status`、`changed`、`committed`、`writtenPaths`、`unknownPaths`、`errors`，通过适用诊断的 `operation` 等区分失败步骤和路径，不另造状态机。计划 review 与实际结果分别有据，不伪造 postverify relationReview、`rolled-back` 或验收通过。其他字段形状变化仍交主线程集中审查。

### Resulting Impacts

- source/transaction、领域与 Git/delivery 三个有界 owner 协调接口，消除旧安全证明及其专用测试；各自保留基础领域与错误边界。涉及业务语义的成功、冲突、实际部分写入与未知情况需独立设计测试。
- 更新候选 README、协议、兼容清单与共同模型中候选边界；生产 TypeScript 的保障不降级。长期决策建立真实后继演进，替代旧候选文件保障决策并同步索引。
- 离线交付只使用私有 fixture；Windows 本轮上限为 x64 MSVC bins 的 `cargo check` 及 manifest/.exe 接线的 mock/单元验证；不新增 Windows CI、native 运行或下载 SDK，不要求生成 native exe。Case 与实体独立 source 在最终代码稳定后重采。

## Risks / Trade-offs

无跨文件原子性、自动备份或完整恢复，失败可留下部分状态，使用者须依据实际结果检查和对账；单文件原子替换也不是跨进程 CAS。Git 由自身锁保护一次更新，但不承诺过去的 HEAD/pending CAS。平台编译不等同原生运行验证，不能外推未测平台或生产能力。

## Open Questions

无阻断问题。Windows 目标编译和接线不构成原生运行或平台资格证明。
