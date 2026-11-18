### Case RESOURCE-SCHEMA-CASE-001: 资源结构 Schema 条件约束

Tests:
- `test:549144a505f41c4ab749b9268022de1f86adf7720f7bee02773d3c4ed38f1094`
- `test:f99da3788463659b5952443fc0dea4ced393906aa5a620d67d61f6c8dad820fc`

Tags:
- `resource-records`

Contract:
- 资源记录及索引遵循机器 Schema；逻辑入口是非空工作区相对路径的集合且不与同版精确内容混用；实际输入需要精确文件、正序号和调用定位。

Proves:
- Ajv 同时接受同一资源的旧精确版本与新逻辑版本，拒绝空 entries、带父级跳转的路径、入口与文件或成员混用；外层索引也会拒绝内嵌的非法混用记录。
- Ajv 接受未知参考，拒绝空版本、缺 gap、非法角色、目标多选、缺调用定位和成员引用的版本父节点；不证明跨记录、路径存在或内容可用。
