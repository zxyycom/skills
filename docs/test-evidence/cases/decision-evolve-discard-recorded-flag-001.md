### Case DECISION-EVOLVE-DISCARD-RECORDED-FLAG-001: Evolve discard 参数在无需历史基线时准备删除与建立

Tests:
- `test:9716aaa6fdffd6f3f0d925278242789f94101b1e901a0f6d58c0bc9ddd8561e8`
- `test:cf199beb47b15e0c523864903cebdb103449715d0fd2cf12bcacead20508704d`

Tags:
- `decision-records`

Contract:
- evolve discard 的 delete-recorded 参数确认删除目标；最终关系为空且无其他历史义务时，领域准备不要求历史基线，并可同时计划删除与后继建立。

Proves:
- 真实 argv 解析保留 deleteRecorded=true、keepUnrecordedHistory=false 与来源关系覆盖；领域判断 requiresHistory=false，传入 null 基线仍成功，精确产生删除 intermediate 和建立 active successor 两项 changes，最终关系为空。
- 既有非 Git FS CLI 入口承接来源空关系下的实际删除、后继建立与索引更新。
