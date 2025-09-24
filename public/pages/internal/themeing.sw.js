importScripts("/assets/js/lib/filerJS/filer.min.js");

const fs = new Filer.FileSystem({ name: "theme-files" });

const DIRECTORIES = {
  backgrounds: "/backgrounds",
  logos: "/logos",
  icons: "/icons",
};

// ---- Install / Activate ----
self.addEventListener("install", (event) => {
  console.log("[Theme SW] Installing…");
  event.waitUntil(
    Promise.all(
      Object.values(DIRECTORIES).map((dir) => createDirectory(dir))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[Theme SW] Activated");
  event.waitUntil(clients.claim());
});

// ---- Messaging API ----
self.addEventListener("message", async (event) => {
  const { type, category, file, filename } = event.data;
  const dir = DIRECTORIES[category];

  if (!dir) {
    console.warn(`[Theme SW] Unknown category: ${category}`);
    return;
  }

  switch (type) {
    case "upload":
      event.source.postMessage({
        type,
        category,
        success: await uploadFile(dir, file),
      });
      break;

    case "remove":
      event.source.postMessage({
        type,
        category,
        success: await removeFile(dir, filename),
      });
      break;

    case "list":
      event.source.postMessage({
        type,
        category,
        files: await listFiles(dir),
      });
      break;

    default:
      console.warn(`[Theme SW] Unknown message type: ${type}`);
  }
});

// ---- File Helpers ----
async function createDirectory(path) {
  return new Promise((resolve) => {
    fs.mkdir(path, { recursive: true }, (err) => {
      if (err && err.code !== "EEXIST") {
        console.error(`[Theme SW] Error creating ${path}:`, err);
        resolve(false);
      } else resolve(true);
    });
  });
}

async function uploadFile(dir, file) {
  try {
    if (!file) return false;
    await createDirectory(dir);

    const filePath = `${dir}/${file.name}`;
    const buffer = Filer.Buffer.from(await file.arrayBuffer());

    return new Promise((resolve) => {
      fs.writeFile(filePath, buffer, (err) => {
        if (err) {
          console.error(`[Theme SW] Error writing ${filePath}:`, err);
          resolve(false);
        } else {
          console.log(`[Theme SW] Uploaded: ${filePath}`);
          resolve(true);
        }
      });
    });
  } catch (err) {
    console.error("[Theme SW] Upload error:", err);
    return false;
  }
}

async function removeFile(dir, filename) {
  if (!filename) return false;
  const filePath = `${dir}/${filename}`;
  return new Promise((resolve) => {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error(`[Theme SW] Error deleting ${filePath}:`, err);
        resolve(false);
      } else {
        console.log(`[Theme SW] Removed: ${filePath}`);
        resolve(true);
      }
    });
  });
}

async function listFiles(dir) {
  return new Promise((resolve) => {
    fs.readdir(dir, (err, entries) => {
      if (err) {
        console.error(`[Theme SW] Error listing ${dir}:`, err);
        resolve([]);
      } else {
        resolve(entries);
      }
    });
  });
}

// ---- Fetch handler ----
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  for (const [category, dir] of Object.entries(DIRECTORIES)) {
    if (url.pathname.startsWith(`/internal/themes/${category}/`)) {
      const filename = url.pathname.replace(`/internal/themes/${category}/`, "");
      event.respondWith(serveFile(`${dir}/${filename}`));
      return;
    }
  }
});

function serveFile(path) {
  return new Promise((resolve) => {
    fs.readFile(path, (err, data) => {
      if (err) {
        console.warn(`[Theme SW] File not found: ${path}`);
        resolve(new Response("File not found", { status: 404 }));
      } else {
        resolve(
          new Response(data, {
            status: 200,
            headers: {
              "Content-Type": getMimeType(path),
              "Cache-Control": "public, max-age=0",
            },
          })
        );
      }
    });
  });
}

// ---- MIME helper ----
function getMimeType(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  const types = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    ico: "image/x-icon",
  };
  return types[ext] || "application/octet-stream";
}
