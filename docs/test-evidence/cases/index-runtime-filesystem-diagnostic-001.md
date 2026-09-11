### Case INDEX-RUNTIME-FILESYSTEM-DIAGNOSTIC-001: 安全报告 source 与 storage 文件系统失败

Tests:
- `test:f53131ca9f98b0ac2895649581523085b7f9935311addb3417ec69289a143bcc`

Tags:
- `index-runtime`

Contract:
- source 和 storage 的文件系统失败必须使用稳定 message，并在 `filesystem` 中传递受控的原因类别、操作、目标和净化详情；不得把底层错误文本直接写入 message。

Proves:
- 注入的 `EACCES` source 错误映射为 `access-denied`，并在 build 与 sync 的结果中保留相同的结构化文件系统事实。
- 含凭据、绝对路径、换行和超长文本的 source 详情被净化和截断；storage 读取目录时的绝对路径详情也不泄露。
