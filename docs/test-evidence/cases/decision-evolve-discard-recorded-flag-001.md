### Case DECISION-EVOLVE-DISCARD-RECORDED-FLAG-001: Evolve discard 参数在无需历史基线时准备删除与建立

Tests:
- `test:b83b49feb3611be972ed455041f6b8899d47112ff2f3df10aba7411d7f1ed26c`
- `test:b92b974d04348b5a4f2657373f788aceb5390963529b10731d8bc421e3757619`

Tags:
- `decision-records`

Contract:
- evolve discard 的 delete-recorded 参数确认删除目标；最终关系为空且无其他历史义务时，领域准备不要求历史基线，并可同时计划删除与后继建立。

Proves:
- 真实 argv 解析保留 deleteRecorded=true、keepUnrecordedHistory=false 与来源关系覆盖；领域判断 requiresHistory=false，传入 null 基线仍成功，精确产生删除 intermediate 和建立 active successor 两项 changes，最终关系为空。
- 既有非 Git FS CLI 入口承接来源空关系下的实际删除、后继建立与索引更新。
