const TelegramBot = require('node-telegram-bot-api');
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; 
const GAME_SHORT_NAME = 'ShiroCoinDash';
const GAME_URL = "https://graceful-stroopwafel-713eff.netlify.app";

if (!BOT_TOKEN) {
    console.error("ERROR: Token de Telegram Bot no configurado.");
    process.exit(1);
}

app.use(express.json());
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// 🏆 SISTEMA DE RANKINGS INTERNO
let rankings = {};
let gameMessages = new Map();

// ✅ FUNCIÓN PARA ACTUALIZAR RANKING
function updateRanking(userId, username, score) {
    if (!rankings[userId] || rankings[userId].score < score) {
        rankings[userId] = {
            username: username || 'Usuario',
            score: score,
            lastUpdate: new Date().toISOString()
        };
        console.log(`🏆 Ranking actualizado: ${username} - ${score} puntos`);
        return true;
    }
    return false;
}

// ✅ FUNCIÓN PARA OBTENER TOP RANKINGS
function getTopRankings(limit = 10) {
    return Object.entries(rankings)
        .map(([userId, data]) => ({
            userId,
            username: data.username,
            score: data.score,
            lastUpdate: data.lastUpdate
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

app.get("/", (req, res) => {
  console.log("Redirigiendo al juego...");
  res.redirect(GAME_URL);
});

app.listen(PORT, () => {
  console.log(`✅ Servidor escuchando en puerto ${PORT}`);
  console.log(`🎮 Juego: ${GAME_SHORT_NAME}`);
  console.log(`🌐 URL: ${GAME_URL}`);
});

// ✅ COMANDO /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || msg.from.first_name || 'Usuario';
  
  console.log(`Comando /start del chat: ${chatId}, usuario: ${userId}`);

  const keyboard = {
    inline_keyboard: [[{ 
      text: '🎮 Jugar Shiro Coin', 
      web_app: { url: GAME_URL } 
    }]]
  };

  try {
    const welcomeMessage = `🐱 ¡Hola ${username}! Bienvenido a Shiro Coin Game! 🪙

🎮 ¡Haz clic en el botón para jugar!
🏆 Usa /ranking para ver las mejores puntuaciones`;

    const sentMessage = await bot.sendMessage(chatId, welcomeMessage, { 
      reply_markup: keyboard 
    });
    
    gameMessages.set(chatId, {
      messageId: sentMessage.message_id,
      userId: userId
    });
    
    console.log(`✅ Mini App enviado. Chat: ${chatId}, Usuario: ${userId}`);
    
  } catch (error) {
    console.error("❌ Error enviando Mini App:", error.message);
    bot.sendMessage(chatId, "Error al iniciar el juego. Verifica la configuración del bot.");
  }
});

// ✅ COMANDO /ranking
bot.onText(/\/ranking/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    console.log(`Comando /ranking solicitado por chat: ${chatId}, usuario: ${userId}`);
    
    const topRankings = getTopRankings(10);
    
    if (topRankings.length === 0) {
        await bot.sendMessage(chatId, '📊 El ranking está vacío. ¡Sé el primero en jugar!');
        return;
    }
    
    let rankingText = '🏆 **RANKING SHIRO COIN** 🏆\n\n';
    
    topRankings.forEach((player, index) => {
        const position = index + 1;
        const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '🏅';
        rankingText += `${medal} ${position}. ${player.username} - ${player.score} puntos\n`;
    });
    
    // Mostrar posición del usuario actual
    if (rankings[userId]) {
        const userRank = topRankings.findIndex(p => p.userId == userId) + 1;
        if (userRank > 0) {
            rankingText += `\n👤 Tu posición: #${userRank}`;
        }
    }
    
    await bot.sendMessage(chatId, rankingText, { parse_mode: 'Markdown' });
});

// ✅ COMANDO /testscore
bot.onText(/\/testscore (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.username || msg.from.first_name || 'Usuario';
    const score = parseInt(match[1]);
    
    console.log(`Comando /testscore: ${userName} quiere registrar ${score} puntos`);
    
    const updated = updateRanking(userId, userName, score);
    
    if (updated) {
        await bot.sendMessage(chatId, `✅ Score de ${score} registrado para ${userName}!`);
    } else {
        const currentScore = rankings[userId]?.score || 0;
        await bot.sendMessage(chatId, `📊 Tu puntuación actual (${currentScore}) es mayor o igual.\nNecesitas más de ${currentScore} puntos para actualizar.`);
    }
});

// ✅ MANEJO DE DATOS DEL MINI APP
bot.on('message', async (msg) => {
    // 🔍 DEBUG: Ver todos los mensajes que llegan
    console.log('📨 MENSAJE RECIBIDO TIPO:', msg.content_type || 'unknown');
    
    if (msg.web_app_data) {
        console.log('📡 Datos recibidos de Mini App:', msg.web_app_data.data);
        
        try {
            const appData = JSON.parse(msg.web_app_data.data);
            console.log('📊 Datos parseados:', appData);
            
            if (appData.action === 'setGameScore' && appData.score !== undefined) {
                const chatId = msg.chat.id;
                const userId = msg.from.id;
                const userName = msg.from.username || msg.from.first_name || 'Usuario';
                const score = parseInt(appData.score);
                
                console.log(`🎯 Score recibido del juego: ${userName} = ${score}`);
                
                const updated = updateRanking(userId, userName, score);
                
                if (updated) {
                    await bot.sendMessage(chatId, `🎉 ¡Nuevo récord! ${userName}: ${score} puntos\n\nUsa /ranking para ver tu posición.`);
                    console.log(`✅ Score ${score} actualizado en ranking`);
                } else {
                    const currentScore = rankings[userId]?.score || 0;
                    await bot.sendMessage(chatId, `🎮 Partida terminada: ${score} puntos\nTu récord actual: ${currentScore} puntos`);
                    console.log(`📊 Score ${score} no supera el récord actual: ${currentScore}`);
                }
            }
        } catch (error) {
            console.error('❌ Error parseando datos de Mini App:', error);
        }
    }
    
    // ✅ SUPPORT PARA TELEGRAM GAMES (por si acaso)
    if (msg.game_score !== undefined) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const userName = msg.from.username || msg.from.first_name || 'Usuario';
        const score = msg.game_score;
        
        console.log(`🎯 Score recibido de Telegram Game: ${userName} = ${score}`);
        
        const updated = updateRanking(userId, userName, score);
        
        if (updated) {
            await bot.sendMessage(chatId, `🎉 ¡Nuevo récord! ${userName}: ${score} puntos`);
        }
    }
});

// ✅ COMANDO /help
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const helpText = `
🎮 **SHIRO COIN GAME**

**Comandos disponibles:**
/start - Iniciar el juego
/ranking - Ver top puntuaciones
/testscore [número] - Registrar score manualmente
/help - Mostrar esta ayuda

**Cómo jugar:**
🟡 Recoge monedas Shiro (+2 puntos)
🔴 Evita otras monedas (-1 punto)
⏰ Tienes 90 segundos
🎯 ¡Consigue la puntuación más alta!

**Ejemplo:** /testscore 25
    `;
    
    await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
});

bot.on('polling_error', (error) => {
  console.error(`❌ Error de polling: ${error.code} - ${error.message}`);
});

bot.on('error', (error) => {
  console.error(`❌ Error del bot:`, error);
});

console.log("🤖 Bot de Telegram iniciado correctamente");
console.log("📱 Configurado para Mini App");
console.log("⏳ Esperando comandos...");
