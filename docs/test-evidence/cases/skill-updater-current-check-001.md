### Case SKILL-UPDATER-CURRENT-CHECK-001: 当前安装版本被识别为无需更新

Tests:
- `test:afaae01f8146b50f26080ac338820ceb3fb3fd369d4949957ff1dc107f394064`

Tags:
- `skill-updater`

Contract:
- Check 模式按版本判断当前安装，不因本地正文定制误报过期。

Proves:
- 本地版本与 manifest 一致时报告 current 且不写入文件。
