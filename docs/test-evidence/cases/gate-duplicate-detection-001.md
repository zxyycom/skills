### Case GATE-DUPLICATE-DETECTION-001: 重复检测阻断 finding 并对 unavailable fail closed

Tests:
- `test:d906623cfd396d948b4456bb0baf720b32edd1f89cf6a20afaa1f586aa87b654`

Tags:
- `repository-tooling`

Contract:
- 重复检测的可信 finding 必须阻断 aggregate；输入或 scanner 不可用也不能被解释为成功。

Proves:
- 无重复 fixture passed，加入真实重复片段后 Check failed。
- 不存在的项目根使 Check unavailable，并由 aggregate fail closed。
