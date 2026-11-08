### Case INVESTIGATION-CLI-SINGLE-OPTIONS-001: 重复单值 CLI 选项不创建集合文件

Tests:
- `test:d330ff4c896bee34d730f18f090082dab989def46ddba030792d4310b042563b`

Tags:
- `investigation-report`

Contract:
- 单值 CLI 选项不得重复覆盖。

Proves:
- 真实 IR new 的重复 title 返回 invalid-arguments，未创建集合。
