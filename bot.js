const { Client, GatewayIntentBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const fs = require('fs');
const noblox = require('noblox.js');
const fetch = require('node-fetch');

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
const ROBLOX_COOKIE = process.env.ROBLOSECURITY; // Bot'un Roblox hesabı cookie'si

let config = {
    allowedRoles: [],
    allowEveryone: false,
    allowedChannel: null,
    botAdmins: [],
    leaderUserId: "1308721547740975124"
};

let games = [];

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
// 🤖 ROBLOX ACCOUNT GAME VERIFICATION
// ═══════════════════════════════════════════════════════════
// Bot uses its Roblox account to check if game is accessible
// If bot can access → game is fine (public or bot has group access)
// If bot cannot access → game is deleted/banned → remove it

async function canBotAccessGame(gameId) {
    try {
        console.log(`🔍 Testing if bot can access game ${gameId}...`);
        
        if (!ROBLOX_COOKIE) {
            console.log(`⚠️ No Roblox cookie - using API fallback`);
            return await canAccessGameViaAPI(gameId);
        }
        
        try {
            // Try to get game info - this will fail if game doesn't exist
            const gameInfo = await noblox.getPlaceInfo(parseInt(gameId));
            
            if (!gameInfo || !gameInfo.name) {
                console.log(`❌ Game ${gameId} does not exist`);
                return false;
            }
            
            console.log(`✅ Bot can access game: ${gameInfo.name}`);
            return true;
            
        } catch (error) {
            // Check if it's a "game doesn't exist" error
            if (error.message.includes('does not exist') || 
                error.message.includes('not found') ||
                error.message.includes('invalid place')) {
                console.log(`❌ Game ${gameId} is deleted/banned`);
                return false;
            }
            
            // Unknown error - be safe and keep game
            console.log(`⚠️ Unknown error for ${gameId}: ${error.message} - keeping game`);
            return true;
        }
        
    } catch (error) {
        console.error(`❌ Error checking game ${gameId}:`, error.message);
        return true; // Be safe, don't delete on errors
    }
}

async function canAccessGameViaAPI(gameId) {
    try {
        const universeResponse = await fetch(`https://apis.roblox.com/universes/v1/places/${gameId}/universe`);
        
        if (universeResponse.status === 400 || universeResponse.status === 404) {
            return false; // Game doesn't exist
        }
        
        if (!universeResponse.ok) {
            return true; // Temporary error, keep game
        }
        
        const universeData = await universeResponse.json();
        
        if (!universeData.universeId) {
            return false; // No universe = deleted game
        }
        
        return true;
    } catch (error) {
        console.log(`⚠️ API check error for ${gameId}: ${error.message}`);
        return true; // Keep game on errors
    }
}

// Verify games every 30 minutes
setInterval(async () => {
    console.log('🔍 Starting automatic game verification...');
    
    if (games.length === 0) {
        console.log('No games to verify');
        return;
    }
    
    let removed = 0;
    const initialCount = games.length;
    
    for (let i = games.length - 1; i >= 0; i--) {
        const game = games[i];
        
        const canAccess = await canBotAccessGame(game.id);
        
        if (!canAccess) {
            console.log(`🗑️ Removing inaccessible game: ${game.name} (${game.id})`);
            games.splice(i, 1);
            removed++;
        }
        
        // Delay between checks to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (removed > 0) {
        saveGames();
        console.log(`✅ Verification complete: Removed ${removed}/${initialCount} inaccessible games`);
    } else {
        console.log(`✅ Verification complete: All ${initialCount} games are accessible`);
    }
    
}, 30 * 60 * 1000); // Every 30 minutes

// ═══════════════════════════════════════════════════════════
// 🚨 773 ERROR REPORTING SYSTEM
// ═══════════════════════════════════════════════════════════

async function handle773Report(playerName, playerUserId, gameId, errorCode) {
    console.log(`🚨 Processing 773 error for ${playerName} (${playerUserId}) in game ${gameId}`);
    
    // Find the game
    const game = games.find(g => g.id === gameId);
    
    if (!game) {
        console.log(`❌ Game ${gameId} not in hub`);
        return {
            success: false,
            error: 'Game not found in hub'
        };
    }
    
    // Verify if bot can access the game
    const canAccess = await canBotAccessGame(gameId);
    
    if (!canAccess) {
        console.log(`🗑️ Game ${gameId} is inaccessible - removing from hub`);
        
        // Remove game from hub
        const gameIndex = games.findIndex(g => g.id === gameId);
        if (gameIndex !== -1) {
            games.splice(gameIndex, 1);
            saveGames();
        }
        
        // Notify leader
        try {
            const user = await client.users.fetch(config.leaderUserId);
            
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🚨 773 Error - Game Removed')
                .setDescription(`A player reported error 773, and I verified the game is no longer accessible.`)
                .addFields(
                    { name: '🎮 Game', value: `${game.customName || game.name}\nID: ${game.id}`, inline: false },
                    { name: '👤 Reporter', value: playerUserId ? `${playerName} (${playerUserId})` : playerName, inline: false },
                    { name: '❌ Error Code', value: errorCode.toString(), inline: true },
                    { name: '🗑️ Action', value: 'Game removed from hub', inline: true }
                )
                .setTimestamp();
            
            await user.send({ embeds: [embed] });
            console.log('✅ Leader notified about removed game');
            
        } catch (error) {
            console.error('❌ Failed to notify leader:', error);
        }
        
        return {
            success: true,
            verified: true,
            gameRemoved: true,
            message: 'Game verified as inaccessible and removed from hub'
        };
    }
    
    // Game is still accessible, might be temporary issue
    console.log(`✅ Game ${gameId} is still accessible - possible temporary issue`);
    
    // Still notify leader about the report
    try {
        const user = await client.users.fetch(config.leaderUserId);
        
        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('⚠️ 773 Error Report (Game Still Accessible)')
            .setDescription(`A player reported error 773, but the game is still accessible to me. This might be a temporary issue.`)
            .addFields(
                { name: '🎮 Game', value: `${game.customName || game.name}\nID: ${game.id}`, inline: false },
                { name: '👤 Reporter', value: playerUserId ? `${playerName} (${playerUserId})` : playerName, inline: false },
                { name: '❌ Error Code', value: errorCode.toString(), inline: true },
                { name: '✅ Status', value: 'Game still in hub', inline: true }
            )
            .setFooter({ text: 'I will continue monitoring this game' })
            .setTimestamp();
        
        await user.send({ embeds: [embed] });
        console.log('✅ Leader notified about error report');
        
    } catch (error) {
        console.error('❌ Failed to notify leader:', error);
    }
    
    return {
        success: true,
        verified: false,
        gameRemoved: false,
        message: 'Game is still accessible, might be temporary issue'
    };
}

// ═══════════════════════════════════════════════════════════
// 🤖 BOT INITIALIZATION
// ═══════════════════════════════════════════════════════════

client.once('ready', async () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
    
    loadGames();
    loadConfig();
    
    if (ROBLOX_COOKIE) {
        try {
            await noblox.setCookie(ROBLOX_COOKIE);
            const currentUser = await noblox.getCurrentUser();
            console.log(`✅ Roblox account authenticated: ${currentUser.UserName} (${currentUser.UserID})`);
        } catch (error) {
            console.error('❌ Failed to authenticate Roblox account:', error.message);
            console.log('⚠️ Bot will use API fallback for game verification');
        }
    } else {
        console.log('⚠️ No ROBLOSECURITY cookie - using API fallback');
    }
    
    const commands = [
        {
            name: 'addgame',
            description: 'Add a new game to the hub',
            options: [
                {
                    name: 'gameid',
                    type: 3, // STRING
                    description: 'Roblox game ID or URL',
                    required: true
                },
                {
                    name: 'genre',
                    type: 3,
                    description: 'Game genre',
                    required: true,
                    choices: [
                        { name: '⚔️ Official', value: 'Official' },
                        { name: '🗡️ SwordFight', value: 'SwordFight' },
                        { name: '🔫 Crim', value: 'Crim' },
                        { name: '👋 Slap', value: 'Slap' },
                        { name: '🐐 Goat', value: 'Goat' }
                    ]
                }
            ]
        },
        {
            name: 'removegame',
            description: 'Remove a game from the hub',
            options: [
                {
                    name: 'gameid',
                    type: 3,
                    description: 'Game ID to remove',
                    required: true
                }
            ]
        },
        {
            name: 'listgames',
            description: 'List all games in the hub'
        },
        {
            name: 'cleargames',
            description: '🔴 Remove ALL games (Admin only)'
        },
        {
            name: 'setpermissions',
            description: 'Configure bot permissions (Admin only)',
            options: [
                {
                    name: 'mode',
                    type: 3,
                    description: 'Who can use the bot',
                    required: true,
                    choices: [
                        { name: 'Everyone', value: 'everyone' },
                        { name: 'Specific roles only', value: 'roles' }
                    ]
                }
            ]
        },
        {
            name: 'addrole',
            description: 'Add a role that can use the bot (Admin only)',
            options: [
                {
                    name: 'role',
                    type: 8, // ROLE
                    description: 'Role to add',
                    required: true
                }
            ]
        },
        {
            name: 'removerole',
            description: 'Remove an allowed role (Admin only)',
            options: [
                {
                    name: 'role',
                    type: 8,
                    description: 'Role to remove',
                    required: true
                }
            ]
        },
        {
            name: 'listroles',
            description: 'Show all allowed roles'
        },
        {
            name: 'setchannel',
            description: 'Set the channel where bot can be used (Admin only)',
            options: [
                {
                    name: 'channel',
                    type: 7, // CHANNEL
                    description: 'Channel to set (leave empty to allow all channels)',
                    required: false
                }
            ]
        },
        {
            name: 'addadmin',
            description: 'Add a bot administrator (Server Owner only)',
            options: [
                {
                    name: 'user',
                    type: 6, // USER
                    description: 'User to make admin',
                    required: true
                }
            ]
        },
        {
            name: 'removeadmin',
            description: 'Remove a bot administrator (Server Owner only)',
            options: [
                {
                    name: 'user',
                    type: 6,
                    description: 'User to remove from admins',
                    required: true
                }
            ]
        },
        {
            name: 'listadmins',
            description: 'List all bot administrators'
        },
        {
            name: 'botstatus',
            description: 'Show bot configuration and status'
        }
    ];

    try {
        await client.application.commands.set(commands);
        console.log('✅ Commands registered successfully');
    } catch (error) {
        console.error('❌ Failed to register commands:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        const [action, gameId] = interaction.customId.split('_');

        if (action === 'customize') {
            const game = games.find(g => g.id === gameId);
            
            if (!game) {
                return interaction.reply({
                    content: '❌ Game not found!',
                    ephemeral: true
                });
            }

            if (game.addedByUserId !== interaction.user.id) {
                return interaction.reply({
                    content: '❌ Only the person who added this game can customize it!',
                    ephemeral: true
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(`modal_customize_${gameId}`)
                .setTitle('✨ Customize Game');

            const nameInput = new TextInputBuilder()
                .setCustomId('customName')
                .setLabel('Custom Name (leave empty to use original)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(100);

            if (game.customName) {
                nameInput.setValue(game.customName);
            }

            const descInput = new TextInputBuilder()
                .setCustomId('customDescription')
                .setLabel('Custom Description (optional)')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(500);

            if (game.customDescription) {
                descInput.setValue(game.customDescription);
            }

            const row1 = new ActionRowBuilder().addComponents(nameInput);
            const row2 = new ActionRowBuilder().addComponents(descInput);

            modal.addComponents(row1, row2);

            await interaction.showModal(modal);
        }

        else if (action === 'sendlink') {
            const game = games.find(g => g.id === gameId);
            
            if (!game) {
                return interaction.reply({
                    content: '❌ Game not found!',
                    ephemeral: true
                });
            }

            if (game.addedByUserId !== interaction.user.id) {
                return interaction.reply({
                    content: '❌ Only the person who added this game can send the link!',
                    ephemeral: true
                });
            }

            try {
                const user = await client.users.fetch(config.leaderUserId);
                
                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('🔗 New Game Link')
                    .addFields(
                        { name: '🎮 Game', value: game.customName || game.name, inline: true },
                        { name: '🆔 ID', value: game.id, inline: true },
                        { name: `${GENRE_ICONS[game.genre]} Genre`, value: game.genre, inline: true },
                        { name: '👤 Added by', value: game.addedBy, inline: true },
                        { name: '🔗 Link', value: `https://www.roblox.com/games/${game.id}`, inline: false }
                    );

                if (game.customDescription) {
                    embed.addFields({ name: '📝 Description', value: game.customDescription, inline: false });
                }

                embed.setTimestamp();

                await user.send({ embeds: [embed] });
                
                await interaction.reply({
                    content: '✅ Link sent to profound!',
                    ephemeral: true
                });

            } catch (error) {
                console.error('Error sending link:', error);
                await interaction.reply({
                    content: '❌ Failed to send link!',
                    ephemeral: true
                });
            }
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('modal_customize_')) {
            const gameId = interaction.customId.replace('modal_customize_', '');
            const game = games.find(g => g.id === gameId);

            if (!game) {
                return interaction.reply({
                    content: '❌ Game not found!',
                    ephemeral: true
                });
            }

            const customName = interaction.fields.getTextInputValue('customName').trim();
            const customDescription = interaction.fields.getTextInputValue('customDescription').trim();

            game.customName = customName || null;
            game.customDescription = customDescription || null;

            saveGames();

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Game Customized!')
                .addFields(
                    { name: '🎮 Original Name', value: game.name, inline: true },
                    { name: '✨ Custom Name', value: game.customName || 'Not set', inline: true },
                    { name: '📝 Description', value: game.customDescription || 'Not set', inline: false }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }

    if (!interaction.isChatInputCommand()) return;

    const commandName = interaction.commandName;

    // Check channel permissions (except for admin commands)
    if (!['setpermissions', 'addrole', 'removerole', 'listroles', 'setchannel', 'addadmin', 'removeadmin', 'listadmins', 'botstatus'].includes(commandName)) {
        if (config.allowedChannel && interaction.channelId !== config.allowedChannel) {
            return interaction.reply({
                content: `❌ This command can only be used in <#${config.allowedChannel}>`,
                ephemeral: true
            });
        }

        if (!hasPermission(interaction.member)) {
            return interaction.reply({
                content: '❌ You do not have permission to use this command!',
                ephemeral: true
            });
        }
    }

    // ═══════════════════════════════════════════════════════════
    // 🛠️ ADMIN COMMANDS
    // ═══════════════════════════════════════════════════════════

    if (commandName === 'setpermissions') {
        if (!isBotAdmin(interaction.member)) {
            return interaction.reply({
                content: '❌ Only bot administrators can use this command!',
                ephemeral: true
            });
        }

        const mode = interaction.options.getString('mode');
        config.allowEveryone = (mode === 'everyone');
        saveConfig();

        await interaction.reply({
            content: mode === 'everyone' 
                ? '✅ Everyone can now use the bot!' 
                : '✅ Only users with allowed roles can use the bot!',
            ephemeral: true
        });
    }

    else if (commandName === 'addrole') {
        if (!isBotAdmin(interaction.member)) {
            return interaction.reply({
                content: '❌ Only bot administrators can use this command!',
                ephemeral: true
            });
        }

        const role = interaction.options.getRole('role');

        if (config.allowedRoles.includes(role.id)) {
            return interaction.reply({
                content: '❌ This role is already allowed!',
                ephemeral: true
            });
        }

        config.allowedRoles.push(role.id);
        saveConfig();

        await interaction.reply({
            content: `✅ Added role: ${role.name}`,
            ephemeral: true
        });
    }

    else if (commandName === 'removerole') {
        if (!isBotAdmin(interaction.member)) {
            return interaction.reply({
                content: '❌ Only bot administrators can use this command!',
                ephemeral: true
            });
        }

        const role = interaction.options.getRole('role');
        const index = config.allowedRoles.indexOf(role.id);

        if (index === -1) {
            return interaction.reply({
                content: '❌ This role is not in the allowed list!',
                ephemeral: true
            });
        }

        config.allowedRoles.splice(index, 1);
        saveConfig();

        await interaction.reply({
            content: `✅ Removed role: ${role.name}`,
            ephemeral: true
        });
    }

    else if (commandName === 'listroles') {
        if (config.allowedRoles.length === 0) {
            return interaction.reply({
                content: '📋 No roles configured yet!',
                ephemeral: true
            });
        }

        const roles = config.allowedRoles.map(id => `<@&${id}>`).join('\n');
        
        await interaction.reply({
            content: `📋 **Allowed Roles:**\n${roles}`,
            ephemeral: true
        });
    }

    else if (commandName === 'setchannel') {
        if (!isBotAdmin(interaction.member)) {
            return interaction.reply({
                content: '❌ Only bot administrators can use this command!',
                ephemeral: true
            });
        }

        const channel = interaction.options.getChannel('channel');

        if (!channel) {
            config.allowedChannel = null;
            saveConfig();
            return interaction.reply({
                content: '✅ Bot can now be used in any channel!',
                ephemeral: true
            });
        }

        config.allowedChannel = channel.id;
        saveConfig();

        await interaction.reply({
            content: `✅ Bot can now only be used in ${channel}`,
            ephemeral: true
        });
    }

    else if (commandName === 'addadmin') {
        if (interaction.guild.ownerId !== interaction.user.id) {
            return interaction.reply({
                content: '❌ Only the server owner can add bot administrators!',
                ephemeral: true
            });
        }

        const user = interaction.options.getUser('user');

        if (config.botAdmins.includes(user.id)) {
            return interaction.reply({
                content: '❌ This user is already a bot administrator!',
                ephemeral: true
            });
        }

        config.botAdmins.push(user.id);
        saveConfig();

        await interaction.reply({
            content: `✅ Added ${user.tag} as a bot administrator!`,
            ephemeral: true
        });
    }

    else if (commandName === 'removeadmin') {
        if (interaction.guild.ownerId !== interaction.user.id) {
            return interaction.reply({
                content: '❌ Only the server owner can remove bot administrators!',
                ephemeral: true
            });
        }

        const user = interaction.options.getUser('user');
        const index = config.botAdmins.indexOf(user.id);

        if (index === -1) {
            return interaction.reply({
                content: '❌ This user is not a bot administrator!',
                ephemeral: true
            });
        }

        config.botAdmins.splice(index, 1);
        saveConfig();

        await interaction.reply({
            content: `✅ Removed ${user.tag} from bot administrators!`,
            ephemeral: true
        });
    }

    else if (commandName === 'listadmins') {
        if (config.botAdmins.length === 0) {
            return interaction.reply({
                content: '📋 No bot administrators configured!',
                ephemeral: true
            });
        }

        const admins = config.botAdmins.map(id => `<@${id}>`).join('\n');
        
        await interaction.reply({
            content: `📋 **Bot Administrators:**\n${admins}`,
            ephemeral: true
        });
    }

    else if (commandName === 'botstatus') {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🤖 Bot Status')
            .addFields(
                { name: '🎮 Games', value: games.length.toString(), inline: true },
                { name: '⏰ Uptime', value: formatUptime(client.uptime), inline: true },
                { name: '👥 Permission Mode', value: config.allowEveryone ? 'Everyone' : 'Specific Roles', inline: true },
                { name: '📢 Allowed Channel', value: config.allowedChannel ? `<#${config.allowedChannel}>` : 'Any Channel', inline: true },
                { name: '🎭 Allowed Roles', value: config.allowedRoles.length > 0 ? config.allowedRoles.map(id => `<@&${id}>`).join(', ') : 'None', inline: false },
                { name: '🔧 Bot Admins', value: config.botAdmins.length > 0 ? config.botAdmins.map(id => `<@${id}>`).join(', ') : 'None', inline: false }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ═══════════════════════════════════════════════════════════
    // 🎮 GAME COMMANDS
    // ═══════════════════════════════════════════════════════════

    else if (commandName === 'addgame') {
        const gameInput = interaction.options.getString('gameid');
        const genre = interaction.options.getString('genre');

        const gameId = extractGameId(gameInput);

        if (!gameId) {
            return interaction.reply({
                content: '❌ Invalid game ID or URL!',
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
            .setTitle('✅ Game Added Successfully!')
            .addFields(
                { name: '🎮 Name', value: gameInfo.name, inline: true },
                { name: '🆔 ID', value: gameId, inline: true },
                { name: `${genreIcon} Genre`, value: genre, inline: true },
                { name: '👤 Creator', value: gameInfo.creator, inline: true },
                { name: '👥 Players', value: `${gameInfo.playing}/${gameInfo.maxPlayers}`, inline: true }
            )
            .setDescription('**Customize or share this game!**\nUse the buttons below:')
            .setFooter({ text: 'Only you can use these buttons!' })
            .setTimestamp();

        const customizeButton = new ButtonBuilder()
            .setCustomId(`customize_${gameId}`)
            .setLabel('✨ Customize Game')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎨');

        const sendLinkButton = new ButtonBuilder()
            .setCustomId(`sendlink_${gameId}`)
            .setLabel('📤 Send Link to profound')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🔗');

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
                content: `❌ You can only remove your own games!\nThis was added by **${game.addedBy}**`,
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
                { name: 'ID', value: game.id, inline: true },
                { name: 'Genre', value: `${GENRE_ICONS[game.genre] || '🎮'} ${game.genre}`, inline: true }
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
            
            const gamesList = await Promise.all(
                genreGames.map(async (game) => {
                    const uptime = Date.now() - game.addedAt;
                    const uptimeText = formatUptime(uptime);
                    const stats = await getGameStats(game.id);
                    const displayName = game.customName || game.name;
                    
                    return `**${displayName}** (ID: ${game.id})\n⏱️ ${uptimeText} | 👥 ${stats.playing}/${stats.maxPlayers}`;
                })
            );

            embed.addFields({
                name: `${genreIcon} ${genre} (${genreGames.length})`,
                value: gamesList.join('\n\n'),
                inline: false
            });
        }

        await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'cleargames') {
        if (!isBotAdmin(interaction.member)) {
            return interaction.reply({
                content: '❌ Only bot administrators can clear all games!',
                ephemeral: true
            });
        }

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
    console.log('🧪 Test endpoint hit!');
    res.json({ 
        success: true,
        message: 'API is working perfectly!',
        timestamp: Date.now(),
        botOnline: client.user ? true : false
    });
});

app.get('/api/games', async (req, res) => {
    console.log('📥 Games endpoint hit!');
    
    const gamesWithStats = await Promise.all(
        games.map(async (g) => {
            const stats = await getGameStats(g.id);
            return {
                id: g.id,
                name: g.customName || g.name,
                originalName: g.name,
                creator: g.creator,
                genre: g.genre,
                description: g.customDescription || null,
                uptime: Date.now() - g.addedAt,
                uptimeFormatted: formatUptime(Date.now() - g.addedAt),
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
        botStatus: client.user ? 'connected' : 'disconnected'
    });
});

// ═══════════════════════════════════════════════════════════
// 🚨 773 ERROR REPORT ENDPOINT
// ═══════════════════════════════════════════════════════════
app.post('/api/report773', async (req, res) => {
    console.log('📥 773 Error report received!');
    console.log('Request body:', req.body);
    
    const { playerName, playerUserId, gameId, errorCode } = req.body;
    
    if (!playerName || !gameId || !errorCode) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: playerName, gameId, errorCode'
        });
    }
    
    const result = await handle773Report(playerName, playerUserId, gameId, errorCode);
    
    res.json(result);
});

app.get('/', (req, res) => {
    res.json({ 
        message: 'Retreat Gateway Bot API',
        endpoints: ['/api/games', '/api/health', '/api/test', '/api/report773']
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
