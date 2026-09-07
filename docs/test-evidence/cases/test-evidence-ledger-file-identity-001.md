### Case TEST-EVIDENCE-LEDGER-FILE-IDENTITY-001: Case 不得共享文件身份

Tests:
- `test:eaf9c37bfd8a52a047c6681b37b9817c66705bf13bfeb3e7d1a335dd02ee2ea9`

Tags:
- `test-evidence`

Contract:
- 不同 Case 路径不得指向同一个普通文件身份。

Proves:
- 为已有 Case 创建硬链接后，完整校验报告 `case.identity-conflict`。
