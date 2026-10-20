### Case SKILL-UPDATER-REMOTE-PAYLOADS-001: Updater 报告无效 release

Tests:
- `test:0d132a95a6a5072624679df6cb24dfdef0109a943003855f5345f0f8140d1562`

Tags:
- `skill-updater`

Contract:
- GitHub release 响应必须在读取资产前通过结构验证。

Proves:
- 缺少 assets 的 release 产生明确远端 payload 诊断。
