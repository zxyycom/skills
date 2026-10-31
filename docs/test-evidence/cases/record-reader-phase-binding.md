### Case RECORD-READER-PHASE-001: 批量验收保持阶段和实际观察绑定

Tests:
- `test:7be2f34011914bac3813287dc010cdfa3e37836d7fb74be9ec2414f7d1b62ec7`

Tags:
- `record-operations`

Contract:
- 同phase仅复用实际采集且完整expected等价的证明；新phase必须独立读取，不保留调用者可变expected引用。

Proves:
- 同阶段重叠guards可复用，下一phase发现真实mode变化，修改expected字节不能自证成功。
