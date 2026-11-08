### Case INVESTIGATION-HISTORY-PREFIX-PRESENCE-001: 所选历史索引指向缺失来源时保持不可用诊断

Tests:
- `test:37d9787b9574a618d832c32f5b08aefec7839a092a6f760a0323de047671d989`

Tags:
- `investigation-report`

Contract:
- 历史前序无法从固定 HEAD 索引定位到来源时，应报告历史检查不可用而不是断言未记录。

Proves:
- 真实 Git HEAD 索引仍指向所选前序，但该历史来源已从 HEAD 删除时仅发 history unavailable/source missing，不伪报未记录；该节点不覆盖来源身份不一致或旧前缀读取变体。
