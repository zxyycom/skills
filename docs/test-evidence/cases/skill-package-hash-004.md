### Case SKILL-PACKAGE-HASH-004: 接受初始版本为一的新 skill

Tests:
- `test:408caf2ef4e7e8c45c7b542f63b7219fa751fbabe3924d198c972898099bc9fd`

Tags:
- `repository-tooling`

Contract:
- 基线不存在的新增 skill 以 `null` 表示，并允许从版本一开始。

Proves:
- 注入的基线仓储中不存在 gamma 时其基线为 `null`，当前 snapshot 以 v1 加入不会产生版本问题。
