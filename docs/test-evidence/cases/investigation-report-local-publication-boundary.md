### Case INVESTIGATION-LOCAL-PUBLICATION-BOUNDARY-001: 普通局部维护按发布索引与实际写集验收

Tests:
- `test:38a2f437e1b6732889f9a594ae0b79504a79104f6ae0c9c9d56cddb369493fb0`
- `test:85b420b1ed250a1b42610ddf6eeb516ae846fe59b1311a7d68d6d0f64dc434a0`
- `test:87d3875d89be050ef98ce3a1b5e55ec83cf7c2f215b22158b37be6834291e042`
- `test:bf40fc1ad51c4cca62fb08495bff21d9620e925d8c3bc22474a5e48ff4b5b87b`

Tags:
- `investigation-report`

Contract:
- 普通维护只使用合法发布索引与所选、实际改写来源；未选候选引用不自动修复，完整日期 ID 与实际 locator 在首次发布中保持。

Proves:
- 首次 new 返回 canonical 完整 ID locator，publish 保留 ID 并生成对应正式 sourcePath。
- 对无关正文的 fs.open 设置禁止读取后，rename 仍改写索引可见正式引用者，discard 仅删除授权 owner 树；未选候选字节保持，失效关系在其发布时诊断。
- 所选正文漂移使关系编辑、discard 和真正 rename no-op 均零改写失败，索引字节不变。
