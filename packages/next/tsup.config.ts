import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts", "src/server.ts", "src/client.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  external: ["next", "react"],
})
