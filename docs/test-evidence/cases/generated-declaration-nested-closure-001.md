### Case GENERATED-DECLARATION-NESTED-CLOSURE-001: 声明生成保留嵌套依赖闭包

Tests:
- `test:ce0df21342dec467e25ca05a194f706ade07ab41efebe2ef424c2cc3a7df656d`

Tags:
- `repository-tooling`

Contract:
- 声明生成以维护源码入口所在目录为源码根，保留可达模块目录及相对导入关系。

Proves:
- 编译含嵌套类型导入和内部运行时模块的隔离源码树，产物恰好包含公开入口和三个可达声明模块；子模块与父模块的导入路径保持正确，内部实现声明留在公开闭包之外。
