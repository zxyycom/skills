### Case VERSION-CONTROL-SELECTED-PAYLOAD-INTEGRITY-001: 选择性内容保留仍读取全部范围payload

Tests:
- `test:77c1730918ed8fd41bb2e800cb9cad0aec7cb07f64afb0007f48e6290ce3fd10`
- `test:b4976d7832c08f3cd691c8b15074fcf3fc216083e696ca66a0f4a3001c628edf`
- `test:d6ae07fd49e615651b04b8b98c19ea45f42a8a40bef25a711e0fa6135773592b`

Tags:
- `version-control`

Contract:
- 选择性快照与默认 full-read 均验证完整范围的实际 payload，保留未选对象的缺失、类型与腐败失败语义。

Proves:
- 所选之外对象缺失、类型错误或压缩腐败，均阻断选择性快照与默认 full-read，pending 不变。
