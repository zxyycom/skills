### Case INVESTIGATION-DISCARD-RESOURCE-SAFETY-001: discard rejects unsafe owner resource members without deleting the report

Tests:
- `test:6fba71310b1414d72c10e05385cf0ab1daac0754a4abefda2bdca99207688b64`

Tags:
- `investigation-report`

Contract:
- 删除前拒绝 owner 资源树中的符号链接。

Proves:
- 候选 owner 树含符号链接时 discard 失败，候选、链接和既有资源保留。
