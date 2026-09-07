### Case GATE-DUPLICATE-DETECTION-001: 重复检测阻断 finding 并对 unavailable fail closed

Tests:
- `test:acfa4fe4f33f3d74096fbc1758f45a7172a3fb53c92d4b8857c72624a11ee0e8`

Tags:
- `repository-tooling`

Contract:
- 重复检测的可信 finding 必须阻断 aggregate；输入或 scanner 不可用也不能被解释为成功。

Proves:
- 无重复 fixture passed，加入真实重复片段后 Check failed。
- 不存在的项目根使 Check unavailable，并由 aggregate fail closed。
