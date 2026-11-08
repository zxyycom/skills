### Case INVESTIGATION-CLI-UNKNOWN-INPUT-001: JSON 命令拒绝未知选项

Tests:
- `test:6e47f8cda3c29049a6d3c915454f4c20fe67bb4cc28b7a38cdd5d44d6ef55fe9`

Tags:
- `investigation-report`

Contract:
- 调查查询和写入命令在 JSON 模式下拒绝未知选项并返回用法错误。

Proves:
- 真实 investigation-report 的 list、new 遇未知选项均退出 2，stdout 是唯一 version 2 错误对象，code 为 invalid-arguments。
