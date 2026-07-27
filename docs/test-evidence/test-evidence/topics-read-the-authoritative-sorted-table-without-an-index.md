### Case TEST-EVIDENCE-TOPICS-READ-001: Topics 直接读取已排序的权威表
Entry:
- `tools/test-evidence/tests/run.ts > topics read the authoritative sorted table without an index`
- `bun test --test-name-pattern="^topics read the authoritative sorted table without an index$" ./tools/test-evidence/tests/run.ts`
Contract:
- Topic 查询必须直接读取权威受控表，不以派生索引存在为前提。
Proves:
- 查询按稳定顺序返回全部 topic，且不会为只读操作创建索引。
