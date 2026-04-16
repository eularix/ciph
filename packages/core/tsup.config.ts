import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: {
    compilerOptions: {
      composite: false,  // fix TS6307 error
    },
  },
  sourcemap: true,
  clean: true,
  target: "es2022",
})