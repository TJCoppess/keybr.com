import { createHash } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import ts from "typescript";

/**
 * @param {string} fileName
 * @return {boolean}
 */
export function isTs(fileName) {
  return fileName.endsWith(".ts");
}

/**
 * @param {string} fileName
 * @return {boolean}
 */
export function isTsx(fileName) {
  return fileName.endsWith(".tsx");
}

/**
 * @param {string} source
 * @param {string} fileName
 * @return {Promise<string>}
 */
export async function transpile(source, fileName) {
  const options = getTranspileOptions(fileName);
  const slug = fileName.replace(/[./\\:]/g, "_");
  const hash = createHash("md5")
    .update(fileName)
    .update(source)
    .update(JSON.stringify(options))
    .update(ts.version)
    .digest("hex");
  const cachedFilename = join(tmpdir(), `tsl`, `${slug}_${hash}.js`);
  try {
    return await readFile(cachedFilename, "utf-8");
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }
  const { outputText, diagnostics } = ts.transpileModule(source, options);
  if (diagnostics.length > 0) {
    for (const diagnostic of diagnostics) {
      console.error(diagnostic);
    }
    throw new Error(`Error transpiling file [${fileName}]`);
  }
  await writeCache(cachedFilename, outputText);
  return outputText;
}

/**
 * The cache is shared between concurrent processes, so another process
 * may be writing or reading the same file. Losing this race is not an error.
 *
 * @param {string} cachedFilename
 * @param {string} outputText
 * @return {Promise<void>}
 */
async function writeCache(cachedFilename, outputText) {
  const lockFilename = cachedFilename + ".lock";
  try {
    await mkdir(dirname(cachedFilename), { recursive: true });
    const f = await open(lockFilename, "wx");
    try {
      await f.writeFile(outputText, "utf-8");
    } finally {
      await f.close();
    }
  } catch (err) {
    if (err.code !== "EEXIST") {
      throw err;
    }
    return;
  }
  try {
    await rename(lockFilename, cachedFilename);
  } catch (err) {
    // On Windows a file cannot be replaced while another process reads it.
    await rm(lockFilename, { force: true });
    if (!["EEXIST", "EPERM", "EBUSY", "EACCES"].includes(err.code)) {
      throw err;
    }
  }
}

/**
 * @param {string} fileName
 * @return {ts.TranspileOptions}
 */
function getTranspileOptions(fileName) {
  const compilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    importHelpers: true,
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    inlineSourceMap: true,
    inlineSources: true,
  };
  if (isTsx(fileName)) {
    compilerOptions.jsx = ts.JsxEmit.ReactJSX;
  }
  return {
    fileName,
    compilerOptions,
  };
}
