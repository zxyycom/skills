### Case NATIVE-RECORD-SOURCE-SYMLINK-WRITE-001: 选源写入保留符号链接父路径语义

Tests:
- `test:4b597b34afa63dcac8252c6853a39bfda4088e0d3101c79db466e6cf904edd2f`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 执行选中来源时保留声明路径的系统解析语义，不通过词法折叠 link/.. 改变符号链接目标。

Proves:
- Unix 原生节点建立 link 指向 remote/child 的真实符号链接；new 经 link/.. 在 remote/reports 创建候选，词法消除路径对应的工作区 reports 不存在。
