### Case INVESTIGATION-HISTORY-INDEX-DIAGNOSTICS-001: 历史索引错误可定位且修复须进入新 HEAD

Tests:
- `test:4bd890a8686bfaddff24a441d253be888764580eda885f96f8a79f81fee75593`
- `test:5a3c601118ab30cdd0eb98d37deafbd02a8eef6dcbf2f64b293485d5cf819a97`

Tags:
- `git-integration`
- `investigation-report`

Contract:
- 前序历史检查只信任固定 HEAD 的合法索引；无效时保留可定位的解析或校验诊断，不伪造前序未记录结论。
- 工作区修复不能代替历史基线；经验证的修复进入新提交后，再检查新的 HEAD。

Proves:
- 隔离真实 Git 中，健康索引无 warning；分别提交截断 JSON 与不兼容 definitionVersion 后，即使工作区索引恢复健康，仍返回唯一 history-check-unavailable，分别展示 revision、索引 path、对应原因 code 与 detail；JSON 损坏提示验证并提交修复，不兼容则提示核对 compatibility 和 migration。
- 将健康索引纳入后续新提交后，同一前序历史入口恢复无 warning；损坏基线不被报告为前序未进入 HEAD。
