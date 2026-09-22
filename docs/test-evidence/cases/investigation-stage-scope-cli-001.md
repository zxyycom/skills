### Case INVESTIGATION-STAGE-SCOPE-CLI-001: CLI stage exposes the scope contract and rejects an invalid scope

Tests:
- `test:3cd22fb651541beae981d49dc0c38d932e8347285fcc542b88abbdc457db4937`

Tags:
- `investigation-report`

Contract:
- CLI stage 公开 --scope，非法或重复的 scope 值按无效输入处理。

Proves:
- help 含 `--scope <scope>`；`--scope everything` 返回退出码 2；重复 `--scope` 以用法诊断拒绝。
