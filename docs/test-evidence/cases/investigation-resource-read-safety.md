### Case IR-RESOURCE-READ-SAFETY-001: 资源诊断只读取安全且受管的引用

Tests:
- `test:9922ee29491d70fa8a4820ce0f3fda2009ca0f44bb012c507f44b82ce4f07403`
- `test:f49360f90a78963e481571b98229e49c2f17e07f78cf5bff66965be9bea4ee2f`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 诊断不为取得类型或压缩率跟随资源祖先符号链接，或末端文件符号链接，也不打开被 Git ignore 排除的未跟踪资源。

Proves:
- 安全打开入口在普通文件对照成功时拒绝指向根内及根外的祖先与末端符号链接；另在私有 unborn Git 仓库验证 ignored 引用令候选未就绪、review 未完成且读取预算为零。未覆盖并发替换竞态或 Windows 平台。
