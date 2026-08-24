// 此文件定义前端 CSS 构建的最后加工链：先展开 Tailwind 指令，再为产物补齐目标浏览器前缀。
// 它不拥有设计令牌或运行时主题状态；颜色与间距仍由 Tailwind 配置及源 CSS 变量提供。
// 插件缺失或转换失败应直接令构建失败，不能回退为未经处理的 CSS，以免线上样式静默降级。
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
