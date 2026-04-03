/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        app: {
          border: "#A9A9A9",
          surface: "#F2F2F2",
          /** Primary brand green */
          primaryGreen: "#00C951",
          /** Medium green — e.g. “Added” control fill */
          mediumGreen: "#B3EDC7",
          /** Light green — e.g. queue row surface */
          lightGreen: "#EAF9EE",
          /** Loading / skeleton blocks */
          skeleton: "#ECECEC",
        },
      },
    },
  },
  plugins: [],
};
