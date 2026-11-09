### Case NATIVE-OVERLAY-LINK-001: 拒绝原生目标链接祖先

Tests:
- `test:dffc3e5357ce667c897114cd3d09e4167824293925f893e20f23fd0a6c979711`

Tags:
- `repository-tooling`

Contract:
- 已有目标祖先必须是普通目录，不得跟随链接创建文件。

Proves:
- 非 Windows 临时链接祖先在规划和应用前拒绝，外部目录为空；不证明 Windows junction 行为。
