### Case GATE-ENVIRONMENT-VALIDATOR-OWNER-001: 环境结构回归拥有源码 validator 输入

Tests:
- `test:2cd18932228800cd6049166fc9a9b28a791ca7315b7b21c40fe4a1cafe18374e`

Tags:
- `repository-tooling`

Contract:
- environment 中的结构验证消费源码 validator，不是分发 consumer。

Proves:
- 只改 validation.ts 使 environment execute，无关 Change Plan lifecycle reuse；environment Check 未声明统一生成前置。
