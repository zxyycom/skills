### Case DECISION-STAGE-FRESH-SCOPE-PROTECTION-001: all scope 独立写前重读并保护 pending

Tests:
- `test:9d7437df8123231f3379ea4bf590d487f70ff9bf18efac8b98e76fda66a73811`

Tags:
- `decision-records`

Contract:
- all、index、domain 均须在准备之后独立验证选中可变来源，漂移时不能替换 pending。

Proves:
- 真实 all scope 在第三次所选文件读取前注入字节变化，stage 以 stage-source-changed 失败；实际读取计数为三且 Git pending tree identity 未改变。
