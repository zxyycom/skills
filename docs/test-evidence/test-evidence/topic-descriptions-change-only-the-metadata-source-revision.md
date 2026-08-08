### Case TEST-EVIDENCE-REVISION-TOPIC-MOVE-001: Topic 描述只改变 Metadata Source Revision

Entry:
- `tools/test-evidence/tests/run.ts > topic descriptions change only the metadata source revision`
- `bun test --test-name-pattern="^topic descriptions change only the metadata source revision$" ./tools/test-evidence/tests/run.ts`

Contract:
- 结构化 source revision 必须把规范化 topic metadata 与逐 Case 来源分开指纹化。

Proves:
- 修改一个 topic 描述并重新同步后，metadata revision 改变，全部逐 Case entry revision 保持不变。
