### Case RECORD-HISTORY-INDEX-001: 固定历史索引读取与诊断边界

Tests:
- `test:393250bece1580bf1da5ceda67009edfd2d7a92dc1204aa771670b8a3de91a52`
- `test:4c89d6e27ff3cb90e273c73cff9c9c2adf4f77358270ac27c267c203923ba42b`
- `test:7dd03f6fa48093513f55c3df602a2498442d609b5f64dbbe1e1d8b0e2741e0f7`
- `test:900941ea75648b9fd683b0eecc874bfa7fe2b2410bd87677a808dbe9ac9f34a0`
- `test:9ace52dfc5ac275f17cf72384990f07a92ec72898cd627b5e0d8925d27a2f227`
- `test:da32ef3c32f27532fea0a92de6d55e10abbabc8ac5fd943e47f2faac6b1bc485`
- `test:e9a149dd7ec4da92b507d7cb07756b46bdd707f8110b6ba0749411eb08062042`
- `test:ea734e35bc050365bb34cc748aa5718fb1371c0631a16511b75aa36342a3ab28`
- `test:ec70383b9f245cbf83e25832b9ac4e210ce30f9176219d8b04032afdd660f942`
- `test:fcdfff98ac8fcf956a13700b405433974a05c34b4e8a7a96418b886b0ca09175`

Tags:
- `decision-records`
- `git-integration`
- `investigation-report`

Contract:
- 固定 revision 索引只接受普通 Git blob 和严格 UTF-8；缺失与无效分别作为事实交给领域。
- 历史失败保留定位与原因，DR 阻断写入，IR 报告 warning；诊断定位可回查且不能注入终端控制行。

Proves:
- 共同矩阵区分缺失、普通与执行位、符号链接、非法编码及解析失败，并保留 revision 和 path。
- 真实 Git 中 DR 接受执行位并保留 HEAD 模式，损坏基线拒绝写入；IR 对非法 UTF-8 告警；两域在修复进入新提交后恢复。
- 真实 CLI 对历史目标路径的控制字符转义，不能产生额外输出行。
- 索引缺失后的历史枚举失败保留 revision、索引路径和底层系统原因，不能视为空历史。
- 共同分类覆盖兼容性 code、普通无效原因和系统原因优先级；领域继续决定恢复动作。
