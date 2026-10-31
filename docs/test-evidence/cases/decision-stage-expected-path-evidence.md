### Case DECISION-STAGE-EXPECTED-PATH-EVIDENCE-001: 预期路径的失败不能被同 ID 他处来源遮蔽

Tests:
- `test:0e87e1290eb46e3e6b2e9d6573cdac588cd6b946888387e262f4a24030d08780`

Tags:
- `decision-records`

Contract:
- 选中更新的 expected sourcePath 仍存在时，该位置的可读性、普通文件与身份要求必须先满足，不能把另一路径同 ID 当成功移动。

Proves:
- 另一普通路径仍声明原 ID 时，expected 路径非法 UTF-8、改 ID、改目录、符号链接与读取错误分别被拒绝；系统读取错误保留 filesystem 类别。
