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
const GAME_SHORT_NAME = 'ShiroCoinDash'; // ¡CORREGIDO AQUÍ!

// URL donde está alojado tu juego (la misma que usaste en BotFather)
const GAME_URL = "https://dulce-de-azúcar-dorado-cd8e9d.netlify.app/";

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

// 2. Manejar los "callback queries" (cuando el usuario pulsa el botón "Jugar")
// Esta es la forma en que Telegram informa al bot que el usuario ha interactuado
// con un botón inline que está vinculado a un juego.
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  console.log(`Callback query recibida: ${query.data}`);

  // Asegúrate de que la query es para un juego
  if (query.game_short_name === GAME_SHORT_NAME) {
    console.log(`Usuario ${query.from.first_name} pulso 'Jugar'. Abriendo URL: ${GAME_URL}`);
    // Responde al callback_query con la URL del juego.
    // Esto hace que Telegram abra el juego en su vista web interna.
    bot.answerCallbackQuery(query.id, { url: GAME_URL });
  } else {
    // Si no es una callback de juego o no coincide con nuestro juego,
    // puedes manejarla de otra manera o simplemente ignorarla.
    console.warn(`Callback query no reconocida o no coincide con el juego: ${query.data}`);
    bot.answerCallbackQuery(query.id, { text: "Acción no reconocida." });
  }
});

// 3. Manejar las actualizaciones de puntuación de los juegos
// Cuando tu juego (main.js) llama a TelegramGameProxy.setScore(score, true),
// Telegram ACTUALIZA AUTOMÁTICAMENTE el mensaje del juego con el ranking.
// No necesitamos una ruta POST aquí, ya que el juego no enviará la puntuación
// a este backend, sino directamente a la API de Telegram.

// 4. Manejar el comando /ranking para mostrar el top 10
// Este comando hará que el bot recupere las puntuaciones más altas
// del ranking oficial de Telegram y las muestre en un mensaje.
bot.onText(/\/ranking/, (msg) => {
    const chatId = msg.chat.id;
    const messageId = msg.message_id; // Mensaje original del comando
    
    // Recupera las puntuaciones más altas del juego desde Telegram
    bot.getGameHighScores(msg.from.id, {
        chat_id: chatId,
        message_id: messageId, // Se puede usar el message_id del comando /ranking
                               // o el message_id del mensaje del juego inicial si se tiene.
    })
    .then((highScores) => {
        let rankingText = "🏆 **Ranking Shiro Coin** 🏆\n\n";
        if (highScores && highScores.length > 0) {
            highScores.forEach((entry, index) => {
                // Telegram devuelve el objeto 'user' para cada entrada del ranking
                rankingText += `${index + 1}. ${entry.user.first_name} ${entry.user.last_name || ''}: ${entry.score} puntos\n`;
            });
        } else {
            rankingText += "Aún no hay puntuaciones en el ranking. ¡Sé el primero en jugar!";
        }
        bot.sendMessage(chatId, rankingText, { parse_mode: 'Markdown' });
        console.log("Ranking de juego enviado al chat.");
    })
    .catch((error) => {
        console.error("Error al obtener el ranking de juego:", error.message);
        bot.sendMessage(chatId, "Lo siento, no pude recuperar el ranking en este momento.");
    });
});

// Manejo de errores del bot
bot.on('polling_error', (error) => {
  console.error(`Error de polling del bot: ${error.code} - ${error.message}`);
});

console.log("Bot de Telegram iniciado. Esperando mensajes...");
