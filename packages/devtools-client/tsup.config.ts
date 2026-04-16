import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  target: "ES2022",
  platform: "browser",
  esbuildOptions(options) {
    options.banner = {
      js: `// @ciph/devtools-client v${process.env.npm_package_version ?? "0.0.0"}`,
    }
  },
})
