### Case INVESTIGATION-STAGE-SCOPE-CLI-001: CLI stage exposes the scope contract and rejects an invalid scope

Tests:
- `test:0accbb5ff76a1166e3c41ade178d8b77a374dde26c2c4d5d9d75453c13441292`

Tags:
- `investigation-report`

Contract:
- CLI stage 公开 --scope，非法或重复的 scope 值按无效输入处理。

Proves:
- help 含 `--scope <scope>`；`--scope everything` 返回退出码 2；重复 `--scope` 以用法诊断拒绝。
