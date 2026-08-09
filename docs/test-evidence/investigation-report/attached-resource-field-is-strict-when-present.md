### Case INVESTIGATION-RESOURCE-FIELD-001: 随附资源字段存在时使用严格语法

Entry:
- `tools/investigation-report/tests/resources.test.ts > attached resource field is strict when present`
- `bun test --test-name-pattern="^attached resource field is strict when present$" ./tools/investigation-report/tests/run.ts`

Contract:
- `随附资源` 一旦声明就必须紧接 `形成时间`，整个报告只出现一次，并包含至少一个纯本地 Markdown 链接；每个子项只有一个展示文字非空的链接，同一报告不重复引用同一资源。

Proves:
- 形成时间列表结束并出现普通正文段落后再写 `随附资源`，即使没有引入另一个非法 metadata 字段，也会命中只允许形成时间与可选随附资源的专用 metadata 结构诊断。
- 空字段、空展示文字、重复资源、链接外文字、重复字段以及单子项多链接都产生能定位报告与具体语法原因的阻断诊断。
