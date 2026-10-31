### Case INDEX-RUNTIME-ENVELOPE-ERRORS-001: 严格 envelope 在领域 callback 前保持错误边界

Tests:
- `test:343c491e2bedc550fd2137b831a8de15f0048b846b664bd1dd0aa038d9c2479d`

Tags:
- `index-runtime`

Contract:
- 原始索引须先通过 JSON、严格 schema、版本、命名空间、ID/revision 成员和有限 JSON 数值校验；无效 envelope 不进入领域 callback。

Proves:
- 十三个非法输入检查 error/null、稳定 code/path 和必要字段路径，包含原始 1e999 在 metadata/state 内的溢出；metadata/state/validator 回调均未运行。
