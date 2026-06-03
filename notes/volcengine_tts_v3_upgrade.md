# 火山引擎 TTS V3 升级笔记

> 日期: 2026-06-03  
> 任务: 将 volcengine_tts 从 V1 API 升级到 V3 HTTP Chunked API  
> 音色: zh_female_meilinvyou_uranus_bigtts (魅力女友 2.0)

---

## 涉及文件清单

| # | 文件路径 | 改动类型 | 说明 |
|---|---------|---------|------|
| 1 | `astrbot/core/provider/sources/volcengine_tts.py` | 重写 | V3 API 实现（鉴权、请求体、响应解析） |
| 2 | `astrbot/core/config/default.py` (~L1743) | 修改 | 默认配置值（旧字段→新字段，PATCH 注释标记） |
| 3 | `astrbot/core/config/default.py` (L2177-2228) | 修改 | CONFIG_METADATA_2 字段元数据（PATCH 注释标记） |
| 4 | `dashboard/src/i18n/locales/zh-CN/features/config-metadata.json` | 修改 | 中文翻译 |
| 5 | `dashboard/src/i18n/locales/en-US/features/config-metadata.json` | 修改 | 英文翻译 |
| 6 | `dashboard/src/i18n/locales/ru-RU/features/config-metadata.json` | 修改 | 俄文翻译 |
| 7 | `data/dist/` (整个目录) | 重建 | 前端构建产物（`npx vite build` → 复制到 data/dist） |
| 8 | `dashboard/src/composables/useConfigTextResolver.js` | 修复 | `translateIfKey` 降级逻辑：i18n 未命中时返回 `null` 而非 raw key 字符串（`# PATCH: 2026-06-03`） |
| — | `astrbot/core/provider/manager.py` | 未修改 | `dynamic_import_provider` 中 `volcengine_tts` case 已存在，类名不变无需改 |

---

## API 变更对照

| 项目 | V1 (旧) | V3 (新) |
|------|---------|---------|
| **接口地址** | `POST api/v1/tts` | `POST api/v3/tts/unidirectional` (HTTP Chunked) |
| **鉴权 Header** | `Authorization: Bearer; {token}` | `X-Api-Key: {api_key}` |
| **模型选择** | 无 | `X-Api-Resource-Id: seed-tts-2.0` |
| **响应格式** | 单次 JSON `{"data": "base64..."}` | NDJSON 流式 `{"audio":{"data":"base64..."}, "event":"..."}` |
| **API Key** | 旧版控制台 token | 新版控制台 API Key (console.volcengine.com/speech/new) |

## 配置字段变更

| 旧字段 | 新字段 | 范围 | 默认值 | 说明 |
|--------|--------|------|--------|------|
| `appid` | ❌ 移除 | — | — | 不再需要 |
| `volcengine_cluster` | `resource_id` | 6 种可选 | `seed-tts-2.0` | 模型/资源选择 |
| `volcengine_voice_type` | `speaker` | — | `""` | 音色 ID |
| `volcengine_speed_ratio` (0.2~3.0) | `speech_rate` (-50~100) | -50~100 | `0` | 语调（语速） |
| `volcengine_volume_ratio` ❌ | `loudness_rate` | -50~100 | `0` | 音量 |
| — | `pitch` | -12~12 | `0` | 音调 |
| — | `emotion` | 字符串 | `""` | 情感参数 |
| — | `emotion_scale` | 1~5 | `4` | 情感强度 |
| — | `format` | mp3/ogg_opus/pcm | `mp3` | 音频格式 |
| — | `sample_rate` | 8000~48000 | `24000` | 采样率 |
| — | `bit_rate` | 数字 | `128000` | MP3 比特率（旧版默认 8k 音质差） |
| — | `model` | 字符串 | `""` | 模型子类型（仅 ICL 2.0） |
| `api_base` | `api_base` | — | `.../v3/tts/unidirectional` | URL 已更新 |
| `timeout: 20` | `timeout: 30` | — | `30` | 适当增加 |

## resource_id 可选值

| 值 | 对应模型 | 音色后缀 |
|----|---------|---------|
| `seed-tts-2.0` | 豆包语音合成 2.0 | `_uranus_` |
| `seed-tts-1.0` | 豆包语音合成 1.0 | `_mars_` / `_moon_` |
| `seed-tts-1.0-concurr` | 豆包语音合成 1.0 并发版 | 同上 |
| `seed-icl-2.0` | 声音复刻 2.0 | — |
| `seed-icl-1.0` | 声音复刻 1.0 | — |
| `seed-icl-1.0-concurr` | 声音复刻 1.0 并发版 | — |

## 前端 i18n 加载机制

- **源文件**: `dashboard/src/i18n/locales/{locale}/features/config-metadata.json`
- **加载方式**: `I18nLoader` 通过动态 `import()` 在构建时打包进 JS bundle
- **关键**: 修改源文件后必须 `npm run build` 重新构建 `data/dist/`，否则 WebUI 显示 i18n key 原文

## 构建前端步骤

> 笔记文件位置: `notes/volcengine_tts_v3_upgrade.md`

