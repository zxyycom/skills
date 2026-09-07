### Case TEST-EVIDENCE-CORE-DUPLICATE-001: Case 校验拒绝身份与布局冲突

Tests:
- `test:0b8076abda39c105b27bb3d4bb24b688cb8db4149cebe9b5d56423f684d2edc2`

Tags:
- `test-evidence`

Contract:
- Case ID 在完整 Case 集合中必须唯一，根和 cases 目录只允许受支持的 UTF-8 Case 成员。

Proves:
- 复制相同 ID 的 Case 源产生 case.id-duplicate 诊断；不支持成员、非 UTF-8 Case 文件和额外根成员分别产生可定位诊断。
