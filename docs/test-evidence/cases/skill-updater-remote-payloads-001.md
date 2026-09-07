### Case SKILL-UPDATER-REMOTE-PAYLOADS-001: Updater 报告无效 release

Tests:
- `test:2e8e3575a722865117badcaef3dfe2a5fc2330b16daefe5e9bd5733b7b2e6ab7`

Tags:
- `skill-updater`

Contract:
- GitHub release 响应必须在读取资产前通过结构验证。

Proves:
- 缺少 assets 的 release 产生明确远端 payload 诊断。
