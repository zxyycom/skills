### Case INVESTIGATION-STAGE-SCOPE-CLI-001: stage 拒绝无效或重复 scope

Tests:
- `test:d330ff4c896bee34d730f18f090082dab989def46ddba030792d4310b042563b`

Tags:
- `investigation-report`

Contract:
- stage scope 必须是合法单值。

Proves:
- 真实 IR CLI 对未知 scope 和重复 scope 均返回 invalid-arguments，未创建集合。
