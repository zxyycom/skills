### Case SKILL-UPDATER-MANIFEST-PAYLOAD-001: Updater 报告无效 manifest

Tests:
- `test:0583bb427e63fa60c9326cb02fe72e20f8173a656f2dc3666c9f26f660168278`

Tags:
- `skill-updater`

Contract:
- Release manifest 必须在读取 skill 版本前通过 schema 验证。

Proves:
- 缺少 schemaVersion 的 manifest 产生明确结构诊断。
