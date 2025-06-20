const TelegramBot = require('node-telegram-bot-api');
const express = require("express");
const fs = require("fs");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; 
const GAME_SHORT_NAME = 'ShiroCoinDash';
const GAME_URL = "https://graceful-stroopwafel-713eff.netlify.app/";

if (!BOT_TOKEN) {
    console.error("ERROR: Token de Telegram Bot no configurado.");
    process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Archivo para almacenar puntuaciones localmente
const scoresFile = "scores.json";

// Función para leer puntuaciones
function readScores() {
    try {
        if (fs.existsSync(scoresFile)) {
            return JSON.parse(fs.readFileSync(scoresFile, 'utf8'));
        }
    } catch (error) {
        console.error("Error leyendo puntuaciones:", error);
    }
    return [];
}

// Función para guardar puntuaciones
function saveScores(scores) {
    try {
        fs.writeFileSync(scoresFile, JSON.stringify(scores, null, 2));
        return true;
    } catch (error) {
        console.error("Error guardando puntuaciones:", error);
        return false;
    }
}

// Función para actualizar puntuación de un usuario
function updateUserScore(userId, username, firstName, newScore) {
    const scores = readScores();
    const existingIndex = scores.findIndex(entry => entry.user_id === userId);
    
    if (existingIndex !== -1) {
        // Solo actualizar si la nueva puntuación es mayor
        if (newScore > scores[existingIndex].score) {
            scores[existingIndex].score = newScore;
            scores[existingIndex].updated_at = new Date().toISOString();
            console.log(`Puntuación actualizada para ${firstName}: ${newScore}`);
        } else {
            console.log(`Nueva puntuación ${newScore} no supera el récord actual de ${firstName}: ${scores[existingIndex].score}`);
            return false;
        }
    } else {
        // Nuevo usuario
        scores.push({
            user_id: userId,
            username: username,
            first_name: firstName,
            score: newScore,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        console.log(`Nueva puntuación registrada para ${firstName}: ${newScore}`);
    }
    
    return saveScores(scores);
}

// ✅ COMANDO /start - Envía el juego
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    console.log(`Comando /start recibido del chat: ${chatId}`);

    const keyboard = {
        inline_keyboard: [[{ text: '🎮 Jugar Shiro Coin', callback_game: {} }]]
    };

    bot.sendGame(chatId, GAME_SHORT_NAME, { reply_markup: keyboard })
        .then(() => {
            console.log(`Juego enviado exitosamente al chat ${chatId}`);
        })
        .catch((error) => {
            console.error("Error enviando juego:", error.message);
            bot.sendMessage(chatId, "❌ Error al cargar el juego. Verifica la configuración.");
        });
});

// ✅ CALLBACK QUERY - Abre el juego
bot.on('callback_query', (query) => {
    console.log(`Callback query recibida de ${query.from.first_name}`);
    
    if (query.game_short_name === GAME_SHORT_NAME) {
        bot.answerCallbackQuery(query.id, { url: GAME_URL });
        console.log(`Juego abierto para ${query.from.first_name}`);
    } else {
        bot.answerCallbackQuery(query.id, { text: "❌ Juego no reconocido" });
    }
});

// ✅ RECIBIR PUNTUACIONES - Maneja los datos del juego
bot.on('message', (msg) => {
    // Manejar datos enviados desde el juego
    if (msg.web_app_data) {
        try {
            const gameData = JSON.parse(msg.web_app_data.data);
            console.log('Datos recibidos del juego:', gameData);
            
            if (gameData.action === 'set_score') {
                const success = updateUserScore(
                    gameData.user_id,
                    gameData.username,
                    msg.from.first_name,
                    gameData.score
                );
                
                if (success) {
                    // Enviar confirmación al usuario
                    bot.sendMessage(msg.chat.id, 
                        `🎯 ¡Puntuación registrada!\n` +
                        `Jugador: ${msg.from.first_name}\n` +
                        `Puntos: ${gameData.score}\n\n` +
                        `Usa /ranking para ver el top 10`
                    );
                } else {
                    bot.sendMessage(msg.chat.id, 
                        `📊 Puntuación: ${gameData.score}\n` +
                        `No superaste tu récord anterior.\n\n` +
                        `Usa /ranking para ver el top 10`
                    );
                }
            }
        } catch (error) {
            console.error('Error procesando datos del juego:', error);
        }
    }
});

// ✅ COMANDO /ranking - Muestra el top 10
bot.onText(/\/ranking/, (msg) => {
    const chatId = msg.chat.id;
    console.log(`Comando /ranking solicitado por ${msg.from.first_name}`);
    
    const scores = readScores();
    
    if (scores.length === 0) {
        bot.sendMessage(chatId, 
            "🏆 **RANKING SHIRO COIN** 🏆\n\n" +
            "¡Aún no hay puntuaciones!\n" +
            "¡Sé el primero en jugar! 🎮\n\n" +
            "Usa /start para comenzar",
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    // Ordenar por puntuación descendente y tomar top 10
    const topScores = scores
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    
    let rankingText = "🏆 **RANKING SHIRO COIN** 🏆\n\n";
    
    topScores.forEach((entry, index) => {
        const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
        rankingText += `${medal} **${entry.first_name}** - ${entry.score} puntos\n`;
    });
    
    rankingText += `\n🎮 Usa /start para jugar`;
    
    bot.sendMessage(chatId, rankingText, { parse_mode: 'Markdown' });
    console.log("Ranking enviado exitosamente");
});

// ✅ COMANDO /mystats - Muestra estadísticas personales
bot.onText(/\/mystats/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    const scores = readScores();
    const userEntry = scores.find(entry => entry.user_id === userId);
    
    if (!userEntry) {
        bot.sendMessage(chatId, 
            "📊 **TUS ESTADÍSTICAS** 📊\n\n" +
            "Aún no has jugado.\n" +
            "¡Usa /start para comenzar! 🎮",
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    // Calcular posición en el ranking
    const sortedScores = scores.sort((a, b) => b.score - a.score);
    const position = sortedScores.findIndex(entry => entry.user_id === userId) + 1;
    
    const statsText = 
        "📊 **TUS ESTADÍSTICAS** 📊\n\n" +
        `🎯 **Mejor puntuación:** ${userEntry.score}\n` +
        `🏆 **Posición en ranking:** #${position} de ${scores.length}\n` +
        `📅 **Última actualización:** ${new Date(userEntry.updated_at).toLocaleDateString()}\n\n` +
        "🎮 Usa /start para jugar de nuevo";
    
    bot.sendMessage(chatId, statsText, { parse_mode: 'Markdown' });
});

// Ruta web principal
app.get("/", (req, res) => {
    res.redirect(GAME_URL);
});

// Endpoint para obtener ranking (API)
app.get("/api/ranking", (req, res) => {
    const scores = readScores();
    const topScores = scores
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    res.json(topScores);
});

// Manejo de errores
bot.on('polling_error', (error) => {
    console.error(`Error de polling: ${error.code} - ${error.message}`);
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`🤖 Bot de Telegram iniciado y esperando mensajes...`);
});

console.log("✅ Configuración completada. El bot está listo para funcionar.");
