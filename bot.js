const { Client, GatewayIntentBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const fs = require('fs');
const noblox = require('noblox.js');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds] 
});

const app = express();
app.use(express.json());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    
    next();
});

const TOKEN = process.env.DISCORD_TOKEN;
const PORT = process.env.PORT || 3000;

// 🤖 ROBLOX BOT HESABI BİLGİLERİ
const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE; // .ROBLOSECURITY cookie

let config = {
    allowedRoles: [],
    allowEveryone: false,
    allowedChannel: null,
    botAdmins: [],
    leaderUserId: "1308721547740975124"
};

let games = [];
let robloxLoggedIn = false;

// 🎮 GENRE İKONLARI
const GENRE_ICONS = {
    'Official': '⚔️',
    'SwordFight': '🗡️',
    'Crim': '🔫',
    'Slap': '👋',
    'Goat': '🐐'
};

function loadGames() {
    try {
        if (fs.existsSync('games.json')) {
            games = JSON.parse(fs.readFileSync('games.json', 'utf8'));
        }
    } catch (error) {
        console.error('Error loading games:', error);
    }
}

function saveGames() {
    try {
        fs.writeFileSync('games.json', JSON.stringify(games, null, 2));
    } catch (error) {
        console.error('Error saving games:', error);
    }
}

