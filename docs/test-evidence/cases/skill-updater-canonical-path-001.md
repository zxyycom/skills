### Case SKILL-UPDATER-CANONICAL-PATH-001: Updater 拒绝非规范包路径别名

Tests:
- `test:384b917b7fb93a436532f1d38be2d9a4031ede5495c73a6a876a73036956d703`

Tags:
- `skill-updater`

Contract:
- Release zip 中的 skill 文件必须位于规范且无别名的包路径。

Proves:
- 源码 resolveRemoteSkillPackage 在返回可安装解包结果前拒绝 alias/非规范包路径，不把它称为真实 CLI 文件零写。
