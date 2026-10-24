### Case TASK-GRAPH-SDK-PUBLIC-TYPES-001: 公开声明支持真实类型消费者而隐藏私有能力

Tests:
- `test:cde71e33c8ea0892fe1e58d5a31370a9a655e18db34e3c3b1e2472f8b49821da`

Tags:
- `task-graph`

Contract:
- SDK 声明需支持公开类型与方法，私有 store、runner、构造注入和内部类型不进入公共契约。

Proves:
- 独立 tsgo consumer 接受公开类与 stage 判别结果，并用 @ts-expect-error 拒绝私有类型/字段/注入；当前声明树不泄漏列出的内部 API，相对引用可达且有生成头，不固定私有声明文件清单。
