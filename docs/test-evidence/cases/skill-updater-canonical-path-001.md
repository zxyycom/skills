### Case SKILL-UPDATER-CANONICAL-PATH-001: Updater 拒绝非规范包路径别名

Tests:
- `test:fd09e9c0d5af946bd76072598991e9e97e108e2db2b9be989c30bdc8dd0f8270`

Tags:
- `skill-updater`

Contract:
- Release zip 中的 skill 文件必须位于规范且无别名的包路径。

Proves:
- 路径别名和非规范路径在解包写入前被拒绝。
