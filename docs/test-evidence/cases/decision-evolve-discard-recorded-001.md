### Case DECISION-EVOLVE-DISCARD-RECORDED-001: Evolve discard 在删除已记录决策前暂停

Tests:
- `test:d65d2871a8351a89d63ec44290f5f019c864fd88deb8479397ca47f64ac5c38b`

Tags:
- `decision-records`

Contract:
- evolve discard 对已记录集合中的删除目标，未带 delete-recorded 时必须 attention，且不能生成 mutation changes 或成功 relationReview。

Proves:
- 真实 argv 解析使 deleteRecorded 默认为 false；显式已记录集合含删除目标时，领域准备返回 attention 且不含 changes/relationReview，renderer 退出码 1、stdout 为空并提示 entered Git HEAD 与 delete-recorded。
