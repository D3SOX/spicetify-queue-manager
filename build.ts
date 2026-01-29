import { readFileSync, writeFileSync, existsSync, rmSync, readdirSync, mkdirSync, watch as watchFs } from "node:fs";
import { join, dirname } from "node:path";

const SRC = join(import.meta.dir, "src");
const ENTRY = join(SRC, "app.ts");

type Settings = { nameId: string };

function getSettings(): Settings {
  return JSON.parse(readFileSync(join(SRC, "settings.json"), "utf-8"));
}

function getJsOutputName(): string {
  return `${getSettings().nameId}.js`;
}

const argv = process.argv.slice(2);
const minify = argv.includes("--minify") || argv.includes("-m");
const watch = argv.includes("--watch") || argv.includes("-w");

function parseOutDir(): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out" || argv[i] === "-o") {
      return argv[i + 1];
    }
    if (argv[i].startsWith("--out=")) {
      return argv[i].slice(6);
    }
  }
  return undefined;
}

async function getOutDir(): Promise<string> {
  const out = parseOutDir();
  if (out) return join(import.meta.dir, out);
  const proc = Bun.spawn(["spicetify", "-c"], { stdout: "pipe", stderr: "pipe" });
  const text = await new Response(proc.stdout).text();
  const ok = await proc.exited;
  if (ok !== 0) {
    const err = await new Response(proc.stderr).text();
    console.error("spicetify -c failed:", err || "spicetify not found or not configured");
    process.exit(1);
  }
  return join(dirname(text.trim()), "Extensions");
}

function getStyleId(): string {
  return getSettings().nameId.replace(/-/g, "D");
}

function postProcess(outDir: string): void {
  // Bun outputs using entry basename (app.js); we want nameId.js like spicetify-creator
  const jsFromBuild = join(outDir, "app.js");
  const jsOut = join(outDir, getJsOutputName());
  if (!existsSync(jsFromBuild)) return;

  let js = readFileSync(jsFromBuild, "utf-8");
  if (jsOut !== jsFromBuild) rmSync(jsFromBuild);

  const styleId = getStyleId();

  const files = readdirSync(outDir, { withFileTypes: true });
  for (const f of files) {
    if (f.isFile() && f.name.endsWith(".css")) {
      const cssPath = join(outDir, f.name);
      const css = readFileSync(cssPath, "utf-8");
      rmSync(cssPath);
      const escaped = css.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
      js += `
(async () => {
  if (!document.getElementById(\`${styleId}\`)) {
    var el = document.createElement('style');
    el.id = \`${styleId}\`;
    el.textContent = (String.raw\`${escaped}\`).trim();
    document.head.appendChild(el);
  }
})();
`;
      break;
    }
  }

  const wrapped = `(async function() {
  while (!Spicetify.React || !Spicetify.ReactDOM) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  ${js}
})();
`;
  writeFileSync(jsOut, wrapped);
}

async function runBuild(outDir: string): Promise<void> {
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const result = await Bun.build({
    entrypoints: [ENTRY],
    outdir: outDir,
    target: "browser",
    minify,
    naming: "[name].[ext]",
    root: ".",
  });

  if (!result.success) {
    console.error("Build failed:");
    for (const msg of result.logs) {
      console.error(msg);
    }
    process.exit(1);
  }

  postProcess(outDir);
  console.log("Build succeeded.");
}

async function main(): Promise<void> {
  const outDir = await getOutDir();

  if (watch) {
    await runBuild(outDir);
    let debounce: ReturnType<typeof setTimeout> | null = null;
    watchFs(SRC, { recursive: true }, () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(async () => {
        debounce = null;
        await runBuild(outDir);
      }, 100);
    });
    console.log("Watching...");
    return;
  }

  await runBuild(outDir);
}

main();