function loadConfig() {
    try {
        if (fs.existsSync('config.json')) {
            config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
        }
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

function saveConfig() {
    try {
        fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Error saving config:', error);
    }
}

function isBotAdmin(member) {
    if (member.guild.ownerId === member.id) return true;
    return config.botAdmins.includes(member.id);
}

function hasPermission(member) {
    if (isBotAdmin(member)) return true;
    if (config.allowEveryone) return true;
    return member.roles.cache.some(role => config.allowedRoles.includes(role.id));
}

function extractGameId(url) {
    const patterns = [
        /roblox\.com\/games\/(\d+)/,
        /^(\d+)$/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

async function getGameInfo(gameId) {
    try {
        console.log(`🔍 Fetching game info for ID: ${gameId}`);
        
        const universeResponse = await fetch(`https://apis.roblox.com/universes/v1/places/${gameId}/universe`);
        const universeData = await universeResponse.json();
        
        console.log('Universe data:', universeData);
        
        if (!universeData.universeId) {
            console.log('❌ No universe ID found');
            return null;
        }
        
        const universeId = universeData.universeId;
        const response = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
        const data = await response.json();
        
        console.log('Game data:', data);
        
        if (data.data && data.data.length > 0) {
            const gameData = data.data[0];
            console.log(`✅ Found game: ${gameData.name}, Playing: ${gameData.playing}, Max: ${gameData.maxPlayers}`);
            
            return {
                id: gameId,
                name: gameData.name,
                creator: gameData.creator.name,
                playing: gameData.playing || 0,
                maxPlayers: gameData.maxPlayers || 0
            };
        }
    } catch (error) {
        console.error('Error fetching game info:', error);
    }
    return null;
}

async function getGameStats(gameId) {
    try {
        console.log(`📊 Fetching stats for game ID: ${gameId}`);
        
        const universeResponse = await fetch(`https://apis.roblox.com/universes/v1/places/${gameId}/universe`);
        const universeData = await universeResponse.json();
        
        if (!universeData.universeId) {
            console.log('❌ No universe ID for stats');
            return { playing: 0, maxPlayers: 0 };
        }
        
        const universeId = universeData.universeId;
        const response = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            const stats = {
                playing: data.data[0].playing || 0,
                maxPlayers: data.data[0].maxPlayers || 0
            };
            console.log(`✅ Stats: ${stats.playing}/${stats.maxPlayers}`);
            return stats;
        }
    } catch (error) {
        console.error('Error fetching game stats:', error);
    }
    return { playing: 0, maxPlayers: 0 };
}

function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
}

// ═══════════════════════════════════════════════════════════
// 🤖 ROBLOX HESABINA GİRİŞ
// ═══════════════════════════════════════════════════════════

async function loginToRoblox() {
    if (!ROBLOX_COOKIE) {
        console.error('❌ ROBLOX_COOKIE environment variable not found!');
        console.log('💡 Set it in Railway: ROBLOX_COOKIE=your_.ROBLOSECURITY_cookie');
        return false;
    }

    try {
        console.log('🤖 Logging into Roblox...');
        
        const currentUser = await noblox.setCookie(ROBLOX_COOKIE);
        
        console.log(`✅ Logged in as: ${currentUser.UserName} (ID: ${currentUser.UserID})`);
        robloxLoggedIn = true;
        
        return true;
    } catch (error) {
        console.error('❌ Failed to login to Roblox:', error.message);
        console.log('💡 Make sure your .ROBLOSECURITY cookie is valid and not expired!');
        robloxLoggedIn = false;
        return false;
    }
}

// ═══════════════════════════════════════════════════════════
// 🎮 773 ERROR KONTROLÜ (ROBLOX HESABI İLE)
// ═══════════════════════════════════════════════════════════

async function check773ErrorWithRoblox(gameId, gameName) {
    if (!robloxLoggedIn) {
        console.log('⚠️ Roblox not logged in, skipping 773 check for', gameId);
        return { has773Error: false, reason: 'Not logged in' };
    }

    try {
        console.log(`\n🎮 Testing join for: ${gameName} (${gameId})`);
        
        // Oyunun PlaceId'sini al
        const placeId = gameId;
        
        // Oyuna katılmayı dene (sadece test için, gerçekte ışınlanmaz)
        console.log('📡 Attempting to get game instance info...');
        
        // noblox.js kullanarak oyun bilgilerini kontrol et
        const gameDetails = await noblox.getPlaceInfo(placeId);
        
        console.log('Game Details:', gameDetails);
        
        // Oyunun erişilebilir olup olmadığını kontrol et
        if (!gameDetails) {
            console.log('❌ Could not get game details - likely deleted or private');
            return { 
                has773Error: true, 
                reason: 'Game not accessible (404)',
                errorType: 'DELETED_OR_PRIVATE'
            };
        }
        
        // Grup oyunu mu kontrol et
        if (gameDetails.builder) {
            console.log(`🏢 Game is owned by: ${gameDetails.builder}`);
        }
        
        // Oyuna katılabilir mi test et
        try {
            // Game instances bilgisini al
            const instances = await noblox.getGameInstances(placeId);
            
            if (!instances || instances.length === 0) {
                console.log('⚠️ No active game servers found');
            } else {
                console.log(`✅ Found ${instances.length} active server(s)`);
            }
            
        } catch (instanceError) {
            console.log('Instance check error:', instanceError.message);
            
            // 773 error pattern kontrolü
            if (instanceError.message.includes('773') || 
                instanceError.message.includes('TeleportFailure') ||
                instanceError.message.includes('Unauthorized') ||
                instanceError.message.includes('not authorized')) {
                
                console.log('🚨 DETECTED 773 ERROR!');
                return { 
                    has773Error: true, 
                    reason: instanceError.message,
                    errorType: '773_TELEPORT_ERROR'
                };
            }
        }
        
        console.log('✅ No 773 error detected for this game');
        return { has773Error: false, reason: 'Game accessible' };
        
    } catch (error) {
        console.error('❌ Error checking 773:', error.message);
        
        // Error mesajında 773 var mı kontrol et
        const errorMsg = error.message.toLowerCase();
        
        if (errorMsg.includes('773') || 
            errorMsg.includes('teleport') ||
            errorMsg.includes('unauthorized') ||
            errorMsg.includes('not authorized') ||
            errorMsg.includes('you do not have permission')) {
            
            console.log('🚨 DETECTED 773 ERROR in exception!');
            return { 
                has773Error: true, 
                reason: error.message,
                errorType: '773_EXCEPTION'
            };
        }
        
        return { 
            has773Error: false, 
            reason: 'Error but not 773: ' + error.message 
        };
    }
}

// ═══════════════════════════════════════════════════════════
// 🧹 OTOMATIK 773 TEMİZLEME - 15 DAKİKADA BİR
// ═══════════════════════════════════════════════════════════

async function auto773Cleanup() {
    console.log('\n════════════════════════════════════════');
    console.log('🤖 AUTO 773-ERROR CLEANUP STARTED');
    console.log(`🕐 Time: ${new Date().toLocaleString()}`);
    console.log(`📊 Total games: ${games.length}`);
    console.log(`🔐 Roblox Logged In: ${robloxLoggedIn ? 'YES' : 'NO'}`);
    console.log('════════════════════════════════════════\n');
    
    if (games.length === 0) {
        console.log('✅ No games to check!\n');
        return;
    }
    
    if (!robloxLoggedIn) {
        console.log('⚠️ Roblox not logged in! Attempting login...\n');
        const loginSuccess = await loginToRoblox();
        
        if (!loginSuccess) {
            console.log('❌ Cannot perform 773 check without Roblox login!\n');
            return;
        }
    }
    
    const games773Error = [];
    const deletedGames = [];
    
    for (let i = 0; i < games.length; i++) {
        const game = games[i];
        console.log(`\n[${i + 1}/${games.length}] Checking: ${game.name} (${game.id})`);
        
        // Önce oyunun silinip silinmediğini kontrol et
        const exists = await checkGameExists(game.id);
        
        if (!exists) {
            console.log(`🗑️ GAME DELETED: ${game.name}`);
            deletedGames.push(game);
            continue;
        }
        
        // 773 error kontrolü
        const result = await check773ErrorWithRoblox(game.id, game.name);
        
        if (result.has773Error) {
            console.log(`🚨 773 ERROR DETECTED: ${game.name}`);
            console.log(`   Reason: ${result.reason}`);
            console.log(`   Type: ${result.errorType}`);
            games773Error.push({ ...game, errorReason: result.reason, errorType: result.errorType });
        } else {
            console.log(`✅ GAME OK: ${game.name}`);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 saniye bekle
    }
    
    const totalRemoved = games773Error.length + deletedGames.length;
    
    console.log('\n════════════════════════════════════════');
    console.log('📈 CLEANUP SUMMARY:');
    console.log(`✅ Valid Games: ${games.length - totalRemoved}`);
    console.log(`🚨 773 Errors: ${games773Error.length}`);
    console.log(`🗑️ Deleted Games: ${deletedGames.length}`);
    console.log(`❌ Total Removed: ${totalRemoved}`);
    console.log('════════════════════════════════════════\n');
    
    // Oyunları kaldır ve bildir
    const allRemovedGames = [...games773Error, ...deletedGames];
    
    if (allRemovedGames.length > 0) {
        games = games.filter(g => !allRemovedGames.find(r => r.id === g.id));
        saveGames();
        
        console.log(`✅ Removed ${allRemovedGames.length} game(s) from database`);
        
        // Kullanıcılara bildirim gönder
        for (const game of allRemovedGames) {
            try {
                console.log(`📧 Notifying ${game.addedBy}...`);
                const user = await client.users.fetch(game.addedByUserId);
                
                const is773 = games773Error.includes(game);
                
                const embed = new EmbedBuilder()
                    .setColor(is773 ? 0xFF6B6B : 0xFF4444)
                    .setTitle(is773 ? '🚨 Game Removed - 773 Error' : '🗑️ Game Removed - Deleted')
                    .setDescription(is773 ? 
                        'Your game was removed because the bot detected a **773 Teleport Error** when trying to join.\n\n**This means:**\n• The game is private/group-only\n• Bot account cannot access it\n• Players will get Error 773 when trying to join' :
                        'Your game was removed because it no longer exists on Roblox (404 Error).'
                    )
                    .addFields(
                        { name: '🎮 Game Name', value: game.customName || game.name, inline: true },
                        { name: '🆔 Game ID', value: game.id, inline: true },
                        { name: '📅 Added On', value: new Date(game.addedAt).toLocaleDateString(), inline: true }
                    )
                    .setFooter({ text: 'Retreat Gateway - Auto 773 Cleanup' })
                    .setTimestamp();
                
                if (is773 && game.errorReason) {
                    embed.addFields({ 
                        name: '⚠️ Error Details', 
                        value: `\`\`\`${game.errorReason}\`\`\``, 
                        inline: false 
                    });
                }
                
                await user.send({ embeds: [embed] });
                console.log(`✅ Notified ${game.addedBy}`);
            } catch (error) {
                console.error(`❌ Failed to notify ${game.addedBy}:`, error.message);
            }
        }
    } else {
        console.log('✅ No games removed. All games are valid!');
    }
    
    console.log('\n🧹 AUTO 773-CLEANUP FINISHED\n');
}

// Eski checkGameExists fonksiyonu (sadece silinen oyunlar için)
async function checkGameExists(gameId) {
    try {
        console.log(`🔍 Checking if game ${gameId} exists...`);
        
        const universeResponse = await fetch(`https://apis.roblox.com/universes/v1/places/${gameId}/universe`);
        
        if (universeResponse.status === 404) {
            console.log(`❌ Game ${gameId} is DELETED (404)`);
            return false;
        }
        
        if (!universeResponse.ok) {
            console.log(`⚠️ Game ${gameId} - HTTP ${universeResponse.status} - KEEPING`);
            return true;
        }
        
        const universeData = await universeResponse.json();
        
        if (!universeData.universeId) {
            console.log(`⚠️ Game ${gameId} - No universeId - KEEPING`);
            return true;
        }
        
        console.log(`✅ Game ${gameId} EXISTS`);
        return true;
        
    } catch (error) {
        console.error(`❌ Error checking game ${gameId}:`, error.message);
        return true;
    }
}

client.once('ready', async () => {
    console.log(`✅ Bot is online as ${client.user.tag}`);
    loadGames();
    loadConfig();
    
    // Roblox'a giriş yap
    console.log('\n🤖 Initializing Roblox login...');
    await loginToRoblox();
    
    console.log('\n⏰ Auto 773-cleanup schedule:');
    console.log('   📍 First run: in 30 seconds');
    console.log('   🔁 Repeat: every 15 minutes\n');
    
    // İlk kontrol 30 saniye sonra
    setTimeout(() => {
        console.log('🚀 Running first auto 773-cleanup...\n');
        auto773Cleanup();
    }, 30000);
    
    // Her 15 dakikada bir
    setInterval(() => {
        console.log('🚀 Running scheduled auto 773-cleanup...\n');
        auto773Cleanup();
    }, 15 * 60 * 1000);
});

// ... (Tüm diğer Discord komutları aynı kalacak)
// Modal, button interactions vb. aynı

client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        if (interaction.customId.startsWith('customize_')) {
            const gameId = interaction.customId.split('_')[1];
            
            const game = games.find(g => g.id === gameId);
            
            if (!game) {
                return interaction.reply({
                    content: '❌ Game not found!',
                    ephemeral: true
                });
            }
            
            if (game.addedByUserId !== interaction.user.id) {
                return interaction.reply({
                    content: '❌ You can only customize your own games!',
                    ephemeral: true
                });
            }
            
            const modal = new ModalBuilder()
                .setCustomId(`customizeModal_${gameId}`)
                .setTitle('✨ Customize Your Game');
            
            const nameInput = new TextInputBuilder()
                .setCustomId('customName')
                .setLabel('Custom Name (Optional)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter a custom name for your game...')
                .setMaxLength(50)
                .setRequired(false)
                .setValue(game.customName || '');
            
            const descInput = new TextInputBuilder()
                .setCustomId('customDescription')
                .setLabel('Custom Description (Optional)')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Enter a custom description...')
                .setMaxLength(200)
                .setRequired(false)
                .setValue(game.customDescription || '');
            
            const nameRow = new ActionRowBuilder().addComponents(nameInput);
            const descRow = new ActionRowBuilder().addComponents(descInput);
            
            modal.addComponents(nameRow, descRow);
            
            await interaction.showModal(modal);
        }
        
        if (interaction.customId.startsWith('sendlink_')) {
            const gameId = interaction.customId.split('_')[1];
            
            const game = games.find(g => g.id === gameId);
            
            if (!game) {
                return interaction.reply({
                    content: '❌ Game not found!',
                    ephemeral: true
                });
            }
            
            if (game.addedByUserId !== interaction.user.id) {
                return interaction.reply({
                    content: '❌ You can only send links for your own games!',
                    ephemeral: true
                });
            }
            
            await interaction.deferReply({ ephemeral: true });
            
            try {
                const leader = await client.users.fetch(config.leaderUserId);
                const gameLink = `https://www.roblox.com/games/${gameId}`;
                
                const stats = await getGameStats(gameId);
                
                const genreIcon = GENRE_ICONS[game.genre] || '🎮';
                
                const dmEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('🎮 New Game Link from Hub!')
                    .addFields(
                        { name: '🎮 Game Name', value: game.customName || game.name, inline: false },
                        { name: `${genreIcon} Genre`, value: game.genre, inline: true },
                        { name: '🆔 Game ID', value: gameId, inline: true },
                        { name: '👤 Sent By', value: interaction.user.tag, inline: true },
                        { name: '👥 Players', value: `${stats.playing}/${stats.maxPlayers}`, inline: true },
                        { name: '🔗 Game Link', value: gameLink, inline: false }
                    )
                    .setFooter({ text: 'Retreat Gateway - Game Link Request' })
                    .setTimestamp();
                
                if (game.customDescription) {
                    dmEmbed.addFields({ name: '📄 Description', value: game.customDescription, inline: false });
                }
                
                await leader.send({ embeds: [dmEmbed] });
                
                await interaction.editReply({
                    content: `✅ Game link sent to <@${config.leaderUserId}> successfully!`
                });
            } catch (error) {
                console.error('Failed to send DM to leader:', error);
                await interaction.editReply({
                    content: '❌ Failed to send link!',
                });
            }
        }
    }
    
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('customizeModal_')) {
            const gameId = interaction.customId.split('_')[1];
            const customName = interaction.fields.getTextInputValue('customName');
            const customDescription = interaction.fields.getTextInputValue('customDescription');
            
            const game = games.find(g => g.id === gameId);
            
            if (!game) {
                return interaction.reply({
                    content: '❌ Game not found!',
                    ephemeral: true
                });
            }
            
            const oldName = game.customName || game.name;
            const oldDesc = game.customDescription || 'No description';
            
            if (customName.trim()) {
                game.customName = customName.trim();
            }
            if (customDescription.trim()) {
                game.customDescription = customDescription.trim();
            }
            
            saveGames();
            
            const embed = new EmbedBuilder()
                .setColor(0x00D9FF)
                .setTitle('✨ Game Customized Successfully!')
                .addFields(
                    { name: '🎮 Game ID', value: gameId, inline: true },
                    { name: '👤 Customized by', value: interaction.user.tag, inline: true },
                    { name: '\u200B', value: '\u200B', inline: false }
                )
                .setFooter({ text: 'Changes are now live!' })
                .setTimestamp();
            
            if (customName.trim()) {
                embed.addFields(
                    { name: '📝 Name Updated', value: `~~${oldName}~~ → **${game.customName}**`, inline: false }
                );
            }
            
            if (customDescription.trim()) {
                embed.addFields(
                    { name: '📄 Description Updated', value: `~~${oldDesc}~~ → **${game.customDescription}**`, inline: false }
                );
            }
            
            if (!customName.trim() && !customDescription.trim()) {
                embed.setDescription('⚠️ No changes made.');
                embed.setColor(0xFFAA00);
            }
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    const channelRestrictedCommands = ['addgame', 'removegame', 'listgames', 'cleargames', 'help', 'stats', 'customizegame', 'checkgames', 'test773'];
    if (channelRestrictedCommands.includes(commandName)) {
        if (config.allowedChannel && interaction.channelId !== config.allowedChannel) {
            const channel = interaction.guild.channels.cache.get(config.allowedChannel);
            return interaction.reply({
                content: `❌ You can only use this command in ${channel}!`,
                ephemeral: true
            });
        }
    }

    const gameManagementCommands = ['addgame', 'cleargames'];
    if (gameManagementCommands.includes(commandName) && !hasPermission(interaction.member)) {
        return interaction.reply({
            content: '❌ You don\'t have permission!',
            ephemeral: true
        });
    }
    
    const adminCommands = ['setroles', 'setchannel', 'setadmin', 'checkgames', 'test773'];
    if (adminCommands.includes(commandName) && !isBotAdmin(interaction.member)) {
        return interaction.reply({
            content: '❌ Only bot admins can use this command!',
            ephemeral: true
        });
    }

    // 🆕 YENİ KOMUT: Tek bir oyunu test et
    if (commandName === 'test773') {
        const gameId = interaction.options.getString('gameid');
        
        if (!robloxLoggedIn) {
            return interaction.reply({
                content: '❌ Roblox bot is not logged in! Cannot perform 773 check.',
                ephemeral: true
            });
        }
        
        await interaction.deferReply();
        
        const game = games.find(g => g.id === gameId);
        const gameName = game ? (game.customName || game.name) : `Game ${gameId}`;
        
        const result = await check773ErrorWithRoblox(gameId, gameName);
        
        const embed = new EmbedBuilder()
            .setColor(result.has773Error ? 0xFF0000 : 0x00FF00)
            .setTitle(result.has773Error ? '🚨 773 Error Detected!' : '✅ No 773 Error')
            .addFields(
                { name: '🎮 Game', value: gameName, inline: true },
                { name: '🆔 Game ID', value: gameId, inline: true },
                { name: '📊 Result', value: result.has773Error ? '❌ BLOCKED' : '✅ ACCESSIBLE', inline: true }
            )
            .setTimestamp();
        
        if (result.has773Error) {
            embed.addFields(
                { name: '⚠️ Error Type', value: result.errorType || 'Unknown', inline: true },
                { name: '📝 Reason', value: `\`\`\`${result.reason}\`\`\``, inline: false }
            );
        }
        
        await interaction.editReply({ embeds: [embed] });
    }

    if (commandName === 'checkgames') {
        await interaction.deferReply();

        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('🔍 Checking All Games...')
            .setDescription('Running full 773 error + deletion check...')
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        // Manuel cleanup çalıştır
        await auto773Cleanup();

        const resultEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Check Complete')
            .setDescription('Auto-cleanup finished! Check console for details.')
            .addFields(
                { name: 'Total Games Now', value: `${games.length}`, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [resultEmbed] });
    }

    if (commandName === 'customizegame') {
        const gameId = interaction.options.getString('gameid');
        const customName = interaction.options.getString('name');
        const customDesc = interaction.options.getString('description');

        const game = games.find(g => g.id === gameId);

        if (!game) {
            return interaction.reply({
                content: '❌ Game not found!',
                ephemeral: true
            });
        }

        if (game.addedByUserId !== interaction.user.id) {
            return interaction.reply({
                content: `❌ You can only customize your own games!`,
                ephemeral: true
            });
        }

        const oldName = game.customName || game.name;
        const oldDesc = game.customDescription || 'No description';

        if (customName) {
            game.customName = customName;
        }
        if (customDesc) {
            game.customDescription = customDesc;
        }

        saveGames();

        const embed = new EmbedBuilder()
            .setColor(0x00D9FF)
            .setTitle('✨ Game Customized')
            .addFields(
                { name: '🎮 Game ID', value: gameId, inline: true },
                { name: '👤 Customized by', value: interaction.user.tag, inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'setadmin') {
        const action = interaction.options.getString('action');
        
        if (action === 'add') {
            const user = interaction.options.getUser('user');
            
            if (config.botAdmins.includes(user.id)) {
                return interaction.reply({
                    content: `❌ ${user.tag} is already a bot admin!`,
                    ephemeral: true
                });
            }
            
            config.botAdmins.push(user.id);
            saveConfig();
            
            return interaction.reply(`✅ Added ${user.tag} as bot admin!`);
        }
        
        else if (action === 'remove') {
            const user = interaction.options.getUser('user');
            
            const index = config.botAdmins.indexOf(user.id);
            if (index === -1) {
                return interaction.reply({
                    content: `❌ ${user.tag} is not a bot admin!`,
                    ephemeral: true
                });
            }
            
            config.botAdmins.splice(index, 1);
            saveConfig();
            
            return interaction.reply(`✅ Removed ${user.tag} from bot admins!`);
        }
        
        else if (action === 'list') {
            if (config.botAdmins.length === 0) {
                return interaction.reply('📋 No bot admins!');
            }
            
            const adminsList = config.botAdmins
                .map(userId => {
                    const user = interaction.guild.members.cache.get(userId);
                    return user ? `• ${user.user.tag}` : `• Unknown User`;
                })
                .join('\n');
            
            const embed = new EmbedBuilder()
                .setColor(0xFF5555)
                .setTitle('👑 Bot Admins')
                .setDescription(adminsList)
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed] });
        }
    }

    if (commandName === 'setchannel') {
        const channel = interaction.options.getChannel('channel');
        
        if (channel) {
            config.allowedChannel = channel.id;
            saveConfig();
            return interaction.reply(`✅ Bot will now only work in ${channel}!`);
        } else {
            config.allowedChannel = null;
            saveConfig();
            return interaction.reply('✅ Channel restriction removed!');
        }
    }

    if (commandName === 'help') {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🤖 Retreat Gateway Bot - 773 Detection Enabled')
            .addFields(
                {
                    name: '🎮 Game Commands',
                    value: '`/addgame` - Add game\n`/removegame` - Remove game\n`/customizegame` - Customize\n`/listgames` - List all\n`/cleargames` - Clear all\n`/checkgames` - Check 773 errors\n`/test773` - Test single game',
                    inline: false
                },
                {
                    name: '📊 Info',
                    value: '`/stats` - Statistics\n`/help` - This menu',
                    inline: false
                },
                {
                    name: '🔒 Admin',
                    value: '`/setadmin` - Manage admins\n`/setroles` - Manage roles\n`/setchannel` - Set channel',
                    inline: false
                },
                {
                    name: '🤖 Auto 773 Check',
                    value: 'Bot automatically checks all games every 15 minutes and removes those with 773 errors!',
                    inline: false
                }
            )
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'stats') {
        const userStats = {};
        const genreStats = {};
        
        games.forEach(game => {
            userStats[game.addedBy] = (userStats[game.addedBy] || 0) + 1;
            genreStats[game.genre] = (genreStats[game.genre] || 0) + 1;
        });
        
        const topContributors = Object.entries(userStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map((entry, index) => `${index + 1}. **${entry[0]}** - ${entry[1]} game${entry[1] > 1 ? 's' : ''}`)
            .join('\n');

        const genreList = Object.entries(genreStats)
            .map(([genre, count]) => `${GENRE_ICONS[genre] || '🎮'} **${genre}**: ${count}`)
            .join('\n');

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('📊 Hub Statistics')
            .addFields(
                {
                    name: '🎮 Total Games',
                    value: `${games.length}`,
                    inline: true
                },
                {
                    name: '🤖 Roblox Status',
                    value: robloxLoggedIn ? '✅ Logged In' : '❌ Not Logged In',
                    inline: true
                },
                {
                    name: '👑 Top Contributors',
                    value: topContributors || 'No games yet',
                    inline: false
                },
                {
                    name: '🎯 Games by Genre',
                    value: genreList || 'No games yet',
                    inline: false
                }
            )
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'setroles') {
        const action = interaction.options.getString('action');
        
        if (action === 'add') {
            const role = interaction.options.getRole('role');
            
            if (config.allowedRoles.includes(role.id)) {
                return interaction.reply({
                    content: `❌ Role already has permission!`,
                    ephemeral: true
                });
            }
            
            config.allowedRoles.push(role.id);
            saveConfig();
            
            return interaction.reply(`✅ Added ${role.name}!`);
        }
        
        else if (action === 'remove') {
            const role = interaction.options.getRole('role');
            
            const index = config.allowedRoles.indexOf(role.id);
            if (index === -1) {
                return interaction.reply({
                    content: `❌ Role doesn't have permission!`,
                    ephemeral: true
                });
            }
            
            config.allowedRoles.splice(index, 1);
            saveConfig();
            
            return interaction.reply(`✅ Removed ${role.name}!`);
        }
        
        else if (action === 'list') {
            if (config.allowEveryone) {
                return interaction.reply('📋 **Everyone** can manage!');
            }
            
            if (config.allowedRoles.length === 0) {
                return interaction.reply('📋 No roles yet!');
            }
            
            const rolesList = config.allowedRoles
                .map(roleId => {
                    const role = interaction.guild.roles.cache.get(roleId);
                    return role ? `• ${role.name}` : `• Unknown Role`;
                })
                .join('\n');
            
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('🔒 Allowed Roles')
                .setDescription(rolesList)
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed] });
        }
        
        else if (action === 'everyone') {
            const enable = interaction.options.getBoolean('enable');
            config.allowEveryone = enable;
            saveConfig();
            
            return interaction.reply(enable ? '✅ Everyone can manage!' : '✅ Restricted!');
        }
    }

    if (commandName === 'addgame') {
        const gameIdInput = interaction.options.getString('gameid');
        const genre = interaction.options.getString('genre');
        const gameId = extractGameId(gameIdInput);

        if (!gameId) {
            return interaction.reply({
                content: '❌ Invalid game ID!',
                ephemeral: true
            });
        }

        if (games.find(g => g.id === gameId)) {
            return interaction.reply({
                content: '❌ Already added!',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        let gameInfo = await getGameInfo(gameId);
        
        if (!gameInfo) {
            gameInfo = {
                id: gameId,
                name: `Game ${gameId}`,
                creator: 'Unknown',
                playing: 0,
                maxPlayers: 0
            };
        }

        games.push({
            id: gameInfo.id,
            name: gameInfo.name,
            creator: gameInfo.creator,
            genre: genre,
            addedBy: interaction.user.tag,
            addedByUserId: interaction.user.id,
            addedAt: Date.now(),
            customName: null,
            customDescription: null
        });

        saveGames();

        const genreIcon = GENRE_ICONS[genre] || '🎮';

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Game Added!')
            .addFields(
                { name: '🎮 Name', value: gameInfo.name, inline: true },
                { name: '🆔 ID', value: gameId, inline: true },
                { name: `${genreIcon} Genre`, value: genre, inline: true }
            )
            .setFooter({ text: 'Will be checked for 773 errors automatically' })
            .setTimestamp();

        const customizeButton = new ButtonBuilder()
            .setCustomId(`customize_${gameId}`)
            .setLabel('✨ Customize')
            .setStyle(ButtonStyle.Primary);

        const sendLinkButton = new ButtonBuilder()
            .setCustomId(`sendlink_${gameId}`)
            .setLabel('📤 Send Link')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(customizeButton, sendLinkButton);

        await interaction.editReply({ embeds: [embed], components: [row] });
    }

    else if (commandName === 'removegame') {
        const gameId = interaction.options.getString('gameid');
        const gameIndex = games.findIndex(g => g.id === gameId);

        if (gameIndex === -1) {
            return interaction.reply({
                content: '❌ Game not found!',
                ephemeral: true
            });
        }

        const game = games[gameIndex];
        
        if (game.addedByUserId !== interaction.user.id && !isBotAdmin(interaction.member)) {
            return interaction.reply({
                content: `❌ You can only remove your own games!`,
                ephemeral: true
            });
        }

        games.splice(gameIndex, 1);
        saveGames();

        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🗑️ Game Removed')
            .addFields(
                { name: 'Name', value: game.customName || game.name, inline: true },
                { name: 'ID', value: game.id, inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'listgames') {
        if (games.length === 0) {
            return interaction.reply('🔭 No games yet!');
        }

        const gamesByGenre = {};
        games.forEach(game => {
            if (!gamesByGenre[game.genre]) {
                gamesByGenre[game.genre] = [];
            }
            gamesByGenre[game.genre].push(game);
        });

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🎮 Games in Hub')
            .setDescription(`Total: ${games.length}`)
            .setTimestamp();

        for (const [genre, genreGames] of Object.entries(gamesByGenre)) {
            const genreIcon = GENRE_ICONS[genre] || '🎮';
            
            const gamesList = genreGames.map(game => {
                const displayName = game.customName || game.name;
                return `**${displayName}** (${game.id})`;
            }).join('\n');

            embed.addFields({
                name: `${genreIcon} ${genre} (${genreGames.length})`,
                value: gamesList,
                inline: false
            });
        }

        await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'cleargames') {
        if (games.length === 0) {
            return interaction.reply({
                content: '🔭 No games to clear!',
                ephemeral: true
            });
        }

        const count = games.length;
        games = [];
        saveGames();

        await interaction.reply(`🗑️ Cleared ${count} game(s)!`);
    }
});

// ═══════════════════════════════════════════════════════════
// 🌐 API ENDPOINTS
// ═══════════════════════════════════════════════════════════

app.get('/api/test', (req, res) => {
    res.json({ 
        success: true,
        message: 'API working!',
        robloxStatus: robloxLoggedIn ? 'Logged In' : 'Not Logged In',
        timestamp: Date.now()
    });
});

app.get('/api/games', async (req, res) => {
    const gamesWithStats = await Promise.all(
        games.map(async (g) => {
            const stats = await getGameStats(g.id);
            return {
                id: g.id,
                name: g.customName || g.name,
                creator: g.creator,
                genre: g.genre,
                description: g.customDescription || null,
                playing: stats.playing,
                maxPlayers: stats.maxPlayers,
                addedBy: g.addedBy
            };
        })
    );

    res.json({
        success: true,
        games: gamesWithStats
    });
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'online', 
        gameCount: games.length,
        robloxStatus: robloxLoggedIn ? 'logged_in' : 'not_logged_in'
    });
});

app.get('/', (req, res) => {
    res.json({ 
        message: 'Retreat Gateway Bot - 773 Detection',
        endpoints: ['/api/games', '/api/health', '/api/test']
    });
});

if (!TOKEN) {
    console.error('❌ DISCORD_TOKEN not found!');
    process.exit(1);
}

app.listen(PORT, () => {
    console.log(`🌐 API running on port ${PORT}`);
    client.login(TOKEN).catch(err => {
        console.error('❌ Login failed:', err);
        process.exit(1);
    });
});
