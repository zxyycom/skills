### Case RECORD-READER-PHASE-001: 批量验收保持阶段和实际观察绑定

Tests:
- `test:89ab044c0f0cf8830c10ed2469e2d58236823a6c748389c56ed7a4b27171790c`

Tags:
- `record-operations`

Contract:
- 同phase仅复用实际采集且完整expected等价的证明；新phase必须独立读取，不保留调用者可变expected引用。

Proves:
- 同阶段重叠guards可复用，下一phase发现真实mode变化，修改expected字节不能自证成功。
