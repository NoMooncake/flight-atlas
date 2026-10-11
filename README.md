# 飞行足迹 · Flight Atlas

在可缩放的二维地形地图上，串联已完成的模拟飞行航程。

**打开网页：https://nomooncake.github.io/flight-atlas/**

当前记录：上海浦东 → 香港 → 胡志明市 → 曼谷，共 3 段航程、4 座机场。

## 使用

- 拖动平移、滚轮或加减按钮缩放地图。
- 点击左侧航程，聚焦对应航段。
- 勾选「显示航点」，查看沿途航点；标注会随缩放和屏幕间距调整。
- 「航程总览」显示所有已完成航程，「世界地图」切换到全球范围。

## GitHub Pages

本仓库是无需构建的静态网站。入口为根目录 `index.html`。

在 **Settings → Pages** 中，发布来源为 **Deploy from a branch**，分支为 **main**，目录为 **/(root)**。`.nojekyll` 用于直接发布静态文件。提交到 `main` 后，GitHub Pages 会自动更新。

## 文件与维护

- `index.html`：页面入口。
- `map.js`：地图、航段交互与标注避让。
- `style.css`、`map.css`：页面和地图样式。
- `routes.json`：网页读取的航程、机场、航点数据。
- `routes.geojson`：同一航路的地理数据导出。
- `assets/`：本地打包的 Leaflet 及其许可证。

追加航程时，保留历史航程，在 `routes.json` 中追加航段，并同步更新 `routes.geojson`。航段列表、里程、机场数量和当前目的地由数据生成。

本地预览：在仓库根目录运行 `python -m http.server 8000`，浏览器打开 `http://localhost:8000/`。底图需要联网加载。

## 数据与说明

航路根据提供的模拟飞行计划和 AIRAC 2610 航点重建，不是实飞 GPS 记录。虚线表示引导或非定点航段的示意连接；程序转弯以点间连线简化。仅用于模拟飞行记录。

地图使用 Esri/National Geographic 分级地形底图，城市尺度切换到 Esri World Topographic Map。完整地图署名显示于网页底部。Leaflet 1.9.4 使用 BSD-2-Clause 许可证，见 `assets/leaflet-LICENSE.txt`。第三方地图、导航数据的权利属于各自提供方，本仓库不另行授予这些数据的使用权。
