### Case SKILL-UPDATER-MANIFEST-VERSION-001: Updater 拒绝 manifest 与包版本不一致

Tests:
- `test:4b116a5f64d2ab4ce17e25f289359605dcacfe5860c1d311275b4372840cab4f`

Tags:
- `skill-updater`

Contract:
- Release manifest 声明版本必须与远端 `SKILL.md` 版本一致。

Proves:
- 版本不一致在安装前被拒绝且目标未被替换。
