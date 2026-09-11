### Case TEST-EVIDENCE-REVISION-MEMBERSHIP-001: Case 成员变化只增删对应 Revision Entry

Tests:
- `test:1067e16cb03f9e6a286373ef10be19277eefd693e4898c33fd5e4f4b9a66e8e3`

Tags:
- `test-evidence`

Contract:
- Case 成员变化只能增加或删除对应的 Case revision，不得改写未触及 Case 的 revision。

Proves:
- 新增第三个 Case 时仅出现其 revision、前两个 revision 保持不变；删除它后仅其 revision 消失。
