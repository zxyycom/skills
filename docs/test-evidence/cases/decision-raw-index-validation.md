### Case DECISION-RAW-INDEX-VALIDATION-001: 冻结 raw 输入不能绕过严格验收

Tests:
- `test:b76ad203ae1bee26519f645044e8eab58b3de0b208b82b5c33e3dd25af1ac37d`

Tags:
- `decision-records`

Contract:
- raw Decision 索引 validator 与文本 parser 必须各自严格验收，不以对象冻结替代字段校验，state 失败优先于领域关系错误。

Proves:
- 合法构建结果复制后改为非法时间戳并加入自环，再冻结顶层、entries 与目标 state；raw validator 与文本 parser 均返回 state-index.state-parse-failed、目标 ID 与时间戳原因。
