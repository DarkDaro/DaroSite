import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStaticServer } from "./server.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 8765);
const server = createStaticServer(root);

server.on("error", (error) => {
  console.error("Не удалось запустить сервер:", error.message);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log("Сервер: http://" + host + ":" + port + "/");
  console.log("Папка: " + root);
});
