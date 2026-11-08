### Case INVESTIGATION-DISCARD-RESOURCE-ID-001: discard rejects illegal owner resource IDs without deleting the report

Tests:
- `test:6fba71310b1414d72c10e05385cf0ab1daac0754a4abefda2bdca99207688b64`

Tags:
- `investigation-report`

Contract:
- 删除前拒绝不符合受管资源 ID 规则的 owner 文件路径。

Proves:
- 候选 owner 树含非法 % 路径时 discard 失败，候选和资源保留。
