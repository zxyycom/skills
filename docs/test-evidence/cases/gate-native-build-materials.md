### Case GATE-NATIVE-BUILD-MATERIALS-001: JSON Markdown 与密钥材料沿用同一构建源码策略

Tests:
- `test:5555ec1d2d9c4d9ea2593e65531bc95d57a3a9572cae70762ee20ece456ae644`

Tags:
- `repository-tooling`

Contract:
- 原生 JSON、Markdown 链接、Markdown 内容和密钥材料选择必须统一保留 scripts/build 源码例外及其余默认排除；Markdown 的完整输入声明与执行选择保持同源。

Proves:
- 从四项真实 Check 读取文件声明后，collectProjectFiles 在实际文件树分别返回独立列出的 JSON、大小写 Markdown 及密钥文本材料，包含 scripts/build 直接材料与 nested/src 正常子目录。
- root 和源码根内部的依赖、VCS、日志、缓存、产物及 generated 文件均不进入结果；其他 build 位置、再次嵌套 build 和六个 scripts/build 近邻前缀负样本同样排除。
- 独立收集 maintainedMarkdownFiles 完整输入声明时，结果与两项 Markdown Check 的执行材料集合精确相同；此节点证明文件选择接线，不替代各 validator 的内容验证测试。
