### Case DECISION-DATED-IDENTITY-001: 普通 selector 先解析日期 ID 再回退名称

Tests:
- `test:2a40d776dfc28246f593aaf689cd6cbea2d82bf9f2cc2e1b58f2d698115c4ad7`
- `test:345efab281b29aefd66546147b5dd5e3667e33f845226163312fb818ed8e99d4`
- `test:3fc653998cbb1fdce0cf8fa9a850b9cdcac7ebc01472b40efbc08306ba954362`
- `test:7a8ddc173b00dbef22d60cef3772a2f65105b762273c6cb6f58732fdc7a3f28e`
- `test:aacdc760e0143f18722dc73083020079805f1744406e523b465fede7a247f506`

Tags:
- `decision-records`

Contract:
- Decision 普通输入只移除一个 `.md` 后先精确解析 calendar-valid `YYMMDD-name`；仅解析失败才按 name 查找，文件 basename 不参与身份。
- `new` 自动加入当前 UTC 形成日，日期不匹配或将与 legacy 同名冲突时必须零写入失败。

Proves:
- 精确日期 ID（含 `.MD`）可读取；重复 name 的错误按 ID 顺序列出，非法日期前缀仍按完整 name 解析，而不存在的标准 ID 不会回退。
- `stage` 在读取 pending 边界后，于 HEAD 基线和当前工作区可识别来源的并集内解析唯一 name；工作区单侧新增可选择，标准 ID 不会回退，歧义不会写入 pending。
- name 创建的候选保留 UTC 日期 ID 但使用 name 路径；日期不一致与 legacy 同名创建返回对应诊断。
