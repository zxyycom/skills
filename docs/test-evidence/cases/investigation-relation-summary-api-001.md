### Case INVESTIGATION-RELATION-SUMMARY-API-001: candidate API normalizes optional relation summaries and rejects invalid values

Tests:
- `test:072e89bc7bd138c72551b95e677bb41fc9c00f42d8a237e4aa4776d36dc81c43`

Tags:
- `investigation-report`

Contract:
- 程序化 candidate API 直接接收 `{ type, target, summary? }`；summary trim 后为空则省略，保留值必须为单行且最多 40 个 Unicode 码点。

Proves:
- 候选准备返回 trim 后的 40 个非 BMP Unicode 码点，真实 serializer 在 Markdown 字符串中完整保留它们，证明长度不是按 UTF-16 code unit 计算。
- 纯空白从候选对象及序列化 Markdown 中省略；物理换行和 41 个码点由准备函数拒绝。
