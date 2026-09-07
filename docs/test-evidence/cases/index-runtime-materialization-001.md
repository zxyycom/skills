### Case INDEX-RUNTIME-MATERIALIZATION-001: 源顺序不影响索引序列化

Tests:
- `test:db183c4c60e4b7f6fe3149050534d84314273ae753fdc7713e66ca6c06732f8a`

Tags:
- `index-runtime`

Contract:
- 相同 ID-keyed 状态与来源 revision 集合必须物化为字节稳定且不含生成时间的索引。

Proves:
- 反转领域来源顺序、进而改变 record 插入顺序后，序列化结果仍不变并保留规范末尾换行。
