### Case INVESTIGATION-RENAME-LEGACY-PATH-001: legacy ID 迁移可保留既有 sourcePath

Tests:
- `test:b8e12910f551649e3b2aea661470f8810fc5069b7bd2d8694c8cb827103e8e61`

Tags:
- `investigation-report`

Contract:
- legacy Investigation 以同名 target 迁移为 dated ID 时，即使 name/sourcePath 保持不变，也必须更新 ID、关系、owner 和正式索引；不得把同路径误判为旧身份残留。

Proves:
- report 仍位于原 sourcePath，但 frontmatter、dependent relation 和索引全部使用新 dated ID。
- 旧 owner 消失，新 ID owner 存在。
