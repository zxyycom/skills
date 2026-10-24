### Case GATE-ENVIRONMENT-VALIDATOR-OWNER-001: 环境结构回归拥有源码 validator 输入

Tests:
- `test:575a36febefc92d0fb9d6b4c7616481e3d541c28aa8d26a6aa97db29cc1c4523`

Tags:
- `repository-tooling`

Contract:
- environment 中的结构验证消费源码 validator，不是分发 consumer。

Proves:
- 只改 validation.ts 使 environment execute，无关 CP lifecycle reuse，显式无统一生成前置。
