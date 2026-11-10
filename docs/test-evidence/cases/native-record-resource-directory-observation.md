### Case NATIVE-RECORD-RESOURCE-DIRECTORY-001: 资源目录观察与路径安全

Tests:
- `test:3849f1b16b4a6709887b501108597d7dbd0c4d7d6169c6ab252ffc8b71f4f0e7`
- `test:4cb1c6ad2104664ed575251399bcd3b37339446492802d95318ac6853d2deceb`

Tags:
- `record-rust`

Contract:
- 共享目录观察须保持资源路径大小写、成员类型及命名空间变化的校验。

Proves:
- 私有目录中 40 个资源共享两次目录枚举；Unix 中模拟目录版本未变时，新符号链接与折叠名相同的新精确成员仍被识别，并核对大小写及目录符号链接。
