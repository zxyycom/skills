### Case DECISION-EVOLUTION-RELATIONS-001: 候选关系接受前瞻校验但不进入正式关系图

Tests:
- `test:ce1fd8f221065f3fd64cb13d0547c967044afc53576fda5af89b7023f281f030`

Tags:
- `decision-records`

Contract:
- 候选可以预写指向当前可解析记录的关系；候选关系在建立前只接受前瞻性结构校验，不进入正式索引或关系图。

Proves:
- 候选指向另一个完整候选时，两者都通过严格检查并被计数。
- 正式索引仍排除两个候选，且既有活动图保持不变。
