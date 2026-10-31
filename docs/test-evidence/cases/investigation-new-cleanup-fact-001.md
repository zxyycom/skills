### Case INVESTIGATION-NEW-CLEANUP-FACT-001: 创建后解锁失败保留实际创建事实

Tests:
- `test:f20d886cdb28f63458ff625762e6c094e684621960b120a0d06b82bbb7eff5ef`

Tags:
- `investigation-report`

Contract:
- new 已独占建立候选后，解锁失败返回非零并保留真实 candidate/changed，不伪报未创建。

Proves:
- API 返回 error 但 candidate ID/path/正文与实际文件一致且 changed=true；CLI 退出1、回显真实ID/path/changed与解锁诊断，不附成功review。
