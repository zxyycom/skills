### Case TEST-EVIDENCE-INDEX-HARDLINK-001: Case 硬链接身份冲突被拒绝

Tests:
- `test:eaf9c37bfd8a52a047c6681b37b9817c66705bf13bfeb3e7d1a335dd02ee2ea9`

Tags:
- `test-evidence`

Contract:
- 不同 Case 路径不得引用同一个普通文件身份。

Proves:
- 为已有 Case 创建硬链接后，完整校验报告 case.identity-conflict。
