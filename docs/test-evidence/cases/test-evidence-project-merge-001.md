### Case TEST-EVIDENCE-PROJECT-MERGE-001: 项目生产器合并不同测试容器的重复注册

Tests:
- `test:20c035ea82add25dd9108c23a90135611baf951019079abaa661dff37fcc6daf`

Tags:
- `repository-tooling`

Contract:
- 不同测试容器注册的相同实体必须合并其 locator 集合。

Proves:
- 两个脚本指向同一文件时只产生一个实体，且含 direct、container 与 legacy selector。
