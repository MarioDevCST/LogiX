import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import usersRouter from "./routes/users.js";
import companiesRouter from "./routes/companies.js";
import shipsRouter from "./routes/ships.js";
import palletsRouter from "./routes/pallets.js";
import loadsRouter from "./routes/loads.js";
import locationsRouter from "./routes/locations.js";
import authRouter from "./routes/auth.js";
import consigneesRouter from "./routes/consignees.js";
import messagesRouter from "./routes/messages.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || "logix";

// Conexión a MongoDB
async function start() {
  try {
    if (!MONGO_URI) throw new Error("MONGODB_URI no definido en .env");

    // Intentar conectar a MongoDB
    const connectDB = async () => {
      try {
        await mongoose.connect(MONGO_URI, {
          dbName: DB_NAME,
          serverSelectionTimeoutMS: 3000,
        });
        console.log("Conectado a MongoDB local", { dbName: DB_NAME });
      } catch (connErr) {
        console.error("Error conectando a MongoDB local:", connErr.message);
        console.log(
          "Intentando iniciar MongoDB en memoria (solo desarrollo)..."
        );

        try {
          const { MongoMemoryServer } = await import("mongodb-memory-server");

          let mongod;
          try {
            // Intentar puerto estándar 27017 primero con versión específica
            mongod = await MongoMemoryServer.create({
              instance: { port: 27017 },
              binary: { version: "6.0.4" },
            });
          } catch (portErr) {
            console.log(
              "Puerto 27017 ocupado o no disponible, usando puerto aleatorio..."
            );
            mongod = await MongoMemoryServer.create({
              binary: { version: "6.0.4" },
            });
          }

          const uri = mongod.getUri();
          await mongoose.connect(uri, { dbName: DB_NAME });
          console.log(
            "----------------------------------------------------------------"
          );
          console.log("MongoDB en Memoria iniciado exitosamente");
          console.log("URI de conexión:", uri);
          if (uri.includes("27017")) {
            console.log(
              "Puedes conectar MongoDB Compass a: mongodb://localhost:27017"
            );
          } else {
            console.log(
              `Puedes conectar MongoDB Compass usando la URI de arriba`
            );
          }
          console.log("NOTA: Los datos se perderán al reiniciar el servidor");
          console.log(
            "----------------------------------------------------------------"
          );

          // Crear usuario admin si no existe
          try {
            const User = (await import("./models/User.js")).default;
            const bcrypt = (await import("bcryptjs")).default;
            const adminExists = await User.findOne({
              email: "admin@logix.com",
            });

            if (!adminExists) {
              const hashedPassword = await bcrypt.hash("admin", 10);
              await User.create({
                name: "Admin",
                email: "admin@logix.com",
                password: hashedPassword,
                role: "admin",
                active: true,
              });
              console.log("Usuario admin creado automáticamente:");
              console.log("Email: admin@logix.com");
              console.log("Pass:  admin");
              console.log(
                "----------------------------------------------------------------"
              );
            }
          } catch (userErr) {
            console.error("Error creando usuario admin:", userErr);
          }
        } catch (memErr) {
          console.error("No se pudo iniciar MongoDB integrado:", memErr);
          console.error(
            "----------------------------------------------------------------"
          );
          console.error(
            "ADVERTENCIA: Iniciando servidor SIN conexión a base de datos."
          );
          console.error("Todas las peticiones que requieran BD fallarán.");
          console.error(
            "----------------------------------------------------------------"
          );
        }
      }
    };

    await connectDB();

    // Middleware para verificar estado de BD antes de procesar peticiones
    app.use((req, res, next) => {
      // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
      if (mongoose.connection.readyState !== 1 && req.path !== "/api/health") {
        return res.status(503).json({
          error:
            "Servicio de base de datos no disponible. Por favor asegúrate de que MongoDB está corriendo.",
        });
      }
      next();
    });

    app.get("/api/health", (req, res) => {
      res.json({
        ok: true,
        service: "logix-api",
        mongo: mongoose.connection.readyState === 1,
        db: DB_NAME,
      });
    });

    app.use("/api/users", usersRouter);
    app.use("/api/companies", companiesRouter);
    app.use("/api/ships", shipsRouter);
    app.use("/api/pallets", palletsRouter);
    app.use("/api/loads", loadsRouter);
    app.use("/api/locations", locationsRouter);
    app.use("/api/auth", authRouter);
    app.use("/api/consignees", consigneesRouter);
    app.use("/api/messages", messagesRouter);

    app.listen(PORT, () =>
      console.log(`API escuchando en http://localhost:${PORT}`)
    );
  } catch (err) {
    console.error("Error iniciando el servidor:", err.message);
    process.exit(1);
  }
}

start();
