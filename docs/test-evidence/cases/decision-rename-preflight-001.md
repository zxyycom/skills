### Case DECISION-RENAME-PREFLIGHT-001: Rename preflight 不写所选正文或新路径

Tests:
- `test:6251dc1300265d603e7385cb11b54fd6b8a390125da3796c7feadbc30d032684`

Tags:
- `decision-records`

Contract:
- rename preflight 只预览写集，不修改所选正文或建立新路径。

Proves:
- 真实 CLI 预检报告计划索引变化与目标路径，原正文不变且目标不存在；随后真实 rename 成功。
