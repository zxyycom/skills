### Case CHANGE-PLAN-SOURCE-INCOMPATIBLE-001: 可解析但 API 不兼容的宿主依赖显式恢复

Tests:
- `test:7528bd812b5210effbe380c71ebe68fa260d31ae8ec6f9222460aabf338e6a40`

Tags:
- `change-plan`
- `distribution`

Contract:
- Node 正常解析宿主依赖；API 实际不兼容时保留原始失败并提供显式 frozen 恢复指引，不隐式修改依赖。

Proves:
- 宿主 valibot 包能解析但缺失当前 API 时启动失败，输出实际类型/导出错误、frozen 命令及未自动安装说明；fixture 内容保持不变。
- 显式 frozen 安装 skill 的随包基线后恢复执行，无需增加来源或精确版本门禁，也不改写宿主不兼容包。
