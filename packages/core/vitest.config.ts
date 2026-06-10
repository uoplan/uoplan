export default {
  test: {
    include: ["src/**/*.test.ts"],
    benchmark: { include: ["src/**/*.bench.ts"] },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
      include: ["src/**"],
      exclude: ["src/**/*.test.ts", "src/**/*.bench.ts", "src/**/*.d.ts", "src/tests/**"],
    },
  },
};
