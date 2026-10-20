### Case SKILL-UPDATER-CANONICAL-PATH-001: Updater 拒绝非规范包路径别名

Tests:
- `test:384b917b7fb93a436532f1d38be2d9a4031ede5495c73a6a876a73036956d703`

Tags:
- `skill-updater`

Contract:
- Release zip 中的 skill 文件必须位于规范且无别名的包路径。

Proves:
- 路径别名和非规范路径在解包写入前被拒绝。
