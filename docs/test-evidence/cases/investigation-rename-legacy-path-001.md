### Case INVESTIGATION-RENAME-LEGACY-PATH-001: legacy ID 迁移可保留既有 sourcePath

Tests:
- `test:7e9b533ecfb532a377b8192d5a9bfd1dc4a643af996ea42c49daa1dae53bd95b`

Tags:
- `investigation-report`

Contract:
- legacy Investigation 以同名 target 迁移为 dated ID 时，即使 name/sourcePath 保持不变，也必须更新 ID、关系、owner 和正式索引；不得把同路径误判为旧身份残留。

Proves:
- report 仍位于原 sourcePath，但 frontmatter、dependent relation 和索引全部使用新 dated ID。
- 旧 owner 消失，新 ID owner 存在。
