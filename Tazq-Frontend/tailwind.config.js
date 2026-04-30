// Triggering rebuild for full premium styling sync
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0058bb",
          dim: "#004ca4",
          container: "#6c9fff",
          fixed: "#6c9fff",
          "fixed-dim": "#5191ff",
        },
        secondary: {
          DEFAULT: "#b4005d",
          dim: "#9f0051",
          container: "#ffc1d1",
          fixed: "#ffc1d1",
          "fixed-dim": "#ffacc4",
        },
        tertiary: {
          DEFAULT: "#006859",
          dim: "#005a4d",
          container: "#26fedc",
          fixed: "#26fedc",
          "fixed-dim": "#00efce",
        },
        surface: {
          DEFAULT: "#f6f6f8",
          dim: "#d2d4d8",
          bright: "#f6f6f8",
          container: {
            lowest: "#ffffff",
            low: "#f0f1f3",
            DEFAULT: "#e7e8ea",
            high: "#e1e2e5",
            highest: "#dbdde0",
          },
          variant: "#dbdde0",
        },
        on: {
          primary: "#f0f2ff",
          secondary: "#ffeff1",
          tertiary: "#c2ffef",
          surface: "#2d2f31",
          "surface-variant": "#5a5c5d",
          error: "#ffefee",
        },
        error: {
          DEFAULT: "#b31b25",
          dim: "#9f0519",
          container: "#fb5151",
        },
        outline: {
          DEFAULT: "#757779",
          variant: "#acadaf",
        },
      },
      borderRadius: {
        'default': '1rem',
        'lg': '2rem',
        'xl': '3rem',
        '2xl': '3.5rem',
        '3xl': '4rem',
      },
    },
  },
  plugins: [],
};
