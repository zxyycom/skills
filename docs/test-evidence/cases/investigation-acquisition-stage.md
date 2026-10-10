### Case INVESTIGATION-ACQUISITION-STAGE-001: domain 暂存批量取得事实且独立写前复核

Tests:
- `test:6ef460a926d427834a0dadaa1646d72d1dce8789a17ffaa90d7e629b751d6e24`
- `test:ac733a647c9412bec77f02528573e629fc35303e3e2b575181e0ec4204374dd2`

Tags:
- `investigation-report`

Contract:
- domain stage 保留全集合法性门禁，并在准备和复核两阶段独立批量读取成员、来源字节与表示，任何漂移或非法资源 owner 不写 pending。

Proves:
- 准备与复核各调用一次 workspace/HEAD 成员获取和一次批量来源读取；新增资源成员与报告来源漂移和非法 UTF-8 被结构化拒绝。
- 来源 revision 合法但正式资源 owner 引用非法的 stage 在 pending 写入前失败，pending 保持不变。
