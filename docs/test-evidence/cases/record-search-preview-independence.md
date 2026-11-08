### Case RECORD-SEARCH-PREVIEWS-001: 预览受限不影响记录身份与完整扫描

Tests:
- `test:39fa9355618c8ab15e816cd6c254475b0acded804d35d807e7632d23d5c7584f`
- `test:5036447766aa136e06dbc1506144875da8dc01a08c35688a215d4cd83cabdf60`
- `test:ccd35ac719bbc7ba43a90eea3915880ef91c16268f79bc4bcc07e66e8da8d209`
- `test:dd5ac7835ff3fc8cc072fbc5e54a90c392e58964a452fe5d03dfa8480faebe36`

Tags:
- `record-search`

Contract:
- 预览预算限制不截断命中身份，命中范围以原始 UTF-16 单位表示。

Proves:
- DR 真实 CLI 在命中次数或字符恰好上限时不标截断，超限才报告相应原因；字符预算耗尽后仍返回后续命中身份和精确计数。共享 matcher 节点单独校验归一化后回映原 UTF-16 范围。
- 共享文件搜索另验证预览字符或范围上限不丢后续身份、不停止完整扫描。
