### Case INVESTIGATION-CLI-CUSTOM-RELATIVE-DIRECTORY-001: 跨工作区使用工作区内相对调查目录

Tests:
- `test:1be2551068f1dbd2f5f6f17176cd1d5aa098007c969e0a9a208a3ec7b937b00d`

Tags:
- `investigation-report`

Contract:
- 调查命令可通过工作区 root 与相对 investigations-dir 定位非默认集合。

Proves:
- 真实 CLI rename preflight 指定私有 root 与相对 investigations 目录成功，结果包含预期资源迁移计划。
