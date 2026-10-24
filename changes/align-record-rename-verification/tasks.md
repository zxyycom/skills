# Tasks

先通过设计 checkpoint，再实施、定向安全验证、两域回归和独立性能验证；主代理保存完成态并结项。

## Readiness

- [x] 0.1 恢复 owner 与场景义务，完成根因 checkpoint 和独立审计，并获主代理认可共享边界。
- [x] 0.2 建立符合固定契约的调查认识，明确资源留存、回退与 Decision 门槛。

## Implementation

- [x] 1.1 共同计划表达与统一 writes/index/guards 安全批量验收，对接两域 rename/discard。
- [x] 1.2 IR rename 同阶段 source/index 验收收口，保留 hook、聚合、absence、members、no-op 与资源证明。
- [x] 1.3 新增/修订原生测试与 Case，更新 owner、独立版本和生成闭包。

## Verification

- [x] 2.1 定向证明真实大量 writes/guards 批量、安全漂移、阶段独立与权限/恢复失败边界。
- [x] 2.2 两域完整回归、真实 Node CLI/SDK、独立分发闭包及静态/生成/Case 检查通过。
- [x] 2.3 独立四场景 before/after 阶段性能验证与仪器等价检查，解释收益与剩余开销。
- [x] 2.4 独立审查闭合，调查发布及全集检查通过，最终稳定输入的完整 changed Gate 通过。

验收依据：实施冻结 Gate 为 61 项实际通过；报告、资源和最终证据写入后的 `bun run check:changed` 通过，15 项实际执行通过、46 项精确输入证明复用，0 失败。独立审查的 12 个源码身份与当前实现一致，24 个正式性能样本及 16 个自证样本全部通过；长期精简数据逐项核对原始汇总一致。
