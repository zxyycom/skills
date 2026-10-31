### Case TASK-GRAPH-SDK-PUBLIC-TYPES-001: 公开声明支持真实类型消费者而隐藏私有能力

Tests:
- `test:ada7b7d06ea91b6f938cab7c2885b81568c63ddfd5ad65ba5329164dab31e744`

Tags:
- `task-graph`

Contract:
- SDK 声明需支持公开类型与方法，私有 store、runner、构造注入和内部类型不进入公共契约。

Proves:
- 独立 tsgo consumer 接受公开类与 stage 判别结果，并用 @ts-expect-error 拒绝私有类型/字段/注入；当前声明树不泄漏列出的内部 API，相对引用可达且有生成头，不固定私有声明文件清单。
