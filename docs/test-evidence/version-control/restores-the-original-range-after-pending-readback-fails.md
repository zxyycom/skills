### Case VERSION-CONTROL-PENDING-READBACK-FAILURE-001: pending 读回失败后恢复原范围
Entry:
- `tools/shared/tests/version-control.test.ts > restores the original range after pending readback fails`
- `bun test --test-name-pattern="^restores the original range after pending readback fails$" ./tools/shared/tests/version-control.test.ts`
Contract:
- 应用目标后的读回核对属于 pending 范围替换成功条件，读回失败时必须恢复写入前范围。
Proves:
- 目标已应用但读回阶段失败时返回 `pending-replacement-failed`，随后读取的范围逐路径、逐内容等于原快照。
