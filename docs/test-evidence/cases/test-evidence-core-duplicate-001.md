### Case TEST-EVIDENCE-CORE-DUPLICATE-001: Case 校验拒绝身份与布局冲突

Tests:
- `test:ceb55166605c3185f153175276147fb2cacac4b9d0997f7687f91dbe56b8d6de`

Tags:
- `test-evidence`

Contract:
- Case ID 在完整 Case 集合中必须唯一，根和 cases 目录只允许受支持的 UTF-8 Case 成员。

Proves:
- 复制相同 ID 的 Case 源产生 case.id-duplicate 诊断；不支持成员、非 UTF-8 Case 文件和额外根成员分别产生可定位诊断。
