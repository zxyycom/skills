# Proposal

消除同次 pending 写入与索引序列化中已确认的重复工作。

## Why

现有 pending 操作对相同新字节逐路径启动 Git 写对象进程且并发无界；同阶段已规范化索引再次规范化后才序列化。历史调查见 `docs/investigations/261028-collection-single-item-cost-audit.md`。

## Outcome

相同新 payload 在单次操作只写一次并有界并发；安全可证明的内部索引直接序列化，外部输入和独立阶段的验证不变。

## Scope

### Intended Change

- 对同次待写 payload 按实际字节去重并限制对象写入并发；失败后停止派发并收束已启动任务。
- 同阶段消费 build/parse 已规范化冻结结果，避免重复规范化；公开序列化入口继续规范化与复制隔离；完整 schema 和领域校验仍由 build/parse 负责。

### Resulting Impacts

- 路径、mode、两种 Git 对象格式、CAS、未选保护、原子发布、锁清理与写后验收保持；记录失败与不可回滚对象写入边界。
- 测试真实 Git 消费链、工作量、并发及失败收束；验证排序、字节、诊断、复制隔离和阶段 fresh；同步受影响分发、版本和测试证据。
- query-fields、单长行、selected 全比较、文件安全检查合并、合法重划和复杂 trace 仅接收独立只读证据，不修改生产实现。

## Success Criteria

两项均在消费者路径验证语义与工作量，失败不会使对象写入跨越锁生命周期；范围内测试、账本、生成同步与门禁通过，说明未测平台。

## Affected Owners

`tools/shared/src/version-control/`、`tools/index-runtime/`、直接消费者及其分发；`tools/shared/version-control.md`、测试证据账本和项目门禁订阅。
