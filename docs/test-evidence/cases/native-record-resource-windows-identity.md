### Case NATIVE-RECORD-RESOURCE-WINDOWS-IDENTITY-001: Windows 目录身份缺失回退

Tests:
- `test:e2569f4d1676b1c8a383ef2c37a366204ded46ff3817025b4241d04ffff3cec6`

Tags:
- `record-rust`

Contract:
- 目录复用身份需要同时具备卷号与文件号；任一缺失不能形成复用身份。

Proves:
- 纯逻辑输入覆盖两字段各自缺失和共同存在，不证明 Windows 原生文件系统操作。
