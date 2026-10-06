### Case NOVEL-CARDS-READONLY-PREFLIGHT-033: 预检零副作用

Tests:
- `test:f150a5a3bde869a642b5fb2799ccb3f7bd8a48ad90f0ee2f139b8f1d9d17ebd0`

Tags:
- `novel-cards`

Contract:
- 事务发布与恢复必须全目标预检成功后才产生文件/目录副作用。

Proves:
- 后续旧目标字节不符使发布及恢复预检失败；先前不存在的history目录仍不存在，恢复journal保留以便处理。
