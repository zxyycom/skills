### Case SKILL-UPDATER-LOCAL-OWNER-001: Updater 拒绝其他 skill 拥有的目录

Tests:
- `test:e669da5d2933c6d5e14ab4e19c7808c7d6cddb55d998f3d4a22824d4b0333cb7`

Tags:
- `skill-updater`

Contract:
- 目标目录中的 `SKILL.md` owner 必须与 updater 目标 skill 一致。

Proves:
- 其他 skill 的目录在远端获取和写入前被拒绝。
