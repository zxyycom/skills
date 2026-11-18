### Case RESOURCE-PLATFORM-EVIDENCE-001: 平台限定测试引用与本机覆盖

Tests:
- `test:1ad4938264d33700977f3c893fb4fa64538c2f38ced8f2d4f4ad2119694ece36`
- `test:3398979ce653c672574e66a2631bac4cc24caaf01edcc8894cda624d3ad13d76`
- `test:6b3352d02c1389b8200f46dd78c2ab22b0bea711f143385b2db0a50ede7c2e04`
- `test:e28ba02338b8a9057b6148f4617c546ede96d30762e3332c82cfa02bb3ddba87`

Tags:
- `test-evidence`

Contract:
- 项目检查区分平台声明的外平台节点、本平台缺失节点及未知引用；本机实体均须有 Case。

Proves:
- 双平台分类分别识别不可用、未知、本机缺失和反常出现；未知平台不豁免缺失引用。
- 私有项目实际生成本机快照并检查 Case：外平台引用报告为不可用，未知引用阻断；该检查不执行被枚举测试。
- 源码的删除、改名、cfg 变化和待确认指纹阻断；纯 CRLF 差异不改变身份。
- 冷快照与缓存命中时，检查期间 Git ignored Cargo 文件变化都会阻断成功，且无需依赖 Git 可见来源 revision。
