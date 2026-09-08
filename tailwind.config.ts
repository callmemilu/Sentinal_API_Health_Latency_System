import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      keyframes: {
        flipX: {
          "0%": {
            opacity: "0",
            transform: "perspective(1200px) rotateX(-90deg)",
          },
          "60%": {
            opacity: "1",
            transform: "perspective(1200px) rotateX(15deg)",
          },
          "85%": {
            transform: "perspective(1200px) rotateX(-6deg)",
          },
          "100%": {
            opacity: "1",
            transform: "perspective(1200px) rotateX(0deg)",
          },
        },
      },
      animation: {
        "flip-x": "flipX 0.8s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};
export default config;