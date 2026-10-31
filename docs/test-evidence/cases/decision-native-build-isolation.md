### Case DECISION-NATIVE-BUILD-ISOLATION-001: 构建归一化并隔离来源快照

Tests:
- `test:8f496b69cf15cbd1c43c3e30ea5004bac186558aaf729b8a6c0012aae982c7b3`

Tags:
- `decision-records`

Contract:
- 构建的 Decision 索引使用归一化领域 state，并与调用方可变来源隔离；entries、嵌套 state 和来源 revision 成员保持冻结快照。

Proves:
- 关系摘要去除首尾空白，目标记录的完整 state 和来源 revision 符合输入语义。
- 后续修改原始标题、tags、关系摘要与来源 revision，不改变构建索引或完整序列化字节。
- 原始 state 保持可变；输出 entries、state、tags、关系对象及 sourceRevision.entries 实际冻结。
