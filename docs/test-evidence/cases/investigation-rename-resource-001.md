### Case INVESTIGATION-RENAME-RESOURCE-001: 不安全 owner tree 阻断 rename

Tests:
- `test:6fba71310b1414d72c10e05385cf0ab1daac0754a4abefda2bdca99207688b64`

Tags:
- `investigation-report`

Contract:
- rename 不得移动不安全的 owner 树。

Proves:
- 候选 owner 树含符号链接或非法名称时 rename 失败，候选与原资源保留，目标候选不存在。
