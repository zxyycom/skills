### Case INVESTIGATION-LOCAL-DRAFT-001: 起草与候选读取不承担无关正式来源验收

Tests:
- `test:f91eee630f3751ef94bd3247d410ad1e65d01a1e6e71e40b55f1eebeceb1c9a4`

Tags:
- `investigation-report`

Contract:
- new 与 show-candidate 在无发布索引时只读取自身和直接必需依赖，不隐式验收无关正式正文。

Proves:
- 无索引且无关正式来源正文损坏时，起草仍成功、readiness 准确表示空正文，show 可读；拦截该正式来源的读取计数为零。
