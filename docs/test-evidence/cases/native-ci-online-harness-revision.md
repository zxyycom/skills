### Case NATIVE-CI-ONLINE-HARNESS-REVISION-001: 线上验收程序与发布身份

Tests:
- `test:0f13c59de2fdecd006d62dbad9f8aafcb69932002dbdccb1d6c156a9fa45cefc`

Tags:
- `repository-tooling`

Contract:
- 线上验收使用并核对本次 package 测试的程序 revision，同时独立验证用户指定的 release revision。

Proves:
- 读取实际 workflow，检查 checkout、revision 校验及验收的先后顺序和两种 revision 的来源；不证明实际 GitHub Actions 已运行。
