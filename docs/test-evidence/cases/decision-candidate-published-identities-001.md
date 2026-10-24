### Case DECISION-CANDIDATE-PUBLISHED-IDENTITIES-001: 候选准备复用已验正式位置而不重读全集 header

Tests:
- `test:4f946c54a75e183920ada1fa4d5deffb0f0ba31da01faf731b95fb5bde9dc508`
- `test:abb01a88e105a90aa4d181e8cfcbe8e75205b3763d13d081c5510f618c421b76`
- `test:ecd0d5831eff1f2645f488ce9aaefbeb65824a51d67ed7abf92726b0b6f2a1cb`

Tags:
- `decision-records`

Contract:
- 合法发布基线提供正式 ID/sourcePath；候选局部准备不重读已知正式 header，不将未读的正式当前内容宣称已验。实际候选、未知位置和必要直接依赖仍安全读取，真实缺索引只发现 header 身份，不自动发布或恢复索引。

Proves:
- 20 条正式来源（root/archive 各 10，locator 与 ID 不同）及 2 候选下，readiness/list/show 各只安全读取 2 个候选，正式 open/handle.readFile/readFile 均零；new 不读正式来源，读取仅来自候选集合及自身事务验收，数量有常数上界。无关正式正文/headers 损坏不构成候选局部门禁。
- 未知路径仍读取 header，不能按 basename 猜 ID；候选与发布 ID 重复、已知位置目录或 symlink 均失败；选中候选实际引用的正式依赖仍安全读取并对身份坏内容失败。坏 JSON/definition 不符不降级；真缺索引必须重新读取全部正式安全 header，坏 header 失败、坏正文但合法 header 可发现身份，且不生成索引。
- root readdir 已返回普通 archive Dirent 后，archive readdir 入口被替换为外部 symlink 或具有相同发布 basename 的普通目录时，均拒绝目录身份漂移；不借读取正式 header/body 才发现问题，正式文件读取仍为零。
