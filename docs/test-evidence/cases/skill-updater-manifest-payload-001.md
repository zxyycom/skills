### Case SKILL-UPDATER-MANIFEST-PAYLOAD-001: Updater 报告无效 manifest

Tests:
- `test:a69e6eec8f117be374a740c0ae9d022b48106d99de9dc9e4322ddaf87a7656b8`

Tags:
- `skill-updater`

Contract:
- Release manifest 必须在读取 skill 版本前通过 schema 验证。

Proves:
- 缺少 schemaVersion 的 manifest 产生明确结构诊断。
