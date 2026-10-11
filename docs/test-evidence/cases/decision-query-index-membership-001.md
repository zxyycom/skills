### Case DECISION-QUERY-INDEX-MEMBERSHIP-001: 查询显式读取发布快照且 Check 检测来源漂移

Tests:
- `test:d9704ac514289db75b4d1f945ccf5017bbeacdbe1dcb28c16ee8b166cd4e2b7b`

Tags:
- `decision-records`

Contract:
- list/trace 仅读取发布索引并显式返回固定 Source，主动不核对不产生 warning，show 读取正文，check 检测来源漂移并失败。

Proves:
- 删除正文后 list/trace 仍从快照返回、显示发布 Source 且 stderr 为空，show 以正文读取失败退出，check 非零。
