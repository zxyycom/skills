### Case RESOURCE-PLATFORM-EVIDENCE-001: 平台限定测试引用与本机覆盖

Tests:
- `test:1ad4938264d33700977f3c893fb4fa64538c2f38ced8f2d4f4ad2119694ece36`
- `test:3398979ce653c672574e66a2631bac4cc24caaf01edcc8894cda624d3ad13d76`
- `test:e28ba02338b8a9057b6148f4617c546ede96d30762e3332c82cfa02bb3ddba87`
- `test:f292d84b0e582bc7268bfa3647b483f863678dbaf6c0b856555b78c9b3379f75`

Tags:
- `test-evidence`

Contract:
- 项目检查区分平台声明的外平台节点、本平台缺失节点及未知引用；本机实体均须有 Case。
- 缓存只复用同一来源的枚举实体；Case 引用仍在每次运行计算。

Proves:
- 双平台分类分别识别不可用、未知、本机缺失和反常出现；未知平台不豁免缺失引用。
- 外平台引用报告为不可用；后续复用本机实体时仍会阻断新添的未知引用。登记轨迹区分了复用与重新枚举。
- 普通 Rust 源文件改动触发重新枚举，外平台声明仍有效。
- 真实 Cargo 枚举确认按 locator 派生的声明身份；本机节点误标为外平台、cfg 切换导致本机声明缺失均阻断。
- 冷快照与缓存命中时，检查期间 Git 忽略的 Cargo 源文件变化都由同一自动快照 revision 检出并阻断。
