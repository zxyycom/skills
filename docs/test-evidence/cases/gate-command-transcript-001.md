### Case GATE-COMMAND-TRANSCRIPT-001: 命令 Check 保存完整 transcript 并限制终端摘要

Tests:
- `test:0b4fa632af0b475006cfe6822c46842c39a4cb312fe1bfe6befae595b9e99957`

Tags:
- `repository-tooling`

Contract:
- 获得 Check artifact directory 的命令 runner 必须把完整 stdout、stderr 和终态写入专属 `process.log`，返回结果只保留有界诊断尾部并提供 invocation 相对 transcript 引用。

Proves:
- 超过 4000 字符的 stdout 在返回摘要中截短而完整保存在 transcript，stderr 与零退出终态也写入同一文件，结果引用稳定指向 `checks/<encoded-check-id>/process.log`；同名 transcript 已存在时命令不启动并结算为 unavailable。
