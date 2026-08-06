### Case DECISION-CANDIDATE-ACTIVATION-SELECTION-001: 源码查询发现候选且激活只索引审核目标
Entry:
- `tools/decision-records/tests/candidate-lifecycle.test.ts > candidate queries discover source records while activation indexes only reviewed targets`
- `bun test --test-name-pattern="^candidate queries discover source records while activation indexes only reviewed targets$" ./tools/decision-records/tests/run.ts`
Contract:
- 多个结构完整的显式候选可以等待审核，并由源码查询发现；单条非法源码只被跳过并产生 warning，显式查看该非法目标时失败。Activate 只建立显式审核目标，正式索引始终排除其余候选。
Proves:
- 存在一条结构非法的同级源码时，`candidates` 仍成功发现两个合法候选并报告带路径的 warning；`show-candidate` 仍能展示合法目标的 `candidate + null alignment + null createdAt`，显式查看非法目标时返回目标路径和具体结构诊断。
- 移除非法源码后，严格检查成功并计数合法候选。
- 第一次激活只索引目标并提醒剩余候选；普通 list 仍只读正式索引，sync-index 继续排除并提醒候选。
- 第二次激活后两个审核目标都进入正式索引，严格检查保持通过。
