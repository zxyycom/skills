### Case TEST-EVIDENCE-CROSS-TOPIC-ID-001: Case ID 在全集合中唯一

Tests:
- `test:0b8076abda39c105b27bb3d4bb24b688cb8db4149cebe9b5d56423f684d2edc2`

Tags:
- `test-evidence`

Contract:
- 完整 Case 集合必须唯一解析每个 Case ID；重复身份不得覆盖已有来源。

Proves:
- 复制相同 ID 的 Case 源产生 case.id-duplicate 诊断。
