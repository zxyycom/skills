### Case NATIVE-RECORD-SOURCE-WRITE-CONFIGURED-DEFAULT-001: 配置默认写源用于创建与预检

Tests:
- `test:04aff8e154e55cda67387b3091b6494dbbc814e1e43163c3ab4d495014691cd5`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 未显式选择的写操作和预检使用 defaultWriteKey，读取仍使用独立的 defaultKey；预检不修改现场。

Proves:
- 双来源读取默认与指向 first 的写默认并存时，list 仍返回 related；new 仅在 first/research/reports 创建候选，不写 second 或当前工作区 docs。
- 随后未传 key 的 rename --preflight 能找到该候选并成功，整个私有 fixture 的目录与字节不变。
