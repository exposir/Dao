import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "tools/index": "src/tools/index.ts",
    "plugins/index": "src/plugins/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
})
