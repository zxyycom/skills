### Case GATE-JSON-SCHEMA-001: JSON Schema 校验阻断 finding 并对 unavailable fail closed

Tests:
- `test:d8d6a3edc4c26abca49e4762cd50e6d1e974cca33a59ee4268691d2518edb6ec`

Tags:
- `repository-tooling`

Contract:
- JSON Schema 违例必须阻断 aggregate；输入不可用也不能被解释为成功。

Proves:
- 符合 Schema 的 fixture passed，写入违例实例后 Check failed。
- 不存在的项目根使 Check unavailable，并由 aggregate fail closed。
