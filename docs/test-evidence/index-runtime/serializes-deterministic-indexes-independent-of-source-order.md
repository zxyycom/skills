### Case INDEX-RUNTIME-MATERIALIZATION-001: 源顺序不影响索引序列化
Entry:
- `tools/index-runtime/tests/materialization.test.ts > serializes deterministic indexes independent of source order`
- `bun test --test-name-pattern="^serializes deterministic indexes independent of source order$" ./tools/index-runtime/tests/run.ts`
Contract:
- 相同 ID-keyed 状态与来源 revision 集合必须物化为字节稳定且不含生成时间的索引。
Proves:
- 反转领域来源顺序、进而改变 record 插入顺序后，序列化结果仍不变并保留规范末尾换行。
