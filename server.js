// server.js transformado en un bot de Telegram para juegos
// Ahora interactuará directamente con la API de Telegram para enviar el juego y gestionar el ranking.

// Importa la librería de Node.js para interactuar con la API de Telegram Bot
const TelegramBot = require('node-telegram-bot-api');
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURACIÓN CRÍTICA DEL BOT ---
// Se lee el Token API de una variable de entorno llamada TELEGRAM_BOT_TOKEN.
// ¡ASEGÚRATE DE CONFIGURAR ESTA VARIABLE EN LA INTERFAZ DE RENDER!
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; 

// El "short name" de tu juego, tal como lo muestra BotFather en la Share URL, es 'shirocoin' (sin guion bajo).
// ASEGÚRATE DE QUE ESTO COINCIDE EXACTAMENTE CON EL QUE REGISTRASTE EN BOTFATHER.
const GAME_SHORT_NAME = 'ShiroCoinDash';

// URL donde está alojado tu juego (la misma que usaste en BotFather)
const GAME_URL = "https://graceful-stroopwafel-713eff.netlify.app/";

// Comprobación de que el token existe antes de crear el bot
if (!BOT_TOKEN) {
    console.error("ERROR: El token de Telegram Bot no está configurado. Asegúrate de añadir TELEGRAM_BOT_TOKEN en las Variables de Entorno de Render.");
    process.exit(1); // Detiene la aplicación si no hay token
}

// Crea una instancia del bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// --- CÓDIGO DE SERVIDOR WEB (Express) ---
// Se mantiene la ruta principal de Express para compatibilidad o redirección,
// pero el bot de Telegram funciona de forma independiente.
app.get("/", (req, res) => {
  console.log("Solicitud GET a la ruta principal. Redirigiendo al juego.");
  res.redirect(GAME_URL);
});

// Los siguientes bloques (relacionados con 'scores.json') se han COMENTADO
// porque el ranking oficial de juegos de Telegram gestiona las puntuaciones
// directamente, haciendo que esta lógica local sea redundante para ese propósito.
// Si necesitas un ranking local PARA OTRAS RAZONES, puedes readaptar esto.

/*
const fs = require("fs");
const bodyParser = require("body-parser");
app.use(bodyParser.json()); // Middleware para procesar JSON

const scoresFile = "scores.json";

app.post("/score", (req, res) => {
  const { id, name, score } = req.body;
  let scores = [];

  try {
    if (fs.existsSync(scoresFile)) {
      scores = JSON.parse(fs.readFileSync(scoresFile));
    }
  } catch (e) {
    console.error("Error leyendo el archivo de puntuaciones local:", e);
  }

  scores.push({ id, name, score, time: new Date().toISOString() });

  try {
    fs.writeFileSync(scoresFile, JSON.stringify(scores, null, 2));
    res.sendStatus(200);
    console.log(`Puntuación local recibida y guardada: ${name} - ${score}`);
  } catch (e) {
    console.error("Error escribiendo el archivo de puntuaciones local:", e);
    res.sendStatus(500);
  }
});

app.get("/ranking", (req, res) => {
  try {
    const scores = fs.existsSync(scoresFile)
      ? JSON.parse(fs.readFileSync(scoresFile))
      : [];

    const topScores = scores.sort((a, b) => b.score - a.score).slice(0, 10);
    res.json(topScores);
    console.log("Ranking local solicitado y enviado.");
  } catch (e) {
    console.error("Error al leer el ranking local:", e);
    res.sendStatus(500);
  }
});
*/

// Iniciar servidor web de Express
app.listen(PORT, () => {
  console.log(`Servidor Express escuchando en el puerto ${PORT}`);
});


// --- LÓGICA DEL BOT DE TELEGRAM ---

// 1. Manejar el comando /start (o cualquier comando que quieras para iniciar el juego)
// Cuando el usuario envía /start, el bot responderá con el juego.
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  console.log(`Comando /start recibido del chat: ${chatId}. Enviando juego...`);

  // Define el teclado inline con un botón para jugar
  const keyboard = {
    inline_keyboard: [[{ text: 'Jugar a Shiro Coin', callback_game: {}}]]
  };

  // Envía el mensaje del juego al chat
  bot.sendGame(chatId, GAME_SHORT_NAME, { reply_markup: keyboard })
    .then(() => {
      console.log(`Juego '${GAME_SHORT_NAME}' enviado exitosamente.`);
    })
    .catch((error) => {
      console.error("Error al enviar el juego:", error.message);
      bot.sendMessage(chatId, "Lo siento, no pude iniciar el juego en este momento. Asegúrate de que el 'short name' del juego es correcto en el código del bot y en BotFather.");
    });
});

