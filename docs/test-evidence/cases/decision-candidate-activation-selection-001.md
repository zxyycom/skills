### Case DECISION-CANDIDATE-ACTIVATION-SELECTION-001: 源码查询发现候选且激活只索引审核目标

Tests:
- `test:8380c40f943fa9aa849ccf157596c0585378ba85314ab11fbe3db783493d7b11`

Tags:
- `decision-records`

Contract:
- 多个合法 candidate scaffold 可以等待正文与审核，并由源码查询发现；单条非法源码只被跳过并产生 warning，显式查看该非法目标时失败。Activate 只建立显式选择的 body-ready 目标，正式索引始终排除其余候选。

Proves:
- 存在一条结构非法但声明目标纯 ID 的同级源码时，`candidates` 仍成功发现两个合法候选并报告带路径的 warning；`show-candidate` 仍能展示合法目标的 `candidate + null alignment + null createdAt`，显式查看非法目标时按该 ID 返回具体结构诊断。
- 移除非法源码后，严格检查成功并分别计数合法 scaffold 与 body-ready candidate。
- 第一次激活只索引目标并提醒剩余 candidate scaffold；普通 list 仍只读正式索引，sync-index 继续排除并提醒候选。
- 第二次激活后两个审核目标都进入正式索引，严格检查保持通过。
