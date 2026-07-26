# 测试证据账本

本账本覆盖 `package.json` 中 `test:*` 稳定入口保留的历史与当前测试。权威 case
正文位于 [`cases/`](cases/) 并按测试责任主题拆分；每个 case 对应测试框架能够
独立选择并单独报告的一个最小原生测试节点。

[`test-evidence-index.json`](test-evidence-index.json) 是从全部主题 Markdown
确定性生成的查询索引，不承接 case 写入。新增、修改或删除测试节点时，先维护对应
主题文件，再运行 `bun run sync:test-evidence-catalog`。
