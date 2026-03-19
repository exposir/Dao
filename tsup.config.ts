import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "tools/index": "src/tools/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
})
