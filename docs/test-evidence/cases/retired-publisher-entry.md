### Case RETIRED-PUBLISHER-ENTRY-001: 旧发布入口写前拒绝

Tests:
- `test:aab53f79ba45fac358427611d8e09490615ca88d333ef9bfe6a3f41e58104438`

Tags:
- `repository-tooling`

Contract:
- 退役的旧 TypeScript skill 发布入口不可继续写入正式 release，应指示使用现行原生发布入口。

Proves:
- 在本地子进程调用旧入口时退出 1 并显示退役诊断；此节点不执行远端发布。
