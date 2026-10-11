### Case VERSION-CONTROL-SELECTED-PAYLOAD-INTEGRITY-001: 选择性内容保留仍读取全部范围payload

Tests:
- `test:585091e093a5a39d47f55b3007dcc29409615eb56b13baa005d9d6c58eb8c27b`
- `test:7a983d9eb9a467fbdce63c2c3a67ea3673cacbe99ffb2987857d66685e2fae32`
- `test:d9a587ee5313e15a691fec1bda838d73a107714930b3b4160ce3d19898c6a256`

Tags:
- `version-control`

Contract:
- 选择性快照与默认 full-read 均验证完整范围的实际 payload，保留未选对象的缺失、类型与腐败失败语义。

Proves:
- 所选之外对象缺失、类型错误或压缩腐败，均阻断选择性快照与默认 full-read，pending 不变。
