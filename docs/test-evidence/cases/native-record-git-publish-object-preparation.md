### Case NATIVE-RECORD-GIT-PREPARE-OBJECTS-001: 选中对象准备与 pending 保留

Tests:
- `test:f334dd45a10564b3025c1113d9da525dd6d46d5a469240b9ec775c05b94691a4`

Tags:
- `record-rust`

Contract:
- 选中对象准备须保持内容身份和模式，重复内容可复用对象，未选 pending 不得改变。

Proves:
- 私有 Git 的小批及重复内容批次逐项核对正文、Git hash-object OID、模式和未选 pending 身份。
