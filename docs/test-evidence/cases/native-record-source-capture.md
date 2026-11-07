### Case NATIVE-RECORD-SOURCE-CAPTURE-001: 安全捕获选定源与受限文件系统操作

Tests:
- `test:89813b9e1cb9ba0fd40ff077be8d960381971415abca1f131be7acc2cea5ecd7`
- `test:ffb7164120fa784f1adfa243e552457feac2a5261409ac1bea96e3e16ff30147`

Tags:
- `record-rust`

Contract:
- 来源读取须限制工作区相对路径及读取预算，并区分目录成员。

Proves:
- 私有文件验证父路径拒绝、文件大小限制和目录树成员；不证明资源正文未被读取。
