### Case SKILL-UPDATER-CURRENT-CHECK-001: 当前安装版本被识别为无需更新

Tests:
- `test:91b40f495b9946b7b1159029deae0e81dfd3a9b113b788e810bce2e8e690df99`

Tags:
- `skill-updater`

Contract:
- Check 模式按版本判断当前安装，不因本地正文定制误报过期。

Proves:
- 本地版本与 manifest 一致时报告 current 且不写入文件。
