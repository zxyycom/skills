### Case DECISION-STAGE-SOURCE-PREFLIGHT-001: Stage 拒绝选择来源在快照后的漂移

Tests:
- `test:9d7437df8123231f3379ea4bf590d487f70ff9bf18efac8b98e76fda66a73811`

Tags:
- `decision-records`

Contract:
- 所选来源在独立准备与复核期间发生字节漂移时，stage 必须拒绝且不写 pending。

Proves:
- 真实 all scope 在第二次读取所选 Markdown 前注入字节变化，返回 stage-source-changed，实际读取计数为二，Git pending tree identity 保持不变。
