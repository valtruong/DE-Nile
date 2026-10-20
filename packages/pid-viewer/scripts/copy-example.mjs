import { copyFileSync, rmSync } from "node:fs";
copyFileSync(
  new URL("../src/example-diagram.json", import.meta.url),
  new URL("../dist/example-diagram.json", import.meta.url)
);

// Only index.d.ts is a public entry; do not ship the CSS bundler entry's declaration.
rmSync(new URL("../dist/bundle.d.ts", import.meta.url), {
  force: true
});

copyFileSync(new URL('../src/css.d.ts', import.meta.url), new URL('../dist/style.d.ts', import.meta.url));
