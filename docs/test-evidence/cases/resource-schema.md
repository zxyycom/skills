### Case RESOURCE-SCHEMA-CASE-001: 资源结构 Schema 条件约束

Tests:
- `test:549144a505f41c4ab749b9268022de1f86adf7720f7bee02773d3c4ed38f1094`
- `test:f99da3788463659b5952443fc0dea4ced393906aa5a620d67d61f6c8dad820fc`

Tags:
- `resource-records`

Contract:
- 资源记录及索引遵循机器 Schema；实际输入需要精确文件、正序号和调用定位。

Proves:
- Ajv 接受合法记录、索引及未知参考，拒绝空版本、缺 gap、非法角色、目标多选、缺调用定位和成员引用的版本父节点。跨记录及文件路径由 CLI 而非 Schema 验证。