```powershell
cd dashboard
npm install           # 安装依赖（首次，本次已执行）
npx vite build        # 跳过 vue-tsc 类型检查直接构建（推荐）
# 或 npm run build    # 包含类型检查，可能因其他文件报错而失败

# 将构建产物复制到 data/dist/
Remove-Item -Recurse -Force ../data/dist/* -ErrorAction SilentlyContinue
Copy-Item -Recurse dist/* ../data/dist/
# 注意: t2i/ 目录可能因为已存在而报错，单独执行:
Copy-Item -Recurse -Force dist/t2i/* ../data/dist/t2i/
```

## 易错点排查

1. **音色与 resource_id 不匹配**: `_uranus_` 后缀音色必须用 `seed-tts-2.0`
2. **bit_rate 未设置**: MP3 格式默认 8k，必须显式设为 128000
3. **i18n 必须重建 dist**: 仅改 i18n 源文件不生效，必须 Vite build → 复制到 data/dist/

新增注意事项（2026-06-03 修复）:
6. **i18n 降级显示 raw key**: `useConfigTextResolver.js` 中 `translateIfKey` 原本在 i18n 未命中时返回 raw key 字符串（如 `provider_group.provider.xxx.description`），导致前端直接显示 key 原文。已修复为返回 `null`，使模板的后备机制（`|| fieldName`）生效
4. **API Key 来源**: 必须在**新版**控制台 (speech/new) 获取，旧版 token 不可用
5. **旧配置残留**: WebUI 中需删除旧的 volcengine_tts 条目后重新添加

## 当前修改状态

> 最后更新: 2026-06-03 18:00 (i18n 降级修复 + dist 重建)

| 层级 | 文件 | 状态 | 验证方式 |
|------|------|:---:|---------|
| 后端 API | `volcengine_tts.py` | 已部署 | 重启后生效，通过 TTS 测试功能验证 |
| 后端配置 | `default.py` (默认值 + metadata) | 已部署 | 重启后 API 返回新字段名 |
| 前端翻译 | `config-metadata.json` (zh-CN/en-US/ru-RU) | 已修改 | 已编译进 JS bundle |
| 前端 i18n 降级 | `useConfigTextResolver.js` | 已修复 | `translateIfKey` 未命中时返回 `null`，备用字段名生效 |
| 前端 dist | `data/dist/` (Vite 构建产物) | 已重建 | 564 个文件，主 bundle 4,072,066 bytes |
| 路由注册 | `manager.py` | 无需修改 | `dynamic_import_provider` 中 `volcengine_tts` case 已存在 |

## 预期 WebUI 效果

重启 AstrBot 并强制刷新浏览器 (`Ctrl+Shift+R`) 后，进入「模型提供商 → 文字转语音 → 新增 火山引擎_TTS(API)」，应看到：

```
api_key                          → 输入框（无标签，通用字段）
模型/资源选择                     → seed-tts-2.0
发音人                            → 输入框
音频格式                          → mp3
采样率                            → 24000
比特率                            → 128000
语调(语速)                        → 0
音量                              → 0
音调                              → 0
情感                              → 输入框
模型子类型                        → 输入框
API Base URL                     → https://openspeech.bytedance.com/api/v3/tts/unidirectional
超时时间                          → 30
代理地址                          → 输入框
```

每个字段下方有对应的 hint 提示文字。如果仍显示 `provider_group.provider.xxx.description` 格式的 raw key，说明浏览器或服务端有缓存，见下方排查步骤。

## i18n 翻译查找链路

修改一个字段的描述文本需要触及 **3 层**，缺一不可：

```
1. default.py CONFIG_METADATA_2
   ↓ description: "模型/资源选择"
   ↓
2. ConfigMetadataI18n.convert_to_i18n_keys()  (服务端)
   ↓ 转换为 → description: "provider_group.provider.resource_id.description"
   ↓
3. API /api/config/provider/template 返回给前端
   ↓
4. 前端 useConfigTextResolver → translateIfKey()
   ↓ 调用 getRaw("provider_group.provider.resource_id.description")
   ↓ 实际查找路径: translations.features['config-metadata'].provider_group.provider.resource_id.description
   ↓ **v1.1 修复**: 若 getRaw 返回 null → translateIfKey 返回 null → 模板降级显示字段名（而非 raw key 字符串）
   ↓
5. translations.ts 静态 import config-metadata.json  → Vite 打包进 JS bundle
   ↓
6. 显示中文: "模型/资源选择"
```

**如果任一层缺失**：
- 缺第 1 层 → 后端返回旧字段名，前端找不到对应表单项
- 缺第 2 层 → API 返回原始中文而非 i18n key，前端 `translateIfKey` 无法识别
- 缺第 3~5 层 → 前端拿到 i18n key 但翻译表里找不到，回退显示 key 原文（当前症状）

## 缓存排查步骤

如重启后仍显示 raw key：

1. **强制刷新浏览器**: `Ctrl + Shift + R` (Windows) / `Cmd + Shift + R` (Mac)
2. **无痕模式测试**: 打开隐私窗口访问 `http://localhost:6185`，排除浏览器缓存
3. **检查 API 响应**: 浏览器访问 `http://localhost:6185/api/config/provider/template`，搜索 `resource_id`，确认 description 字段值为 `provider_group.provider.resource_id.description`（i18n key 格式，非中文原文）
4. **检查 JS 加载**: F12 → Network → 刷新页面 → 确认主 JS bundle（如 `index-6epWLFox.js`）返回 200（非 304 缓存）
5. **检查 Console**: F12 → Console，看是否有 `[MISSING: ...]` 或红色报错
