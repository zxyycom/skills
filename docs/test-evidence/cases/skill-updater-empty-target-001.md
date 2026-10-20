### Case SKILL-UPDATER-EMPTY-TARGET-001: Updater 可安装到空目录

Tests:
- `test:8d336aad79d96dc2c4813e54f0c3f76ab1464a94d95312a662aee0d9812ca0be`

Tags:
- `skill-updater`

Contract:
- 显式存在的空目录应被视为合法首次安装目标。

Proves:
- 空目录按 unversioned 状态安装完整远端 skill 包。
