# 2026-07-06 - 将 OpenSpec change 作为临时计划并设置实现门禁

## 索引摘要
- 目的: 允许先保存尚未完成审计的 change 计划，同时阻止它被误当成可直接实施的方案。
- 背景: OpenSpec change 可以作为临时计划存在, 类似 issue 或 PR, 通常从用户想法、探索结论、代码事实或已有规范中引申出来。
- 决策: 在 OpenSpec skills 中把 active change 视为可以先存在的临时计划; 创建 change 只表示想法被结构化到 `openspec/changes/<name>/`, 不表示方案已经审计完毕或可以立即实现。

## 目的
- 允许先保存尚未完成审计的 change 计划，同时阻止它被误当成可直接实施的方案。

## 背景
- OpenSpec change 可以作为临时计划存在, 类似 issue 或 PR, 通常从用户想法、探索结论、代码事实或已有规范中引申出来。
- 如果创建 change 后没有实现前门禁, agent 容易把“artifact 已生成”误解为“方案已经审计完毕”, 直接执行未充分思考的计划。
- 没有门禁会提高使用心理负担: 用户不敢把未成熟想法先整理为 change, 因为添加 change 可能被误解为内容已经确认。
- OpenSpec skills 是基于原始 skill 的二次开发、精炼和提取; 精简后的入口会丢失部分维护性背景, 需要保留原始参考作为排查兜底。

- 本决策适用于 `skills/openspec-propose/`、`skills/openspec-apply-change/`、`skills/openspec-explore/` 和 `skills/openspec-archive-change/`。
- OpenSpec CLI 承接当前项目状态、schema、artifact 依赖和校验结果, 应优先作为常规执行入口。
- `reference-original.md` 只承接原始行为和维护背景, 不作为常规执行路径。

## 决策
- 采用: 在 OpenSpec skills 中把 active change 视为可以先存在的临时计划; 创建 change 只表示想法被结构化到 `openspec/changes/<name>/`, 不表示方案已经审计完毕或可以立即实现。
- 采用: `skills/openspec-propose/SKILL.md` 必须保持阻塞级审计任务, 并放在所有实现任务之前。审计至少检查 proposal、design、specs 和 tasks 是否围绕核心句, capability ID 是否符合命名规则, change 是否没有把临时 artifacts 表述为已批准或可直接实现, 是否没有越过 change 目录修改现有长期文档或其它 change, 以及 `## Open Questions` 是否没有未回答问题或已收敛歧义。
- 采用: `skills/openspec-apply-change/SKILL.md` 必须保持执行前开放问题门禁。存在未回答问题或已收敛但仍影响实现的歧义时, 暂停实现, 不把问题当作实现假设。
- 采用: OpenSpec skills 优先使用 CLI 获取状态、schema、artifact 依赖和校验结果; CLI 不可用、命令失败、输出不足或需要对照改写前行为时, 才读取同目录 `reference-original.md`。
- 采用: `skills/openspec-propose/SKILL.md` 的 artifact 写作语言优先沿用用户输入语言或项目既有语言约定, capability 示例使用中性示例, 不写入项目专属样例。
- 不采用: 不把“创建 change”或“artifact 状态完成”当作实现许可。原因是这会让临时计划变成未经审计的执行依据。
- 不采用: 不要求每个 artifact 写入固定的“未审核临时文档”免责声明。原因是固定免责声明容易污染用户项目文档; skill 只需要禁止把临时 change 表述为已批准、已审计或可直接实现。
- 不采用: 不在 `docs/skills/openspec-skills.md` 或每个 skill 入口完整展开这段设计理由。原因是人类介绍页只承接项目入口说明, skill 入口承接执行规则, 长期取舍由决策记录承接。
