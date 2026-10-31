### Case TEST-EVIDENCE-NATIVE-AST-GREP-001: 项目快照以原生 ast-grep 保留多行扫描参数

Tests:
- `test:d321c8dffa3a6c60075d18de5d85fd31b6056df665b58e621e71fbc0d04a0737`

Tags:
- `repository-tooling`

Contract:
- 项目测试快照使用固定版本的项目本地 ast-grep；Windows 选择该依赖安装生成的原生可执行文件，保持扫描的多行规则、原始参数与输出契约，不经 batch shim 重新解释。

Proves:
- 真实 ast-grep 接受多行 inline rules 和中文空格源路径，返回正确的相对路径与原始测试名捕获；解析器没有以空结果替代采集。
