### Case INVESTIGATION-RELATION-SUMMARY-API-001: candidate API normalizes optional relation summaries and rejects invalid values

Tests:
- `test:044b635c739c034a3daab619b793d948d9869d4e80fc1278a09d11c7cf697303`

Tags:
- `investigation-report`

Contract:
- 程序化 candidate API 直接接收 `{ type, target, summary? }`；summary trim 后为空则省略，保留值必须为单行且最多 40 个 Unicode 码点。

Proves:
- 40 个非 BMP Unicode 码点在 trim 后逐字持久化，证明长度不是按 UTF-16 code unit 计算。
- 纯空白不形成持久字段；物理换行和 41 个码点在写入前拒绝且不创建 candidate。
