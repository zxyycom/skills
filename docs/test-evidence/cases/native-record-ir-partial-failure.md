### Case NATIVE-RECORD-IR-PARTIAL-FAILURE-001: 资源移动后的写入部分失败

Tests:
- `test:1c41042855ea1d97e66a4f67cc3bd95694c492f33fc494c21403def1bd326c1b`

Tags:
- `record-rust`

Contract:
- 资源移动后写入失败须如实报告已完成和未知路径。

Proves:
- 真实 CLI 在资源移动后触发文件写入失败，核对写集、未知目标、失败步骤、正文和索引。
