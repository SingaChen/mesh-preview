# mesh-preview

Mobile-friendly WebGL previewer for SingaLab knitting mesh outputs.

在手机（Android Chrome）或桌面上打开项目文件夹 / 清单，轨道旋转查看网格，用滑条切换迭代。无需后端。

Open a project folder or manifest, orbit the mesh, and use sliders for iterations and display modes. Target: **Android Chrome** (desktop works too).

## 手机上打开 / Open on a phone

**首选 / Primary — GitHub Pages（任意网络，不必同一 Wi-Fi）：**

**https://singachen.github.io/mesh-preview/**

每次推送到 `main` 后，GitHub Actions（`.github/workflows/deploy-pages.yml`）会 `npm ci` → `npm run build`，并把 `dist/` 部署到 Pages。仓库 **Settings → Pages → Source** 需设为 **GitHub Actions**（首次由仓库管理员开启）。

在 **Android Chrome** 打开该地址后：

- **文件夹 Folder** / **文件 Files** 仍从**手机本地**读取 OBJ 或清单（不上传服务器）。
- **示例 Sample** 加载站点内置袖筒网格。

生产构建会用 Service Worker 缓存同源资源，刷新可离线打开应用壳。

## Quick start（本机开发 / Local, secondary）

```bash
npm install
npm run dev
```

Vite `base` 为 `/mesh-preview/`，浏览器打开终端里的地址（一般为 `http://localhost:5173/mesh-preview/`）。页面会自动加载内置示例袖筒网格。

同一局域网调试时，电脑运行 `npm run dev`（已加 `--host`），手机打开终端打印的 Network 地址（需带 `/mesh-preview/`）。公司网络可能隔离客户端。

生产构建：

```bash
npm run build
npm run preview
```

`npm run build` 输出静态文件到 `dist/`，资源路径带 `/mesh-preview/` 前缀，对应项目 Pages 子路径。`npm run preview` 预览地址一般为 `http://localhost:4173/mesh-preview/`。

## 打开 SingaLab 输出 / Load a project

顶部按钮：

| 按钮 | 作用 |
| --- | --- |
| **文件夹 Folder** | 桌面 Chrome：File System Access 选目录。Android Chrome：回退为 `webkitdirectory` 多文件选择。 |
| **文件 Files** | 多选 `.obj` / 清单 `.json`（Android 上最稳）。 |
| **示例 Sample** | 重新加载内置 `public/sample/`。 |

没有清单时，会收集选中的 Wavefront OBJ，按文件名自然排序（`iteration_00_…` 在前）。文件名含 `overlay` / `field` / `stitch` / `KnittingStitches` 的 OBJ 会当作叠加层。

手势：

- 单指拖动：旋转 orbit
- 双指捏合：缩放；双指拖：平移 pan
- **适应 Fit**：框住当前网格
- 底部大滑条：在已加载网格 / 迭代间切换
- **线框 Wire** / **平面 Flat** / **叠加 Overlay**

## 清单 schema / Manifest schema

可选。放在项目根目录，文件名建议 `manifest.json`：

```json
{
  "name": "sample-sleeve",
  "outputs": [
    { "label": "iter 0 · cut", "mesh": "iteration_00_cut_body.obj" },
    {
      "label": "iter 1 · cut",
      "mesh": "iteration_01_cut_body.obj",
      "overlay": "iteration_01_KnittingStitches_field.obj"
    }
  ]
}
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `name` | 否 | 项目名 |
| `outputs` | 是 | 滑条上的条目，建议时间序（最新可放最后；打开后默认显示最后一项） |
| `outputs[].label` | 否 | 短标签，中英均可 |
| `outputs[].mesh` | 是 | 相对清单目录的 Wavefront OBJ（也接受 `obj` / `path`） |
| `outputs[].overlay` | 否 | 叠加 OBJ（针迹 / field 等，也接受 `field`） |

也支持无清单直接打开例如 `iteration_*_cut_*.obj`、`KnittingStitches` / field OBJ。

内置示例：`public/sample/`（可用 `npm run generate-sample` 重新生成）。

## 范围 / Scope

MVP 包含：静态站、本地文件、OBJ、可选清单、触摸轨道、滑条、线框/平滑/叠加、适应视野、离线应用壳。

不做：原生 Android、账号、云同步、完整 `readable_map` 编辑器。

## 技术

Vite + Three.js（`OrbitControls` + `OBJLoader`）。无后端。
