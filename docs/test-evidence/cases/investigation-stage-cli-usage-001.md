### Case INVESTIGATION-STAGE-CLI-USAGE-001: stage 缺少 selector 时拒绝

Tests:
- `test:d330ff4c896bee34d730f18f090082dab989def46ddba030792d4310b042563b`

Tags:
- `investigation-report`

Contract:
- stage 要求至少一个 selector。

Proves:
- 真实 IR CLI 省略 stage selector 返回 invalid-arguments，未创建集合。
