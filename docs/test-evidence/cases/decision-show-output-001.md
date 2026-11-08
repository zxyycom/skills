### Case DECISION-SHOW-OUTPUT-001: Show 读取当前正文并核对身份

Tests:
- `test:3b88c658f2cf70da23bb880d6e971be8ecef2ddd924c243c13b2c2608233492c`

Tags:
- `decision-records`

Contract:
- DR show 返回选中身份的当前完整正文，声明身份不符时失败。

Proves:
- show 返回当前正文（即使它不是完整合法正式文档），更改为其他 ID 后失败。
