### Case NOVEL-CARDS-EXPANSION-008: 有界包含展开

Tests:
- `test:c7be23e26500458e9cf1c0d8287378711793abdba384793d541dfa9a93ea4745`

Tags:
- `novel-cards`

Contract:
- expand只递归children，预算停止返回明确frontier而非默认为全文。

Proves:
- 深度和卡数预算分别产生真实边界，完整包含展开不读取sources但保留其入口。
