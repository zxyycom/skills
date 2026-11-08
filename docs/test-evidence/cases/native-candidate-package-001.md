### Case NATIVE-CANDIDATE-PACKAGE-001: 私有候选源码包身份与隔离输出

Tests:
- `test:e41ddeb1185e13f106edf17571a3e1935dbbca9f5b71d5cffe0cec7f1a1b9565`

Tags:
- `repository-tooling`

Contract:
- 私有候选源码包绑定角色、版本、冻结源码与 Schema，显式匹配两角色两平台资产，独占输出不得覆盖已有制品。

Proves:
- 固定候选文件可生成源码与引导 ZIP；错误角色、源码摘要、Schema 或缺失入口被拒绝。四个合成目标 ZIP 与 manifest 一致时通过，资产损坏和重复输出被拒绝。
- 不证明入口可执行、真实编译来源、正式发布或平台安装。
