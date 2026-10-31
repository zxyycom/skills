### Case INVESTIGATION-STAGE-CONFLICT-001: stage --scope index preserves strict current index definition requirements

Tests:
- `test:920652e0dd25e2ad5b37232615f38c44c97842bc09e056b81c714e9d50dece25`

Tags:
- `investigation-report`

Contract:
- 选择性暂存要求当前 index 定义完整合法。

Proves:
- 对当前索引定义运行纯 parser，旧 definitionVersion 被明确拒绝并返回 state-index.definition-version-mismatch。
