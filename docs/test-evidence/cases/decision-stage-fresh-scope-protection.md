### Case DECISION-STAGE-FRESH-SCOPE-PROTECTION-001: 三个 scope 都独立写前重读并保护 pending

Tests:
- `test:a610185e6f9ff32bbd62e38098871ffb9dc76f4e1954735292d0cb60e7a542b6`

Tags:
- `decision-records`

Contract:
- all、index、domain 均须在准备之后独立验证选中可变来源，漂移时不能替换 pending。

Proves:
- 在三个 scope 的第三次所选文件读取前注入字节变化，stage 均以 source-changed 失败；实际重读次数为三且 Git pending tree 未改变。
