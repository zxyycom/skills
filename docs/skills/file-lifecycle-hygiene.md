# File Lifecycle Hygiene

`file-lifecycle-hygiene` 是面向 agent 自行安排的文件输出、复制、移动与留存的风格型 skill。它让最终产物容易找到，让保留的回退、过渡等辅助物有可理解的来源、形成时间和后续处理方式。已有项目或工具 owner 的正常输出继续按原契约处理。

这个 skill 提供可按场景取舍的归位习惯，不建立统一目录门禁。`.tmp/`、`.backup/` 是可选位置；需要留存说明时，以同名 `.artifact-note.md` 旁注和 `file-lifecycle-hygiene` 标识帮助后续识别，并区分产物形成时间与状态确认时间。普通短命文件随操作收尾即可。

实际 skill 位于 [`skills/file-lifecycle-hygiene/`](../../skills/file-lifecycle-hygiene/)。
