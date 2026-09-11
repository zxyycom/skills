### Case TEST-EVIDENCE-CROSS-TOPIC-ID-001: Case ID 在全集合中唯一

Tests:
- `test:ceb55166605c3185f153175276147fb2cacac4b9d0997f7687f91dbe56b8d6de`

Tags:
- `test-evidence`

Contract:
- 完整 Case 集合必须唯一解析每个 Case ID；重复身份不得覆盖已有来源。

Proves:
- 复制相同 ID 的 Case 源产生 case.id-duplicate 诊断。
