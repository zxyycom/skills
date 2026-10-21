# Tasks

先闭合输入与政策，再实施和验证；全部验收有证据后才声明完成。

## Readiness

- [ ] 0.1 核对 owner、现有 receipt 事务、Markdown selection 与输入闭包，确认 lint 例外及不变边界。

## Implementation

- [ ] 1.1 将 lint 接入既有 catalog、能力与原生 condition，补齐 ignored/root/额外目录 Markdown 快照和已知归属。
- [ ] 1.2 同步 catalog/selection/proof 测试、对应 Case 与派生索引，覆盖完整输入及保守执行边界。
- [ ] 1.3 演进相关长期决策，并同步工具链与 Gate 接入 owner 的实际契约和数量。

## Verification

- [ ] 2.1 运行项目接入测试和账本检查，证明 lint 精确 reuse、各类输入变化 execute、失败/漂移不发布，以及链接与 CI/release 不变。
- [ ] 2.2 运行完整 Gate，并用实际共享工作场景 smoke 核对复用与输入变化；记录未覆盖边界。
- [ ] 2.3 完成独立正确性审查和最终 AI-ready/编码优化，修复发现并复验；确保稳定 owner、实现与验收一致。
