### Case DECISION-DATED-IDENTITY-001: 普通 selector 先解析日期 ID 再回退名称

Tests:
- `test:1c1b00d40e286b63a4bef6ca3798cdcd725d29f7e2d7b014e81011e02efb213b`
- `test:3bf7f58daa5450a8bf308cb9cb0589f06920895e22a59a8b477cae8258b254a2`
- `test:6e56919fb89e4bb51212ada2533f77e031e8a75840147a713472e1b32ab0519f`
- `test:852a2b41680e9383e970e2e63926a2f56842d3a7ed9324c384311fbfa9ed730f`
- `test:bdfe96e7fd9b798e90947f0e051cb204f47e5246de71eb8568a5642f8dc9ed80`

Tags:
- `decision-records`

Contract:
- Decision 普通输入只移除一个 `.md` 后先精确解析 calendar-valid `YYMMDD-name`；仅解析失败才按 name 查找，文件 basename 不参与身份。
- `new` 自动加入当前 UTC 形成日，日期不匹配或完整 ID 已存在时零覆盖失败，legacy 同名允许。

Proves:
- 精确日期 ID（含 `.MD`）可读取；重复 name 的错误按 ID 顺序列出，非法日期前缀仍按完整 name 解析，而不存在的标准 ID 不会回退。
- 真实 Git stage 解析唯一 name 和一次大小写不敏感的 Markdown 后缀；工作区已同步新增可选，标准 ID 缺失不回退，缺失与歧义失败保持 pending tree 不变。
- name 创建的候选返回 UTC 日期完整 ID 并使用相同 basename；日期不一致失败，legacy 同名新建成功且原记录不变。
