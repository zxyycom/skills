### Case TEST-EVIDENCE-ROOT-MEMBERSHIP-001: Case 根目录拒绝额外成员

Tests:
- `test:ceb55166605c3185f153175276147fb2cacac4b9d0997f7687f91dbe56b8d6de`

Tags:
- `test-evidence`

Contract:
- Case 根目录只能包含受控的 cases 目录和派生索引。

Proves:
- 额外根成员产生 case.root-member-unsupported 诊断。
