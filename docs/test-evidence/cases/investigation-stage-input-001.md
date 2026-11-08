### Case INVESTIGATION-STAGE-INPUT-001: stage 拒绝重复 selector

Tests:
- `test:d330ff4c896bee34d730f18f090082dab989def46ddba030792d4310b042563b`

Tags:
- `investigation-report`

Contract:
- stage 不接受重复 selector。

Proves:
- 真实 IR CLI 以相同 selector 重复请求时返回 invalid-arguments，未创建集合。
