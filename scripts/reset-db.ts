/**
 * Apaga o banco SQLite local (memepedia.db + WAL/SHM) para que ele seja
 * recriado do zero na próxima inicialização do servidor — o bootstrap cria
 * o esquema e carrega a seed de demonstração automaticamente em banco vazio.
 *
 * Uso: npm run db:reset
 *
 * O script é autocontido (só node:fs/path) para poder rodar direto com
 * `node --experimental-strip-types`, sem depender da camada de dados do app.
 */
import fs from "node:fs";
import path from "node:path";

const dataDir = process.env.MEMEPEDIA_DATA_DIR
  ? path.resolve(process.env.MEMEPEDIA_DATA_DIR)
  : path.join(import.meta.dirname, "..", "data");

const dbFiles = ["memepedia.db", "memepedia.db-wal", "memepedia.db-shm"];

let removed = 0;
for (const name of dbFiles) {
  const file = path.join(dataDir, name);
  if (fs.existsSync(file)) {
    fs.rmSync(file);
    console.log(`removido: data/${name}`);
    removed++;
  }
}

if (removed === 0) {
  console.log("Nenhum arquivo de banco encontrado — nada a fazer.");
} else {
  console.log(
    "\nBanco limpo. A próxima execução do servidor recriará o esquema e a seed de demonstração automaticamente."
  );
}
