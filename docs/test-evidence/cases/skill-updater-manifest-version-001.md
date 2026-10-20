### Case SKILL-UPDATER-MANIFEST-VERSION-001: Updater 拒绝 manifest 与包版本不一致

Tests:
- `test:e4d45664f2ef58e80c786fb8819b56d67630d516a8b8b3a79257dedd6b7d7f01`

Tags:
- `skill-updater`

Contract:
- Release manifest 声明版本必须与远端 `SKILL.md` 版本一致。

Proves:
- 版本不一致在安装前被拒绝且目标未被替换。