// 2. Manejar los "callback queries" (cuando el usuario pulsa el botón "Jugar" o el juego envía la puntuación)
// Esta es la forma en que Telegram informa al bot que el usuario ha interactuado
// con un botón inline que está vinculado a un juego o que una puntuación ha sido enviada.
bot.on('callback_query', (query) => {
  const userId = query.from.id;
  // Obtiene el chat_id y message_id del mensaje del juego, si existe
  const chatId = query.message ? query.message.chat.id : undefined;
  const messageId = query.message ? query.message.message_id : undefined;

  console.log(`Callback query recibida: ${query.data}. Game Short Name: ${query.game_short_name}`);

  // Si la query tiene un game_short_name, es una interacción con el juego
  if (query.game_short_name === GAME_SHORT_NAME) {
    // Verifica si la query es una puntuación del juego (asumiendo formato "score_XYZ")
    if (query.data && query.data.startsWith('score_')) { 
        const score = parseInt(query.data.split('_')[1]);
        if (!isNaN(score)) {
            console.log(`Puntuación recibida via callback_query: Usuario ${userId}, Score: ${score}`);
            // Usa el chat_id y message_id apropiados, o inline_message_id
            bot.setGameScore(
                userId,
                score,
                true, // disable_edit_message: true para que Telegram actualice el mensaje del juego
                query.inline_message_id ? undefined : chatId, // chat_id si no es inline
                query.inline_message_id ? query.inline_message_id : messageId // message_id o inline_message_id
            )
            .then(() => {
                console.log(`Puntuación de ${userId} actualizada y registrada.`);
                // Responde al callback para eliminar el reloj de carga.
                bot.answerCallbackQuery(query.id, { text: `Tu puntuación (${score}) ha sido registrada.` });
            })
            .catch(error => {
                console.error('Error al establecer la puntuación del juego via callback:', error.message);
                bot.answerCallbackQuery(query.id, { text: "Error al registrar la puntuación." });
            });
        } else {
            console.warn(`Callback query de juego no es una puntuación válida: ${query.data}`);
            bot.answerCallbackQuery(query.id, { text: "Puntuación no válida." });
        }
    } else { // Si es una callback para solo abrir el juego
        console.log(`Usuario ${query.from.first_name} pulso 'Jugar'. Abriendo URL: ${GAME_URL}`);
        bot.answerCallbackQuery(query.id, { url: GAME_URL });
    }
  } else {
    // Si no es una callback de juego o no coincide con nuestro juego,
    // puedes manejarla de otra manera o simplemente ignorarla.
    console.warn(`Callback query no reconocida o no coincide con el juego: ${query.data}`);
    bot.answerCallbackQuery(query.id, { text: "Acción no reconocida." });
  }
});


// 3. Manejar las actualizaciones de puntuación de los juegos
// Cuando tu juego (main (5).js) llama a TelegramGameProxy.setScore(score, true),
// Telegram ACTUALIZA AUTOMÁTICAMENTE el mensaje del juego con el ranking.
// Este bot.on('message') es más para logging o procesamiento adicional.
bot.on('message', (msg) => {
    // Cuando el juego termina y Telegram actualiza el mensaje con el ranking,
    // el bot recibe un update con 'game_score'.
    if (msg.game_score !== undefined && msg.game_short_name === GAME_SHORT_NAME) {
        console.log(`Puntuación de juego actualizada por Telegram: Usuario ${msg.from.first_name}, Score: ${msg.game_score}`);
        // Aquí podrías guardar la puntuación en una base de datos externa si lo deseas,
        // pero setGameScore(..., true) ya debería haber actualizado el mensaje.
    }
});


// 4. Manejar el comando /ranking para mostrar el top 10
// Este comando hará que el bot recupere las puntuaciones más altas
// del ranking oficial de Telegram y las muestre en un mensaje.
bot.onText(/\/ranking/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id; // ID del usuario que envió el comando

    try {
        // Obtener el ranking global del juego para el usuario que envía el comando.
        // Esta es la forma más sencilla y robusta para un comando /ranking.
        console.log(`Intentando obtener ranking para userId: ${userId}, gameShortName: ${GAME_SHORT_NAME}`);
        const highScores = await bot.getGameHighScores(userId, GAME_SHORT_NAME);

        let rankingText = "🏆 **Ranking Shiro Coin** 🏆\n\n";
        if (highScores && highScores.length > 0) {
            highScores.forEach((entry, index) => {
                // Telegram devuelve el objeto 'user' para cada entrada del ranking
                rankingText += `${index + 1}. ${entry.user.first_name} ${entry.user.last_name || ''}: ${entry.score} puntos\n`;
            });
        } else {
            rankingText += "Aún no hay puntuaciones en el ranking. ¡Sé el primero en jugar!";
        }
        // Enviar el ranking al chat donde se solicitó
        bot.sendMessage(chatId, rankingText, { parse_mode: 'Markdown' }).catch(err => console.error('Error enviando ranking:', err));
        console.log("Ranking de juego enviado al chat.");

    } catch (error) {
        console.error("Error al obtener el ranking de juego:", error.message);
        // Mensaje de error más claro para el usuario
        bot.sendMessage(chatId, "Lo siento, no pude recuperar el ranking en este momento. Asegúrate de que has jugado al menos una partida. Si el problema persiste, intenta jugar de nuevo o contacta al administrador.").catch(err => console.error('Error enviando mensaje de error:', err));
    }
});

// Manejo de errores del bot
bot.on('polling_error', (error) => {
  console.error(`Error de polling del bot: ${error.code} - ${error.message}`);
});

console.log("Bot de Telegram iniciado. Esperando mensajes...");
