### Case VERSION-CONTROL-PENDING-RECOVERY-FAILURE-001: 以稳定公共语义报告 pending 恢复不完整
Entry:
- `tools/shared/tests/version-control.test.ts > reports incomplete pending recovery with stable public semantics`
- `bun test --test-name-pattern="^reports incomplete pending recovery with stable public semantics$" ./tools/shared/tests/version-control.test.ts`
Contract:
- pending 范围恢复无法完成或无法核对时必须停止，并与已完整恢复的普通替换失败明确区分。
Proves:
- 读回失败后恢复写入也失败时返回 `pending-recovery-failed`，消息说明范围可能部分更新且不泄漏底层实现值。
