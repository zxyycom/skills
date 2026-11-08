### Case NATIVE-ARCHIVE-SAFETY-001: 原生归档解包前拒绝不安全成员

Tests:
- `test:e22b46b9b438aa0d48de3d6a41e8c630920dd4656ce888e6095b3bd05c037422`

Tags:
- `repository-tooling`

Contract:
- 原生资产在解压前限制大小并验证成员路径、平台别名、文件类型及 ZIP 两份目录信息的一致性。

Proves:
- 合法 UTF-8 归档可读取；穿越、大小写冲突、文件目录冲突和符号链接条目被拒绝。
- 本地与中央文件名不一致或解压尺寸超过上限时失败，不返回解压结果。
- DEFLATE 实际展开 1 MiB 而本地与中央目录同时谎报 1 字节时，流式实际计数拒绝而非静默截断。
