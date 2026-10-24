### Case DECISION-EVOLVE-DISCARD-REFERENCE-001: Evolve 删除不自动维护未选候选引用

Tests:
- `test:b1b90a66407c220cbe71dd2bc4fbde2a423085092711282bb8eb5ca8c195eee9`

Tags:
- `decision-records`

Contract:
- evolve 删除验证最终发布图与显式所选后继；未选候选引用由未来发布诊断。

Proves:
- 存在未选候选指向删除目标时，evolve 建立所选后继并删除目标，未选候选字节保持。
- 随后发布未选候选因失效 target 失败，候选内容仍保持。
