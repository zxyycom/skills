### Case NATIVE-RECORD-SOURCE-SHOW-CANDIDATE-001: 候选回读不跨来源消歧

Tests:
- `test:873747e860a9a366016b8d32eb80c25b429cb350462bd8849bb2e228d01f3a05`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 按 key 的 show-candidate 在各来源独立选择候选，保留候选及 readiness，而不把跨源同 ID 判为歧义。

Proves:
- 两源有同 ID、不同正文的候选，真实 show-candidate 返回两个成功来源，ID、scaffoldValid 和各源正文均符合 fixture。
