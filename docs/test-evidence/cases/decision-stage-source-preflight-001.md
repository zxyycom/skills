### Case DECISION-STAGE-SOURCE-PREFLIGHT-001: Stage 拒绝选择来源在快照后的漂移

Tests:
- `test:1270ea9c854bc87bc39e547788fd877dc852b2768491ce61def50a4c69e71a5c`
- `test:9d7437df8123231f3379ea4bf590d487f70ff9bf18efac8b98e76fda66a73811`

Tags:
- `decision-records`

Contract:
- 选择的 filesystem source 在初次快照后、pending replace 前发生字节修改、删除或移动时，Stage 必须拒绝且不写入 pending。

Proves:
- 真实 all scope 在第三次读取所选 Markdown 前注入字节变化，返回 stage-source-changed，实际读取计数为三，Git pending tree identity 保持不变。
- 既有非 Git FS 复核另行拒绝重复身份、路径移动、字节变化及已删 ID 重现，同时容许无关非法来源。
