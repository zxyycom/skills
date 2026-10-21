### Case GATE-GENERATED-INPUTS-001: 生成原语测试保留完整局部模块闭包

Tests:
- `test:e12dca21c0e6320282da2510b9a2b6646ee08017f6f79c080df0d84385c5eb75`

Tags:
- `repository-tooling`

Contract:
- 生成文件原语测试仅消费本身、声明与 source-runtime 传递模块及临时 fixture，不读取真实领域实现。

Proves:
- 生成、声明、source-map、source-runtime、project 与 filesystem 模块变化使原语测试重跑，真实领域源码、renderer 与无关发布测试变化允许复用。
