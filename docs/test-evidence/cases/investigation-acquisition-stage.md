### Case INVESTIGATION-ACQUISITION-STAGE-001: domain 暂存批量取得事实且独立写前复核

Tests:
- `test:6ef460a926d427834a0dadaa1646d72d1dce8789a17ffaa90d7e629b751d6e24`
- `test:ac733a647c9412bec77f02528573e629fc35303e3e2b575181e0ec4204374dd2`

Tags:
- `investigation-report`

Contract:
- domain stage 验证局部所选来源与必要 owner，并在准备和复核两阶段独立批量读取可变成员、来源字节与表示，任何漂移或非法资源 owner 不写 pending。

Proves:
- 两次 acquisition 各调用一次 workspace 成员获取和一次批量来源读取，固定 HEAD 成员只取得一次并由只读 acquisition request 向后传递；相同来源产生相同写集，新增资源成员进入新写集，报告来源漂移与非法 UTF-8 返回结构化失败；测试不调用发布。
- 纯 stage index 定义对正式资源未由其 owner 直接引用的 metadata 图给出明确拒绝；该断言不调用 Git 或证明 pending 写入。
