export default {
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
      include: ["src/**"],
      exclude: ["src/**/*.test.ts", "src/**/*.d.ts", "src/generated/**"],
    },
  },
};
