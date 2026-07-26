import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

type ExtensionFile = {
  data: Buffer;
  modifiedAt: Date;
  zipPath: string;
};

const EXTENSION_DIRECTORY = path.resolve(process.cwd(), "../extension");
const CHROME_ZIP_FILE_NAME = "careeros-capture-chrome.zip";
const FIREFOX_XPI_FILE_NAME = "careeros-capture-firefox.xpi";
const FIREFOX_EXTENSION_ID = "capture@careeros.app";
const FIREFOX_MIN_VERSION = "140.0";
const FIREFOX_DATA_COLLECTION_PERMISSIONS = {
  required: [
    "authenticationInfo",
    "browsingActivity",
    "websiteActivity",
    "websiteContent"
  ]
};

let crcTable: Uint32Array | null = null;

function getCrcTable() {
  if (crcTable) {
    return crcTable;
  }

  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }

  crcTable = table;
  return table;
}

function crc32(buffer: Buffer) {
  const table = getCrcTable();
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(date: Date) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

type ExtensionBrowser = "chrome" | "firefox";

function buildFirefoxManifest(manifest: Record<string, any>) {
  const {
    action,
    content_security_policy: _chromeContentSecurityPolicy,
    host_permissions: hostPermissions = [],
    key: _devOnlyKey,
    ...baseManifest
  } = manifest;
  const serviceWorker =
    typeof baseManifest.background?.service_worker === "string"
      ? baseManifest.background.service_worker
      : "";
  const apiPermissions = Array.isArray(baseManifest.permissions)
    ? baseManifest.permissions
    : [];
  const permissions = Array.from(
    new Set([...apiPermissions, ...hostPermissions])
  );

  return {
    ...baseManifest,
    manifest_version: 2,
    permissions,
    background: serviceWorker
      ? {
          scripts: [serviceWorker]
        }
      : baseManifest.background,
    browser_action: action,
    content_security_policy:
      "script-src 'self'; object-src 'self'; connect-src 'self' http://localhost:3000 http://127.0.0.1:3000 https://*.vercel.app https://*.careeros.app https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://oauth2.googleapis.com https://github.com",
    browser_specific_settings: {
      gecko: {
        id: FIREFOX_EXTENSION_ID,
        data_collection_permissions: FIREFOX_DATA_COLLECTION_PERMISSIONS,
        strict_min_version: FIREFOX_MIN_VERSION
      }
    }
  };
}

function maybeTransformManifest(data: Buffer, zipPath: string, browser: ExtensionBrowser) {
  if (zipPath !== "manifest.json") {
    return data;
  }

  const manifest = JSON.parse(data.toString("utf8"));
  const { key: _devOnlyKey, ...storeSafeManifest } = manifest;
  const nextManifest =
    browser === "firefox"
      ? buildFirefoxManifest(manifest)
      : storeSafeManifest;

  return Buffer.from(
    `${JSON.stringify(nextManifest, null, 2)}\n`,
    "utf8"
  );
}

async function collectExtensionFiles(
  browser: ExtensionBrowser,
  directory = EXTENSION_DIRECTORY,
  relativeRoot = ""
): Promise<ExtensionFile[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: ExtensionFile[] = [];

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".DS_Store") {
      continue;
    }

    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.join(relativeRoot, entry.name);
    const zipPath = relativePath.split(path.sep).join("/");

    if (entry.isDirectory()) {
      files.push(...(await collectExtensionFiles(browser, absolutePath, relativePath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const data = await fs.readFile(absolutePath);
    const stats = await fs.stat(absolutePath);
    files.push({
      data: maybeTransformManifest(data, zipPath, browser),
      modifiedAt: stats.mtime,
      zipPath
    });
  }

  return files.sort((left, right) => left.zipPath.localeCompare(right.zipPath));
}

function createZip(files: ExtensionFile[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.zipPath, "utf8");
    const checksum = crc32(file.data);
    const { dosDate, dosTime } = toDosDateTime(file.modifiedAt);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(file.data.length, 18);
    localHeader.writeUInt32LE(file.data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, file.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(file.data.length, 20);
    centralHeader.writeUInt32LE(file.data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + file.data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endHeader = Buffer.alloc(22);
  endHeader.writeUInt32LE(0x06054b50, 0);
  endHeader.writeUInt16LE(0, 4);
  endHeader.writeUInt16LE(0, 6);
  endHeader.writeUInt16LE(files.length, 8);
  endHeader.writeUInt16LE(files.length, 10);
  endHeader.writeUInt32LE(centralDirectory.length, 12);
  endHeader.writeUInt32LE(offset, 16);
  endHeader.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, endHeader]);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const browser: ExtensionBrowser = searchParams.get("browser") === "firefox" ? "firefox" : "chrome";
  const files = await collectExtensionFiles(browser);
  const zip = createZip(files);
  const fileName = browser === "firefox" ? FIREFOX_XPI_FILE_NAME : CHROME_ZIP_FILE_NAME;
  const contentType = browser === "firefox" ? "application/x-xpinstall" : "application/zip";

  return new Response(zip, {
    headers: {
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="${fileName}"`,
      "content-length": String(zip.length),
      "content-type": contentType
    }
  });
}
