### Case TEST-EVIDENCE-REVISION-MEMBERSHIP-001: Case 成员变化只增删对应 Revision Entry

Tests:
- `test:e9dcbebab4581c37d8e78310877030e9038a6a8c15497082b27d66da358842f0`

Tags:
- `test-evidence`

Contract:
- Case 成员变化只能增加或删除对应的 Case revision，不得改写未触及 Case 的 revision。

Proves:
- 新增第三个 Case 时仅出现其 revision、前两个 revision 保持不变；删除它后仅其 revision 消失。
