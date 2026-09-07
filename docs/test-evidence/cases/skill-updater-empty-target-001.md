### Case SKILL-UPDATER-EMPTY-TARGET-001: Updater 可安装到空目录

Tests:
- `test:6b75b990dc41b611ba02bc5e28d21ab4251ca5f12be5ce526e3d837018a2f881`

Tags:
- `skill-updater`

Contract:
- 显式存在的空目录应被视为合法首次安装目标。

Proves:
- 空目录按 unversioned 状态安装完整远端 skill 包。
