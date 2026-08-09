### Case INVESTIGATION-RESOURCE-FIELD-001: 随附资源字段存在时使用严格语法

Entry:
- `tools/investigation-report/tests/resources.test.ts > attached resource field is strict when present`
- `bun test --test-name-pattern="^attached resource field is strict when present$" ./tools/investigation-report/tests/run.ts`

Contract:
- 报告允许按需通过可选的 `随附资源` 引用资源；字段一旦声明就必须紧接 `形成时间`、整个报告只出现一次，并使用至少含一个子项的嵌套无序列表。
- 每个子项只包含一个无 title 的本地 Markdown 行内链接；展示文字的文本投影必须非空但可以使用强调等行内标记，同一报告不能重复引用同一资源。

Proves:
- 使用强调标记的非空链接展示文字通过校验。
- 形成时间列表结束并出现普通正文段落后再写 `随附资源`，即使没有引入另一个非法 metadata 字段，也会命中只允许形成时间与可选随附资源的专用 metadata 结构诊断。
- 空字段、空展示文字、重复资源、链接外文字、重复字段、单子项多链接、有序嵌套列表、带 title 链接和引用式链接都产生能定位报告与具体语法原因的阻断诊断。
