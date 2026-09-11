### Case TEST-EVIDENCE-LEDGER-FILE-IDENTITY-001: Case 不得共享文件身份

Tests:
- `test:a42bd9f5ae2086a565eec8f0146d8b6078d98df48da6cfc3875b4d742d9cc18d`

Tags:
- `test-evidence`

Contract:
- 不同 Case 路径不得指向同一个普通文件身份。

Proves:
- 为已有 Case 创建硬链接后，完整校验报告 `case.identity-conflict`。
