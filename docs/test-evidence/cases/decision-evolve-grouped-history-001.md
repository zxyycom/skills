### Case DECISION-EVOLVE-GROUPED-HISTORY-001: Evolve 为仅由分组引入的前序执行历史门禁

Tests:
- `test:c631a4216c677190057e4171db97975ade5e7348ac4dc6f0a056425a45919a66`

Tags:
- `decision-records`

Contract:
- 历史基线探测必须按各 successor 的有效最终关系执行，不能遗漏只由分组 replacement 引入的前序。

Proves:
- 真实 argv 解析的 group-only 前序经生命周期 resolver 绑定为后继的 replace 关系；领域判断 requiresHistory=true。
- 显式空已记录集合使领域准备 attention，未生成 changes/relationReview，诊断 outcome 均为 no-change；renderer 退出码 1、stdout 为空并输出该前序的历史警告。
