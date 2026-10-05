### Case LIGHTWEIGHT-JUDGMENT-STATS-LEGACY-001: 旧库拒绝与显式升级指引

Tests:
- `test:c35464996687b6039b7277f7dd8ba3e3900e9a34c7d65ec7c309cae0bd097dec`

Tags:
- `lightweight-judgment`

Contract:
- 正常 stats 与 writer 只接受当前结构；v1 在发送前被拒绝，不自动升级或泄露正文，并指向独立升级指南。

Proves:
- 真实 v1 库的 stats 与推理均返回 storage／退出 4、attempts=0 和升级路径；stats 无 persistence，输出无正文标记，原库字节与版本保持，HTTP 未调用。
