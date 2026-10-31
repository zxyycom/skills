### Case TEST-EVIDENCE-PROJECT-REGISTRATION-GUARD-001: 项目生产器拒绝不完整或不支持的注册

Tests:
- `test:c0a27d26b3d214324678c2e6d23f957559cddad8264d5c1ce63da1180174098a`

Tags:
- `repository-tooling`

Contract:
- 非静态或不支持的注册，以及缺失报告或非零注册，不能声称产生完整快照。

Proves:
- 动态名称、带 ast-grep-ignore 注释的嵌套测试、无报告和顶层抛错均被拒绝，suppression 不能绕过嵌套注册边界。
