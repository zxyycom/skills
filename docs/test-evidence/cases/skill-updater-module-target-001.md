### Case SKILL-UPDATER-MODULE-TARGET-001: 外部导入不改变 updater 默认目标

Tests:
- `test:8c739be5df1c0d312d2f96aeb3a6ee78412d0c1c334ebdf6a60240f73b99c2ac`

Tags:
- `skill-updater`

Contract:
- 默认目标由公开 updater 自身 URL 锚定；导入者路径、工作目录和多层 runtime 位置不改变该目标。

Proves:
- 从 skill 外的 MJS importer 调用公开 runSkillUpdaterCli 且不传目标参数，真实 Node check 定位正确 skill、返回 current 并保留文件。
