import { spawn } from "node:child_process";
import {
  cp,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = join(repositoryRoot, "packages/react");
const packageManifest = JSON.parse(
  await readFile(join(packageRoot, "package.json"), "utf8"),
);
const scratch = await mkdtemp(join(tmpdir(), "glaze-packed-consumers-"));
const tarball = join(
  scratch,
  `glazelab-react-${packageManifest.version}.tgz`,
);

function run(command, args, cwd, environment = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...environment },
      stdio: "inherit",
    });
    child.on("error", rejectRun);
    child.on("exit", (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

const ignoredFixtureEntries = new Set([
  ".next",
  "dist",
  "node_modules",
  "pnpm-lock.yaml",
]);

async function prepareFixture(sourceName, destinationName, react18 = false) {
  const source = join(repositoryRoot, "examples", sourceName);
  const destination = join(scratch, destinationName);
  await cp(source, destination, {
    recursive: true,
    filter: (entry) => {
      const name = basename(entry);
      return !ignoredFixtureEntries.has(name) && !name.endsWith(".tsbuildinfo");
    },
  });

  const manifestPath = join(destination, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.dependencies["@glazelab/react"] = `file:${tarball}`;
  if (react18) {
    manifest.dependencies.react = "18.3.1";
    manifest.dependencies["react-dom"] = "18.3.1";
    manifest.devDependencies["@types/react"] = "^18.3.0";
    manifest.devDependencies["@types/react-dom"] = "^18.3.0";
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return destination;
}

async function installBuildAndInspect(destination) {
  await run(
    "corepack",
    ["pnpm@9.15.9", "install", "--no-frozen-lockfile"],
    destination,
  );
  await run("corepack", ["pnpm@9.15.9", "build"], destination);
  await run(
    "node",
    [
      "--input-type=module",
      "-e",
      'import("@glazelab/react/material").then(({resolveGlazeMaterial}) => { if (resolveGlazeMaterial().refraction !== 1) process.exit(1); })',
    ],
    destination,
  );
  const installedPackage = await realpath(
    join(destination, "node_modules/@glazelab/react"),
  );
  if (installedPackage.startsWith(packageRoot)) {
    throw new Error(`${destination} resolved a workspace link instead of the tarball.`);
  }
}

try {
  await run(
    "corepack",
    ["pnpm", "pack", "--pack-destination", scratch],
    packageRoot,
    { CI: "true" },
  );

  const reactFixture = await prepareFixture("react-vite", "react-vite");
  const nextFixture = await prepareFixture("next-app", "next-app");
  const react18Fixture = await prepareFixture(
    "react-vite",
    "react-18-vite",
    true,
  );

  await installBuildAndInspect(reactFixture);
  await installBuildAndInspect(nextFixture);
  await installBuildAndInspect(react18Fixture);

  await run(
    "corepack",
    ["pnpm", "exec", "playwright", "test", "-c", "playwright.consumers.config.ts"],
    repositoryRoot,
    { V1_PACKED_CONSUMER_ROOT: scratch },
  );

  await rm(scratch, { recursive: true });
  console.log("Packed React, React 18, and Next consumers verified.");
} catch (error) {
  console.error(`Packed-consumer evidence retained at ${scratch}`);
  throw error;
}
