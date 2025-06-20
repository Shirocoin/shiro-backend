const TelegramBot = require('node-telegram-bot-api');
const express = require("express");
const app = express();
const PORT = process.env.PORT || 10000;

// ✅ CONFIGURACIÓN CORREGIDA
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; 
const GAME_SHORT_NAME = 'ShiroCoinDash';
const GAME_URL = "https://elegante-stroopwafel-713eff.netlify.app";

if (!BOT_TOKEN) {
    console.error("ERROR: Token de Telegram Bot no configurado.");
    process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ✅ VARIABLE PARA ALMACENAR MESSAGE_ID DEL JUEGO
let gameMessages = new Map(); // chatId -> messageId

app.get("/", (req, res) => {
  console.log("Redirigiendo al juego...");
  res.redirect(GAME_URL);
});

app.listen(PORT, () => {
  console.log(`✅ Servidor escuchando en puerto ${PORT}`);
});

// ✅ COMANDO /start MEJORADO
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  console.log(`Comando /start del chat: ${chatId}`);

  const keyboard = {
    inline_keyboard: [[{ text: '🎮 Jugar Shiro Coin', callback_game: {}}]]
  };

  try {
    const sentMessage = await bot.sendGame(chatId, GAME_SHORT_NAME, { 
      reply_markup: keyboard 
    });
    
    // ✅ GUARDAR MESSAGE_ID PARA EL RANKING
    gameMessages.set(chatId, sentMessage.message_id);
    console.log(`✅ Juego enviado. MessageID: ${sentMessage.message_id}`);
    
  } catch (error) {
    console.error("❌ Error enviando juego:", error.message);
    bot.sendMessage(chatId, "Error al iniciar el juego. Verifica la configuración del bot.");
  }
});

// ✅ CALLBACK QUERY CORREGIDO
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  console.log(`Callback query de ${query.from.first_name || 'Usuario'}`);

  if (query.game_short_name === GAME_SHORT_NAME) {
    console.log(`✅ Abriendo juego: ${GAME_URL}`);
    await bot.answerCallbackQuery(query.id, { url: GAME_URL });
  } else {
    await bot.answerCallbackQuery(query.id, { text: "Juego no disponible." });
  }
});

// ✅ COMANDO /ranking COMPLETAMENTE CORREGIDO
bot.onText(/\/ranking/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`Comando /ranking solicitado por chat: ${chatId}`);
    
    try {
        // Obtenemos el message_id del juego enviado previamente
        const gameMessageId = gameMessages.get(chatId);
        
        if (!gameMessageId) {
            await bot.sendMessage(chatId, 
                "❌ Primero debes jugar al menos una vez. Usa /start para empezar.");
            return;
        }

        console.log(`Obteniendo ranking con messageId: ${gameMessageId}`);
        
        // ✅ LLAMADA CORREGIDA A getGameHighScores
        const highScores = await bot.getGameHighScores(msg.from.id, {
            chat_id: chatId,
            message_id: gameMessageId
        });
        
        console.log(`Respuesta de Telegram:`, highScores);
        
        let rankingText = "🏆 **RANKING SHIRO COIN** 🏆\n\n";
        
        if (highScores && highScores.length > 0) {
            // Ordenar por puntuación descendente
            const sortedScores = highScores.sort((a, b) => b.score - a.score);
            
            sortedScores.forEach((entry, index) => {
                const firstName = entry.user.first_name || 'Jugador';
                const lastName = entry.user.last_name || '';
                const fullName = `${firstName} ${lastName}`.trim();
                
                let medal = '';
                if (index === 0) medal = '🥇';
                else if (index === 1) medal = '🥈';
                else if (index === 2) medal = '🥉';
                else medal = `${index + 1}.`;
                
                rankingText += `${medal} ${fullName}: **${entry.score}** puntos\n`;
            });
        } else {
            rankingText += "📭 Aún no hay puntuaciones registradas.\n";
            rankingText += "¡Sé el primero en establecer un récord!";
        }
        
        await bot.sendMessage(chatId, rankingText, { 
            parse_mode: 'Markdown',
            reply_to_message_id: msg.message_id 
        });
        
        console.log("✅ Ranking enviado correctamente");
        
    } catch (error) {
        console.error("❌ Error obteniendo ranking:", error);
        
        let errorMessage = "❌ No pude obtener el ranking.";
        
        if (error.code === 400) {
            errorMessage += "\n\nAsegúrate de haber jugado al menos una vez usando /start";
        } else if (error.code === 403) {
            errorMessage += "\n\nPermisos insuficientes. Contacta al administrador.";
        }
        
        await bot.sendMessage(chatId, errorMessage);
    }
});

// ✅ LISTENER PARA ACTUALIZACIONES DE SCORE
bot.on('message', (msg) => {
    // Detectar cuando se actualiza una puntuación del juego
    if (msg.game_score !== undefined) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const userName = msg.from.first_name || 'Jugador';
        const score = msg.game_score;
        
        console.log(`🎯 Nueva puntuación registrada:`);
        console.log(`   Chat: ${chatId}`);
        console.log(`   Usuario: ${userName} (${userId})`);
        console.log(`   Puntuación: ${score}`);
        
        // Actualizar el mapping de messageId si es necesario
        if (msg.message_id) {
            gameMessages.set(chatId, msg.message_id);
        }
    }
});

// ✅ COMANDO DE AYUDA
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const helpText = `
🎮 **SHIRO COIN GAME**

**Comandos disponibles:**
/start - Iniciar el juego
/ranking - Ver top puntuaciones
/help - Mostrar esta ayuda

**Cómo jugar:**
🟡 Recoge monedas Shiro (+2 puntos)
🔴 Evita otras monedas (-1 punto)
⏰ Tienes 90 segundos
🎯 ¡Consigue la puntuación más alta!
    `;
    
    await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
});

// ✅ MANEJO DE ERRORES MEJORADO
bot.on('polling_error', (error) => {
  console.error(`❌ Error de polling: ${error.code} - ${error.message}`);
});

bot.on('error', (error) => {
  console.error(`❌ Error del bot:`, error);
});

console.log("🤖 Bot de Telegram iniciado correctamente");
console.log(`🎮 Juego: ${GAME_SHORT_NAME}`);
console.log(`🌐 URL: ${GAME_URL}`);
console.log("⏳ Esperando comandos...");
