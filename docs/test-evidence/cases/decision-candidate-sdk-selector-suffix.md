### Case DECISION-CANDIDATE-SDK-SELECTOR-SUFFIX-001: 直接 SDK 候选查询规范化一次 Markdown 后缀

Tests:
- `test:9935afbe15f30a320ed9ab76b2aa2a44a4e219d118248bc8952e305aa2a3959c`

Tags:
- `decision-records`

Contract:
- show-candidate 的直接 SDK 调用与 CLI 使用同一领域 selector 规则，只移除一次大小写不敏感的终端 .md 后缀，再精确解析完整 ID 或唯一语义名称。

Proves:
- 不经过 CLI parser 的 executeDecisionQuery 接受完整 ID 加 .MD 和短名称加 .md，两者均返回同一候选身份及正文；重复 .md.md 后缀不会被递归剥除而误匹配。
