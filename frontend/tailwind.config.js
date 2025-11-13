module.exports = {
  content: ["./src/**/*.{html,js,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        orbitron: ["Orbitron", "Arial", "sans-serif"],
      },
      colors: {
        "neon-green": "#39ff14",
        "neon-pink": "#ff00cc",
      },
      dropShadow: {
        neon: "0 0 8px #39ff14, 0 0 16px #ff00cc",
      },
      boxShadow: {
        neon: "0 0 10px #ff00cc, 0 0 20px #39ff14",
      },
    },
  },
  plugins: [],
};
