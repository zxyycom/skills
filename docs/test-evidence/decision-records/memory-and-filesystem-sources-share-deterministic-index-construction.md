### Case DECISION-STATE-SOURCE-PARITY-001: 内存与文件系统来源共享确定性索引构造

Entry:
- `tools/decision-records/tests/state-snapshot.test.ts > memory and filesystem sources share deterministic index construction`
- `bun test --test-name-pattern="^memory and filesystem sources share deterministic index construction$" ./tools/decision-records/tests/state-snapshot.test.ts`

Contract:
- 相同领域目录与已建立决策来源必须通过同一快照、source revision 和索引物化语义产生确定性结果，不受来源介质或输入顺序影响。

Proves:
- 内存来源与文件系统来源构造出相同快照，且快照 revision 等于同一来源集合的规范 revision。
- 反转内存来源顺序后生成的完整索引与文件系统索引序列化结果相同。
