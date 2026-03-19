import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    index: "src/index.ts",
    // V1.0 计划
    // "tools/index": "src/tools/index.ts",
    // "plugins/index": "src/plugins/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
})
