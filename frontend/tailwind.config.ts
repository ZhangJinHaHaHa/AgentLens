import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// 该配置把组件源码中的实用类、CSS 变量设计令牌与动画插件编译成可发布样式；
// 它不切换主题，也不读取用户偏好，运行时的 light/dark 类由应用入口负责。
// content 范围只覆盖 React 应用壳与源码，独立的 public 演示页自带静态 CSS，故不应纳入类名扫描。
const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1280px"
      }
    },
    extend: {
      // 语义色仅引用全局 CSS 变量，确保暗色模式和品牌调整不需要改动组件类名。
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))"
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))"
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))"
        },
        danger: {
          DEFAULT: "hsl(var(--danger))",
          foreground: "hsl(var(--danger-foreground))"
        }
      },
      fontFamily: {
        // 字体列表按可用性逐级回退；中文与等宽字符均保留系统兜底，避免字体资源失败阻塞首屏。
        sans: [
          "Geist Sans",
          "Inter",
          "Noto Sans SC",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif"
        ],
        mono: [
          "Geist Mono",
          "JetBrains Mono",
          "Source Han Mono SC",
          "ui-monospace",
          "monospace"
        ]
      },
      fontSize: {
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["14px", { lineHeight: "20px" }],
        base: ["16px", { lineHeight: "24px" }],
        lg: ["18px", { lineHeight: "28px" }],
        xl: ["20px", { lineHeight: "30px" }],
        "2xl": ["28px", { lineHeight: "36px" }],
        "3xl": ["32px", { lineHeight: "40px" }],
        "4xl": ["40px", { lineHeight: "48px" }],
        "5xl": ["48px", { lineHeight: "56px" }],
        "6xl": ["64px", { lineHeight: "64px" }],
        "8xl": ["96px", { lineHeight: "96px" }]
      },
      borderRadius: {
        lg: "8px",
        md: "6px",
        sm: "4px"
      },
      keyframes: {
        // Radix 高度变量是手风琴动画的跨组件契约，不能替换为固定高度，否则动态内容会被裁剪。
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" }
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" }
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" }
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.4s ease-out",
        "slide-up": "slide-up 0.4s ease-out"
      }
    }
  },
  plugins: [animate]
};

export default config;
