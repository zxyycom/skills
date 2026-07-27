# 测试证据账本

本账本覆盖 `package.json` 中 `test:*` 稳定入口保留的历史与当前测试。根目录的
[`test-evidence-topics.json`](test-evidence-topics.json) 定义受控测试责任 topic；
每个权威 case 单独位于对应 `<topic-id>/<semantic-slug>.md`，并对应测试框架能够
独立选择、单独报告的一个最小原生测试节点。

[`test-evidence-index.json`](test-evidence-index.json) 是从全部主题 Markdown
与 topic 表确定性生成的统一查询索引，不承接 case 写入。新增、修改或删除测试节点
时，先维护 topic 表与对应单 case 文件，再运行
`bun run sync:test-evidence-catalog`；使用 `bun run check:test-evidence-catalog`
只读检查目录与索引新鲜度。
