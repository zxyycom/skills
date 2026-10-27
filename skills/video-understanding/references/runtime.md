# 运行环境与维护

本文承接执行前置、媒体数据流、依赖准备与支持资格。日常调用先核对执行支持和所选操作的阶段依赖；安装或更新时进入[环境维护](#环境维护范围)。启动与位置见[本地工具入口](local-tools.md)，材料恢复见[证据管理](local-evidence.md)。

## 执行支持

Node 24.18+ 原生执行公开 `scripts/video.ts`，运行时 TS 位于包内 `scripts/runtime/`。Bun 可运行同一源码，其支持范围以所用版本的独立包验证为准；兼容 npm 依赖按[随包依赖维护](#随包依赖维护)准备。

媒体采集面向 Windows；Linux/macOS 不在声明范围。验证按层结算：`--help` 证明启动，源码与制品 fixture 证明实际断言的行为，使用者机器上的媒体栈、网站与模型按下方前置和资格验收另行核对。

## 分阶段前置条件与缺失路径

| 阶段 | 所需依赖与结果 |
| --- | --- |
| `help` / `read` / `logs` / `refine` | 上节支持的 Node/Bun 与随包资源；已有证据按当前性、完整性与引用契约检查 |
| `prepare` / `frames` 新媒体读取 | 显式或配置 `appRoot`、`venv/Scripts/python.exe`、PyAV 与 FFmpeg；缺失报告运行时/依赖阶段 |
| `prepare` 进入 ASR | 同一 venv 的 Whisper CLI、所选模型的已准备缓存；缺失报告模型/转录阶段，保留已取得材料 |
| `prepare --source hard-ocr` | VideOCR 独立安装槽、安装清单及本地模型；先按下节核对资格，缺项在启动前阻断 |
| `ocr --frames ...` | 已保存有效 F、RapidOCR 独立 venv、本地 ONNX 模型及清单；不重新解码视频，不使用 Whisper venv |

FFmpeg 从 appRoot 内 `mcp-video-analyzer/package.json` 解析其 `ffmpeg-static` 依赖；该 package 提供锁定媒体依赖。媒体进程读取随包 [runtime.env](../scripts/runtime.env)，数据流与环境见[下文](#媒体数据流与隔离)。

缺依赖时报告所需准备及受影响操作，已有材料仍可读取。npm 依赖进入[随包依赖维护](#随包依赖维护)，媒体依赖进入[ASR 与通用媒体](#经授权的安装或恢复)或[OCR 槽](#经授权准备-ocr-槽)。

## OCR profile 与资格

当前两条路线均为**待资格验证**。固定 profile 面向 Windows x64 CPU，使用本地模型及显式程序路径；其他系统、GPU、云端、引擎和模型另验。支持声明以文末[资格验收](#支持资格验收)为准。

| Profile | 独立槽与接口 |
| --- | --- |
| VideOCR 1.6.0 | `appRoot/tools/videocr/1.6.0/`；官方 CPU CLI，PaddleOCR PP-OCRv6 small；一次处理整个输入的一个编码像素 ROI |
| RapidOCR 3.10.0 | `appRoot/tools/rapidocr/3.10.0/`；Python API + ONNX Runtime CPU，PP-OCRv6 small det/rec、PP-OCRv4 mobile cls；对已有 PNG 整帧／区域处理 |

下载源、模型文件名和 SHA256 由[ocr-profiles.json](../runtime/ocr-profiles.json)维护，各槽的 `installation.json` 记录实际程序、模型与依赖。入口预检程序、本地模型及 hash，缺项在启动前失败。VideOCR 关闭繁转简、跳帧 0、禁用调试图保存并允许系统休眠；RapidOCR 返回真实 API 数据，坐标与空观察见[画面操作](frame-text.md)。

### 网络与本地配置

安装和模型准备按授权联网。VideOCR 使用本地 Paddle 引擎与模型目录；RapidOCR 的 det/rec/cls 均指定本地 ONNX，识别模型自带字符表，适配仅序列化框／文字／分数。这些显式输入避开了已核对路径中的自动模型、字典、字体下载与图像上传型 Google Lens。

本地模型配置只约束上述调用路径，不证明冻结包及全部传递依赖离线。首次建立支持声明或变更依赖时，核对实际安装的 VideOCR、PaddleX 和 RapidOCR 版本、源码及联网行为；模型源检查变量不是通用禁下载开关。

工具、模型、后端升级，或启用 Lens、远端输入、可视化时，重新核对联网触发、目的地与数据流。素材外发和网络规则变更分别授权。

## 媒体数据流与隔离

ASR 固定 CPU/int8、VAD，使用预备本地模型与离线策略；OCR 使用上节的独立 CPU profile 和本地配置，网络范围分别判断。

媒体进程使用最小环境，排除无关 Python 路径、云 key、cookie 和模型 token；临时物进入应用槽或证据操作目录，进程回收另验。这不是文件／网络 sandbox；宿主模型可能接收文字和图片，私人素材按实际数据流授权。

## 环境维护范围

以下内容用于安装、升级、复制、恢复依赖和建立支持声明。执行前确认目标、影响、权限及回退；安装、下载、覆盖、删除和停止进程按对应授权进行，保持全局 PATH 与无关运行时不变。

### 分发与运行数据

| 组成 | 内容与位置 |
| --- | --- |
| Skill 包 | 公开 TS 入口、包内运行时、媒体 Python、ASR 离线环境策略、独立 manifest／锁文件及配置示例；完整包显式安装依赖后可在维护仓库外使用 |
| 外部运行时 | Node/Bun、Windows Python 3.12、PyAV、FFmpeg、Whisper 与模型；OCR 使用上文声明的独立 CPU profile，按需授权准备 |
| 媒体运行时根 | `appRoot` 承接既有 `node_modules/`、Whisper `venv/` 与缓存；OCR 独立放 `tools/<tool>/<version>/`，包内 `runtime/` 保存安装源 |
| 证据目录 | 保存 manifest、不可变产物、运行记录与诊断；`.process/` 承接临时工作物，原素材保持原样 |

运行数据与媒体运行时位于 skill 外。精确位置、配置失效、复制和更新保留由[稳定位置与显式目录](local-tools.md#稳定位置与显式目录)统一规定；只读与纯复用无需加载媒体运行时。

### 网站获取工具

网站获取与本地证据处理独立。需要文件且获准安装时，按[网站获取工具准备与验收](website-tool-setup.md#网站获取工具)准备下载器及依赖；材料获取和认证范围由[网站材料获取](online-sources.md)承接。

#### 核对与交接

配置加载、依赖发现、实际后处理和网站获取须分别验收并交接；完整步骤见[核对与交接](website-tool-setup.md#核对与交接)。

### 经授权的安装或恢复

以下步骤准备通用媒体与 ASR 运行时；OCR 使用[独立槽准备](#经授权准备-ocr-槽)。核对已授权的 `appRoot` 与现有消费者，更新时确认媒体任务已结束；下载保持原 TLS 校验与包源。

1. 准备 Windows pnpm 与 Python 3.12。将包内 `runtime/` 的 [package.json](../runtime/package.json)、[pnpm-lock.yaml](../runtime/pnpm-lock.yaml)、[pnpm-workspace.yaml](../runtime/pnpm-workspace.yaml)、[requirements.txt](../runtime/requirements.txt)、[prepare-model.py](../runtime/prepare-model.py) 复制到授权的外部 app-root；已有文件先保留成套安装源与锁文件供回退。
2. 在 app-root 执行 `pnpm install --frozen-lockfile`，恢复锁定媒体依赖与声明的应用内 Node。构建许可只放行 FFmpeg、sharp 所需脚本；Tesseract 赞助提示和 tldjs 可选规则更新保持禁用。
3. 在 app-root 执行 `python -m venv venv`，将本次进程 PIP_CACHE_DIR 指向 app-root 的 `cache/pip`，再执行 `venv/Scripts/python.exe -m pip install -r requirements.txt`。清单固定直接 Python 依赖；换机器时重建 venv。
4. 在 app-root 用同一 venv 执行 `venv/Scripts/python.exe prepare-model.py --model small`，显式联网准备权重。准备脚本按其所在目录写 `cache/huggingface/`，所以必须从复制后的 app-root 脚本执行；切换模型先准备匹配权重再修改调用参数。
5. 用独立 CLI 和合成素材核对受影响边界：字幕、内嵌文本字幕、ASR、复用、少量 PNG、非零起点阻断、多音轨、空/失败/中断状态。安装成功不证明素材理解质量；只有已执行的边界才能报告通过。

下载或安装失败时保留诊断与已取得缓存，解决对应阶段后显式重试。回退成套安装源与依赖锁文件，再核对受影响边界；保留原素材与证据。删除安装目录、模型或缓存另行确认精确目标与授权。

### 随包依赖维护

第三方依赖由包根 `package.json` 与 `pnpm-lock.yaml` 声明，Node 正常解析到的兼容宿主依赖也可复用。独立安装、缺失／不兼容恢复或复现锁定基线时，使用 manifest 固定的 pnpm：

```text
pnpm --dir "<skill-directory>" install --ignore-workspace --prod --frozen-lockfile --config.node-linker=isolated
```

启动、help、导入、检查及 updater 不隐式安装。加载失败时保留诊断并显式恢复依赖；包文件或 manifest／锁文件损坏时先重新取得完整包。安装副本 TS 可直接修改，无需构建，更新会覆盖正式包中的同路径定制。源码更新与依赖兼容分别验收；媒体依赖由 `runtime/` 安装源单独维护，不随程序包更新而升级外部环境。

### 经授权准备 OCR 槽

OCR 安装按授权联网，使用独立版本槽，保留既有槽与 Whisper venv。运行[prepare-ocr.py](../runtime/prepare-ocr.py)前核对所选[安装 profile](../runtime/ocr-profiles.json)与 RapidOCR [完整依赖 hash lock](../runtime/rapidocr-requirements-lock.txt)；安装使用 require-hashes 与仅二进制 wheel，不从 sdist 执行构建：

```powershell
python "$skill/runtime/prepare-ocr.py" --app-root "$appRoot" --tool videocr --extractor "$tarExe"
python "$skill/runtime/prepare-ocr.py" --app-root "$appRoot" --tool rapidocr
```

`$tarExe` 是已存在且已核对的 Windows tar.exe 绝对路径；不自动下载安装解压器。RapidOCR 使用 Windows Python 3.12，在独立槽新建 venv。准备脚本拒绝覆盖现存槽，将下载、依赖安装、模型 hash 和清单发布分别核对；完整安装源与锁定清单随升级共同交付。槽准备完成后，按下节验证实际支持范围。

安装中断时保留诊断，重试前确认槽状态与精确恢复目标。回退恢复成套安装源、依赖锁及对应槽，再核对受影响边界；原素材与已发布材料保持不变。删除槽、模型或缓存按精确目标另行授权。

### 支持资格验收

安装者／维护者在首次声明支持或工具、模型、后端变化后核对；单次实施进度由相应任务记录，不写入常规使用路线。

每条路线的支持声明须有以下直接证据：

1. 中英文／空格路径、首次启动、缺模型、无文字、损坏输入、复用与 fresh、超时／取消确定结算；输出不越出指定目录，失败保护既有证据，退出无遗留工具进程。网络依赖由[OCR profile 与资格](#ocr-profile-与资格)中的上游核对说明，不将断网试验列为资格门槛。
2. 许可明确的合成或授权真值：硬字幕至少两段 30–60 秒中英横排、短字幕及无字幕间隙视频；frame-ocr 至少六帧含中英、数字、区域裁剪和无字。清晰横排 profile 字符错误率各 ≤5%；硬字幕至少 90% 的非空字幕起止点分别偏差 ≤0.5 秒。
3. 有差异字幕／原音片段完成显式 ASR、多来源查询、实际看图及授权播放器回听、采用／校正、effective 回读与撤销。无法回听时保留原音未核实，不能勾作音频核实通过。

记录版本、模型、样本许可、覆盖、真值、误差、耗时与人工修正量。失败阻塞对应支持资格，报告具体阶段并保留已发布材料，不把吞掉的异常登记 empty；替换工具、外发素材或缩减目标须重新审阅授权。
