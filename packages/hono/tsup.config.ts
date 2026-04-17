import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  // ws and node:http are lazy-imported only in dev inside startDevtools()
  // They must stay external so they are resolved at runtime by Node.js
  external: ["ws", "node:http"],
})
