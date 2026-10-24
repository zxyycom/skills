### Case DECISION-NATIVE-BUILD-ISOLATION-001: 构建归一化并隔离来源快照

Tests:
- `test:be28d1b5c7161519765d0a47676b26954fece2db9c880424fb3af9398d1bdc30`

Tags:
- `decision-records`

Contract:
- 构建的 Decision 索引使用归一化领域 state，并与调用方可变来源隔离；entries、嵌套 state 和来源 revision 成员保持冻结快照。

Proves:
- 关系摘要去除首尾空白，目标记录的完整 state 和来源 revision 符合输入语义。
- 后续修改原始标题、tags、关系摘要与来源 revision，不改变构建索引或完整序列化字节。
- 原始 state 保持可变；输出 entries、state、tags、关系对象及 sourceRevision.entries 实际冻结。
