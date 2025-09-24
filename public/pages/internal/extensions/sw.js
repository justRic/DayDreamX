importScripts("/assets/js/lib/filerJS/filer.min.js");
importScripts("/assets/js/lib/JSzip/jszip.min.js");

const fs = new Filer.FileSystem({ name: "files" });

// Install + Activate events
self.addEventListener("install", () => {
  console.log("Service Worker installed");
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activated");
  event.waitUntil(clients.claim());
});

// Message handler
self.addEventListener("message", async (event) => {
  const { type, file, extensionID } = event.data;

  if (type === "installExtension") {
    const success = await installExtension(file);
    event.source.postMessage({ type: "installComplete", success });
  }

  if (type === "removeExtension") {
    const success = await removeExtension(extensionID);
    event.source.postMessage({ type: "removeComplete", success });
  }
});

// Install extension
async function installExtension(file) {
  try {
    const zip = await JSZip.loadAsync(file);
    const manifestContent = await zip.file("manifest.json").async("string");
    const manifest = JSON.parse(manifestContent);
    const extensionID = manifest.id;
    const basePath = `/internal/extensions/${extensionID}`;

    // Write each file to virtual FS
    await Promise.all(
      Object.keys(zip.files).map(async (filename) => {
        const fileObj = zip.files[filename];
        if (fileObj.dir) return; // skip folders

        const fileContent = await fileObj.async("uint8array");
        const filePath = `${basePath}/${filename}`;

        return new Promise((resolve, reject) => {
          fs.writeFile(filePath, fileContent, (err) => {
            if (err) {
              console.error(`Failed to write file ${filePath}:`, err);
              reject(err);
            } else {
              resolve();
            }
          });
        });
      })
    );

    console.log(`Extension ${manifest.name} installed successfully.`);
    return true;
  } catch (err) {
    console.error("Error installing extension:", err);
    return false;
  }
}

// Remove extension
async function removeExtension(extensionID) {
  const basePath = `/internal/extensions/${extensionID}`;

  return new Promise((resolve) => {
    fs.readdir(basePath, (err, entries) => {
      if (err) {
        console.error(`Failed to read directory ${basePath}:`, err);
        return resolve(false);
      }

      let pending = entries.length;
      if (!pending) {
        fs.rmdir(basePath, () => resolve(true));
        return;
      }

      entries.forEach((entry) => {
        const filePath = `${basePath}/${entry}`;
        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr) {
            console.error(`Failed to delete file ${filePath}:`, unlinkErr);
          }
          if (!--pending) {
            fs.rmdir(basePath, (rmdirErr) => {
              if (rmdirErr) {
                console.error(`Failed to remove directory ${basePath}:`, rmdirErr);
                resolve(false);
              } else {
                console.log(`Removed extension ${extensionID} successfully.`);
                resolve(true);
              }
            });
          }
        });
      });
    });
  });
}

// Serve extension files
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const match = url.pathname.match(/^\/internal\/extensions\/([^/]+)\/(.*)$/);

  if (match) {
    const extensionID = match[1];
    const relativePath = match[2];
    const filePath = `/internal/extensions/${extensionID}/${relativePath}`;

    event.respondWith(
      new Promise((resolve) => {
        fs.readFile(filePath, (err, data) => {
          if (err) {
            console.error(`File not found in SW: ${filePath}`, err);
            return resolve(new Response("File not found", { status: 404 }));
          }

          resolve(
            new Response(data, {
              status: 200,
              headers: { "Content-Type": getMimeType(filePath) },
            })
          );
        });
      })
    );
  }
});

// Utility: simple MIME type detection
function getMimeType(filePath) {
  if (filePath.endsWith(".html")) return "text/html";
  if (filePath.endsWith(".js")) return "application/javascript";
  if (filePath.endsWith(".css")) return "text/css";
  if (filePath.endsWith(".json")) return "application/json";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}
