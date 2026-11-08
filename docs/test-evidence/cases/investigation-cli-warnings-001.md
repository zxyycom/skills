### Case INVESTIGATION-CLI-WARNINGS-001: show 缺少 selector 时拒绝

Tests:
- `test:d330ff4c896bee34d730f18f090082dab989def46ddba030792d4310b042563b`

Tags:
- `investigation-report`

Contract:
- show 要求一个明确 selector。

Proves:
- 真实 IR CLI 省略 show selector 返回 invalid-arguments，且未创建集合。
