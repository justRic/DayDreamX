importScripts("/assets/js/lib/filerJS/filer.min.js");

const fs = new Filer.FileSystem({ name: "theme-files" });

self.addEventListener("install", (event) => {
  console.log("Theming Service Worker installed");
  event.waitUntil(
    Promise.all([createDirectory("/backgrounds"), createDirectory("/logos")])
  );
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activated");
  event.waitUntil(clients.claim());
});

// Messaging API
self.addEventListener("message", async (event) => {
  const { type, file } = event.data;

  switch (type) {
    case "uploadBG":
      event.source.postMessage({
        type,
        success: await uploadFile("/backgrounds", file),
      });
      break;

    case "removeBG":
      event.source.postMessage({
        type,
        success: await removeFile("/backgrounds", file),
      });
      break;

    case "listBG":
      event.source.postMessage({
        type,
        files: await listFiles("/backgrounds"),
      });
      break;

    case "uploadLogo":
      event.source.postMessage({
        type,
        success: await uploadFile("/logos", file),
      });
      break;

    case "removeLogo":
      event.source.postMessage({
        type,
        success: await removeFile("/logos", file),
      });
      break;

    case "listLogos":
      event.source.postMessage({
        type,
        files: await listFiles("/logos"),
      });
      break;

    default:
      console.warn(`Unknown message type: ${type}`);
  }
});

// ---- File helpers ----
async function createDirectory(path) {
  return new Promise((resolve) => {
    fs.mkdir(path, { recursive: true }, (err) => {
      if (err && err.code !== "EEXIST") {
        console.error(`Error creating directory ${path}:`, err);
        resolve(false);
      } else {
        resolve(true);
      }
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
          console.error(`Error writing file ${filePath}:`, err);
          resolve(false);
        } else {
          console.log(`File "${filePath}" uploaded successfully.`);
          resolve(true);
        }
      });
    });
  } catch (err) {
    console.error("Upload error:", err);
    return false;
  }
}

async function removeFile(dir, filename) {
  if (!filename) return false;
  const filePath = `${dir}/${filename}`;
  return new Promise((resolve) => {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error(`Error deleting file ${filePath}:`, err);
        resolve(false);
      } else {
        console.log(`File "${filePath}" removed successfully.`);
        resolve(true);
      }
    });
  });
}

async function listFiles(dir) {
  return new Promise((resolve) => {
    fs.readdir(dir, (err, entries) => {
      if (err) {
        console.error(`Error listing files in ${dir}:`, err);
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

  if (url.pathname.startsWith("/internal/themes/backgrounds/")) {
    const filename = url.pathname.replace("/internal/themes/backgrounds/", "");
    event.respondWith(serveFile(`/backgrounds/${filename}`));
  } else if (url.pathname.startsWith("/internal/themes/logos/")) {
    const filename = url.pathname.replace("/internal/themes/logos/", "");
    event.respondWith(serveFile(`/logos/${filename}`));
  }
});

function serveFile(path) {
  return new Promise((resolve) => {
    fs.readFile(path, (err, data) => {
      if (err) {
        console.error(`File not found: ${path}`, err);
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
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}
