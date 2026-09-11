### Case TEST-EVIDENCE-LEDGER-SOURCE-DRIFT-001: 搜索拒绝权威读取期间变化的 Case 源

Tests:
- `test:007f22c4e113295412b5a3b6a0f620c4fc49ef1853b0576454a3fffc205cf8a9`
- `test:bd9d26a8ed4277725457c6d9cf8c2c4560932e25ebfde82e68da57e6fb53420d`

Tags:
- `test-evidence`

Contract:
- 搜索必须拒绝权威 Case 源读取期间变化的结果，并在持久 Case index 不能证明与当前源相同时失败关闭。

Proves:
- 打开目标源后立即 append 必然造成 mutation；搜索仅返回 `state-index.source-changed` 这一项诊断。
- 持久 Case index 与权威源 revision 不一致时，API 与 CLI 都返回 `state-index.index-stale`、空结果和非零 CLI 状态。
