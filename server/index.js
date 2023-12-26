import express from "express";
import logger from "morgan";
import dotenv from "dotenv";
import { createClient } from "@libsql/client";
import { Server } from "socket.io";
import { createServer } from "node:http";

dotenv.config();

const port = process.env.PORT ?? 3000;

const app = express();
const server = createServer(app);
const io = new Server(server, {
  connectionStateRecovery: {},
});

const db = createClient({
  url: "libsql://advanced-maximum-azsurei.turso.io",
  authToken: process.env.DB_TOKEN
});

await db.execute(`
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT,
  username TEXT
);
  `);

io.on("connection", async (socket) => {
  console.log("a user connected");

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });

  socket.on("chat message", async (msg) => {
    let result;
    const username = socket.handshake.auth.username ?? "anonymous";
    try {
      result = await db.execute({
        sql: `INSERT INTO messages (content, username) VALUES (:msg , :username)`,
        args: { msg, username }
      });
    } catch (e) {
      console.error(e);
      return;
    }
    io.emit("chat message", msg, result.lastInsertRowid.toString(), username); // broadcast to all clients
  });

  if(!socket.recovered){ // si no se ha recuperado
    try{
      const results = await db.execute({
        sql: "SELECT id, content, username FROM messages WHERE id>?",
        args: [socket.handshake.auth.serverOffset ?? 0],
      });
      console.log("1",results);
      console.log("2",results.rows);
      results.rows.forEach((row) => {
        socket.emit("chat message", row.content, row.id.toString(), row.username);
      });

    } catch(e){
      console.error(e);
    }
  }
});

// la diferencia de socket y io es que socket es para un cliente en especifico y io es para todos los clientes

app.use(logger("dev"));

app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/client/index.html");
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
