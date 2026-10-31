### Case LIGHTWEIGHT-JUDGMENT-ADAPTER-008: Box 与结构化等级响应

Tests:
- `test:3d3e46b5307eb3969fe8224ef58a4dad1066a8e8106d41055407ace3cb7ff988`

Tags:
- `lightweight-judgment`

Contract:
- Jev Box 坐标与 confidence 保留原生含义，合法框不证明存在；结构化 Score legend 必须与请求结构相符。

Proves:
- 低 confidence 框不新增 absent；缺边、越界、反向与退化框拒绝；对象／数组 legend 原结构保留，错误结构拒绝。
