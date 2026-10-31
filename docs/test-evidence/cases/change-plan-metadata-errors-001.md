### Case CHANGE-PLAN-METADATA-ERRORS-001: Metadata reader 映射稳定边界错误码

Tests:
- `test:02972a61f61e5e57e5066a0dd7f62d3058722d6a25d5d56cc992913201867d21`

Tags:
- `change-plan`

Contract:
- Metadata reader 把文件存在性、路径类型、JSON 解析和 strict schema 失败收口为稳定领域错误码。

Proves:
- 缺失文件得到 `missing`，目录占位得到 `invalid-path`，无效 JSON 得到 `invalid`。
- 未知 stage、`implementation`、`shelved` 与 null-base Plan 都由同一规范 reader 返回 `invalid`。
