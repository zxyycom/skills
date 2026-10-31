### Case RECORD-COST-CASE-028: 固定 HEAD 读取

Tests:
- `test:46b374d786df155885bbab6f8205b46e66f2af8a4fcc11bc4b24e9e8860ecdda`

Tags:
- `record-cost`

Contract:
- prepare 后 HEAD 变更不得改变已准备内容。

Proves:
- 真实 Git 新提交后仍读取原提交字节。
