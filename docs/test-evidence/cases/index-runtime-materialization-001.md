### Case INDEX-RUNTIME-MATERIALIZATION-001: 源顺序不影响索引序列化

Tests:
- `test:e128d64733b22d5e3b4aa46af41f8983963271367b08117fa6df0403161c0ba4`

Tags:
- `index-runtime`

Contract:
- 相同 ID-keyed 状态与来源 revision 集合必须物化为字节稳定且不含生成时间的索引。

Proves:
- 反转领域来源顺序、进而改变 record 插入顺序后，序列化结果仍不变并保留规范末尾换行。
