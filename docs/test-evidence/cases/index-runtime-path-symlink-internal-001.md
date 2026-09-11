### Case INDEX-RUNTIME-PATH-SYMLINK-INTERNAL-001: 在稳定符号链接布局中使用根内规范目标

Tests:
- `test:130e3448f65e64ffd75f8804c331b450de1b269cfb8262592cd1d7ba0a239c39`

Tags:
- `index-runtime`

Contract:
- 配置根目录自身或路径中的目录可以是符号链接，只要解析后的规范目标仍位于规范根目录内。

Proves:
- 符号链接根目录和根内目录符号链接两种稳定布局都把同步结果写入实际的根内目标。
- 两种布局随后都能从同一规范目标读取完整条目集合。
