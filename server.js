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
    // Si la query es solo para abrir el juego (no trae score)
    if (!query.game_short_name || !query.game_short_name.includes('score')) { // Solo si no es una query de puntuación
        console.log(`Usuario ${query.from.first_name} pulso 'Jugar'. Abriendo URL: ${GAME_URL}`);
        bot.answerCallbackQuery(query.id, { url: GAME_URL });
    } else {
        // Esto es si la query viene del juego con una puntuación (opcional, setScore(score, true) suele ser suficiente)
        const score = parseInt(query.data.split('_')[1]); // Ejemplo: si la data es "score_123"
        if (!isNaN(score)) {
            console.log(`Puntuación recibida via callback_query: Usuario ${userId}, Score: ${score}`);
            // Usa el chat_id y message_id apropiados, o inline_message_id
            bot.setGameScore(
                userId,
                score,
                true, // disable_edit_message
                query.inline_message_id ? undefined : chatId, // chat_id
                query.inline_message_id ? query.inline_message_id : messageId // message_id
            )
            .then(() => {
                console.log(`Puntuación de ${userId} actualizada.`);
                bot.answerCallbackQuery(query.id, { text: `Tu puntuación (${score}) ha sido registrada.` });
            })
            .catch(error => {
                console.error('Error al establecer la puntuación del juego via callback:', error.message);
                bot.answerCallbackQuery(query.id, { text: "Error al registrar la puntuación." });
            });
        }
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
    const fromId = msg.from.id; // ID del usuario que envió el comando

    try {
        let highScores;
        let options = {};

        // Si el comando /ranking es enviado como respuesta a un mensaje de juego,
        // intentamos obtener el ranking asociado a ese mensaje de juego específico.
        if (msg.reply_to_message && msg.reply_to_message.game && msg.reply_to_message.game.file_id) {
            // Si el mensaje al que se responde es un mensaje de juego.
            // game.file_id es un identificador único para el juego en Telegram.
            // Necesitamos el message_id y chat_id del mensaje del juego.
            options = {
                chatId: msg.reply_to_message.chat.id,
                messageId: msg.reply_to_message.message_id
            };
            console.log(`Obteniendo ranking para juego específico en chat ${options.chatId}, mensaje ${options.messageId}`);
            highScores = await bot.getGameHighScores(fromId, GAME_SHORT_NAME, options);
        } else if (msg.game_short_name === GAME_SHORT_NAME) {
            // Si el comando /ranking está en el mismo mensaje que el juego (raro, pero posible si se edita)
            options = {
                chatId: chatId,
                messageId: msg.message_id // el message_id del mensaje que contiene el juego
            };
            highScores = await bot.getGameHighScores(fromId, GAME_SHORT_NAME, options);
        } else {
            // Si es un comando /ranking general (no en respuesta a un juego específico o en un grupo con múltiples juegos)
            // Telegram permite obtener el ranking general de un juego para un chat, o para el usuario.
            // Intentaremos obtener el ranking general del juego para el chat actual.
            console.log(`Obteniendo ranking general para chat: ${chatId}`);
            highScores = await bot.getGameHighScores(fromId, GAME_SHORT_NAME); // Solo necesita userId y short_name para ranking global o por chat
        }

        let rankingText = "🏆 **Ranking Shiro Coin** 🏆\n\n";
        if (highScores && highScores.length > 0) {
            highScores.forEach((entry, index) => {
                // Telegram devuelve el objeto 'user' para cada entrada del ranking
                rankingText += `${index + 1}. ${entry.user.first_name} ${entry.user.last_name || ''}: ${entry.score} puntos\n`;
            });
        } else {
            rankingText += "Aún no hay puntuaciones en el ranking. ¡Sé el primero en jugar!";
        }
        bot.sendMessage(chatId, rankingText, { parse_mode: 'Markdown' }).catch(err => console.error('Error enviando ranking:', err));
        console.log("Ranking de juego enviado al chat.");
    } catch (error) {
        console.error("Error al obtener el ranking de juego:", error.message);
        // Si el error es por MESSAGE_ID_INVALID o similar, informamos mejor al usuario.
        if (error.message.includes('MESSAGE_ID_INVALID') || error.message.includes('game_not_found')) {
            bot.sendMessage(chatId, "Lo siento, no pude recuperar el ranking. Asegúrate de que el comando /ranking se usa en el chat donde se compartió el juego, o inténtalo en el chat privado con el bot.").catch(err => console.error('Error enviando mensaje de error:', err));
        } else {
            bot.sendMessage(chatId, "Lo siento, no pude recuperar el ranking en este momento.").catch(err => console.error('Error enviando mensaje de error:', err));
        }
    }
});

// Manejo de errores del bot
bot.on('polling_error', (error) => {
  console.error(`Error de polling del bot: ${error.code} - ${error.message}`);
});

console.log("Bot de Telegram iniciado. Esperando mensajes...");
