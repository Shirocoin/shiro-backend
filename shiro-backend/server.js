// server.js corregido para redirigir al juego y guardar puntuaciones

const express = require("express");
const fs = require("fs");
const bodyParser = require("body-parser");
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para procesar JSON
app.use(bodyParser.json());

// Ruta principal: redirige al juego
app.get("/", (req, res) => {
  const gameUrl = "https://elaborate-quokka-0138e7.netlify.app";
  res.redirect(gameUrl);
});

// Ruta para recibir y guardar puntuaciones
const scoresFile = "scores.json";

app.post("/score", (req, res) => {
  const { id, name, score } = req.body;
  let scores = [];

  try {
    if (fs.existsSync(scoresFile)) {
      scores = JSON.parse(fs.readFileSync(scoresFile));
    }
  } catch (e) {
    console.error("Error leyendo el archivo de puntuaciones:", e);
  }

  scores.push({ id, name, score, time: new Date().toISOString() });

  try {
    fs.writeFileSync(scoresFile, JSON.stringify(scores, null, 2));
    res.sendStatus(200);
  } catch (e) {
    console.error("Error escribiendo el archivo de puntuaciones:", e);
    res.sendStatus(500);
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log("Servidor escuchando en el puerto " + PORT);
});

// Ruta para obtener los mejores puntajes ordenados
app.get("/ranking", (req, res) => {
  try {
    const scores = fs.existsSync(scoresFile)
      ? JSON.parse(fs.readFileSync(scoresFile))
      : [];

    // Ordenar por puntuación descendente
    const topScores = scores.sort((a, b) => b.score - a.score).slice(0, 10);

    res.json(topScores);
  } catch (e) {
    console.error("Error al leer el ranking:", e);
    res.sendStatus(500);
  }
});
