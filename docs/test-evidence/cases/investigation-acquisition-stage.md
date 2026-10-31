### Case INVESTIGATION-ACQUISITION-STAGE-001: domain 暂存批量取得事实且独立写前复核

Tests:
- `test:100cd281c0bac94b0d32763e95eabf5009ee11670755852a390b3c072a1b24b1`
- `test:42a59cda31ccb12ef2e4365262e70075819b0192dc73b58c649fbb10e72cd3b2`

Tags:
- `investigation-report`

Contract:
- domain stage 验证局部所选来源与必要 owner，并在准备和复核两阶段独立批量读取可变成员、来源字节与表示，任何漂移或非法资源 owner 不写 pending。

Proves:
- 两次 acquisition 各调用一次 workspace 成员获取和一次批量来源读取，固定 HEAD 成员只取得一次并由只读 acquisition request 向后传递；相同来源产生相同写集，新增资源成员进入新写集，报告来源漂移与非法 UTF-8 返回结构化失败；测试不调用发布。
- 纯 stage index 定义对正式资源未由其 owner 直接引用的 metadata 图给出明确拒绝；该断言不调用 Git 或证明 pending 写入。
