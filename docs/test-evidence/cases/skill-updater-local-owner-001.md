### Case SKILL-UPDATER-LOCAL-OWNER-001: Updater 拒绝其他 skill 拥有的目录

Tests:
- `test:fe0e287c0e398a425d998deff1fdcf4eb9959b01722b9aac2aa6bf2566153371`

Tags:
- `skill-updater`

Contract:
- 目标目录中的 `SKILL.md` owner 必须与 updater 目标 skill 一致。

Proves:
- 其他 skill 的目录在远端获取和写入前被拒绝。
