# Proposal

简化两域 Rust 记录 CLI 候选的文件与事务层，并同步其契约和验证。

## Why

现有候选为每阶段维护强身份、父链和恢复证明，但不能提供非合作进程的跨文件原子隔离。围绕真实工作区风险收敛证明和写入流程，可降低维护复杂度，同时保护领域事实和用户数据。

## Outcome

两域候选以局部冲突检查、原子文件替换及可核对的资源复制完成记录操作；失败结果准确区分已完成、未知和恢复线索，领域、路径、权限及 Git pending 保障保持明确。

## Scope

### Intended Change

调整 `tools/record-cli` 的 source、transaction 和必要 mutation、stage、输出适配；保留领域校验、查询、索引 schema 和 Git 发布主体。以设计中的操作矩阵为实现边界，同步候选协议、相关 owner、测试及证据。

### Resulting Impacts

- 共同模型涉及生产 TypeScript 与候选：更新时区分两者，不把新候选保障写成生产行为。相关两域 CLI、恢复和 stage 参考只在实际受影响处同步。
- 候选 JSON 优先保持现有字段和信息，内部证明可随消费者精简；若发现确需破坏机器契约，先评审版本和迁移，不静默改变。
- 实施时调整相关测试与 Case，历史调查保留形成时版本边界，并评估长期决策记录门槛。

## Success Criteria

- 普通更新不原位截断；受管路径、领域正确性、不可重建事实、实际错误及恢复线索符合设计，且无必要外重复证明或无消费者类型。
- 正常与故障矩阵、两个实际 CLI、离线交付、测试和 Case 通过对应验收；同 fixture 记录普通更新与资源迁移的改前改后 I/O 代价。
- 完成编码规范、AI-Ready Docs 与 Test Design 审核，按实际影响通过公共 quick、`record-rust`、对应代码 scope 及必要的全工作区门禁。

## Affected Owners

候选实现及协议：`tools/record-cli/`；共同操作与生产边界：`tools/record-operations/model.md`、`tools/record-operations/README.md`；领域行为：两域 CLI、恢复、stage 与索引 owner；质量与证据：`docs/coding-style.md`、`docs/test-maintenance.md` 和 Test Design/Test Evidence Review。
