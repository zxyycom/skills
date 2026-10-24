### Case INVESTIGATION-LOCAL-PUBLICATION-BOUNDARY-001: 普通局部维护按发布索引与实际写集验收

Tests:
- `test:1757ccaf9229d517d2d249ae9e066f93f81161d41e7e16d60156424d4a7fa6b8`
- `test:8da594cd4915e475580687ce65fa8d5bdaf1635fe9c9a94d7f8efbbb350b57c8`
- `test:c7287da16fbdd9848837888954102bf24a0b35fa353f4037c20c426fda7fe1d1`
- `test:f76139d51ad15f852dbc31bdbfa79faec18e72dba0af8a51a4aacc7cf19c956c`

Tags:
- `investigation-report`

Contract:
- 普通维护只使用合法发布索引与所选、实际改写来源；未选候选引用不自动修复，完整日期 ID 与实际 locator 在首次发布中保持。

Proves:
- 首次 new 返回 canonical 完整 ID locator，publish 保留 ID 并生成对应正式 sourcePath。
- 对无关正文的 fs.open 设置禁止读取后，rename 仍改写索引可见正式引用者，discard 仅删除授权 owner 树；未选候选字节保持，失效关系在其发布时诊断。
- 所选正文漂移使关系编辑、discard 和真正 rename no-op 均零改写失败，索引字节不变。
