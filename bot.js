const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
const fs = require('fs');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds] 
});

const app = express();
app.use(express.json());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

const TOKEN = process.env.DISCORD_TOKEN;
const PORT = process.env.PORT || 3000;

let config = {
    allowedRoles: [],
    allowEveryone: false,
    allowedChannel: null,
    botAdmins: []
};

let games = [];

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
        const universeResponse = await fetch(`https://apis.roblox.com/universes/v1/places/${gameId}/universe`);
        const universeData = await universeResponse.json();
        
        if (!universeData.universeId) {
            return null;
        }
        
        const universeId = universeData.universeId;
        const response = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            return {
                id: gameId,
                name: data.data[0].name,
                creator: data.data[0].creator.name,
                playing: data.data[0].playing || 0,
                maxPlayers: data.data[0].maxPlayers || 0
            };
        }
    } catch (error) {
        console.error('Error fetching game info:', error);
    }
    return null;
}

async function getGameStats(gameId) {
    try {
        const universeResponse = await fetch(`https://apis.roblox.com/universes/v1/places/${gameId}/universe`);
        const universeData = await universeResponse.json();
        
        if (!universeData.universeId) {
            return { playing: 0, maxPlayers: 0 };
        }
        
        const universeId = universeData.universeId;
        const response = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            return {
                playing: data.data[0].playing || 0,
                maxPlayers: data.data[0].maxPlayers || 0
            };
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

client.once('ready', () => {
    console.log(`✅ Bot is online as ${client.user.tag}`);
    loadGames();
    loadConfig();
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // Channel restriction check - except for setchannel and admin commands
    const channelRestrictedCommands = ['addgame', 'removegame', 'listgames', 'cleargames', 'help', 'stats'];
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
            content: '❌ You don\'t have permission!\n💡 Ask admin to add your role: `/setroles action:add role:@YourRole`',
            ephemeral: true
        });
    }
    
    const adminCommands = ['setroles', 'setchannel', 'setadmin'];
    if (adminCommands.includes(commandName) && !isBotAdmin(interaction.member)) {
        return interaction.reply({
            content: '❌ Only bot admins can use this command!',
            ephemeral: true
        });
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
                return interaction.reply('📋 No bot admins set! Only server owner has full access.');
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
                .setFooter({ text: 'Server owner always has full access' })
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
            return interaction.reply('✅ Channel restriction removed! Bot can work in all channels.');
        }
    }

    if (commandName === 'help') {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🤖 Retreat Gateway Bot')
            .addFields(
                {
                    name: '🎮 Game Commands',
                    value: '`/addgame` - Add game\n`/removegame` - Remove your game\n`/listgames` - List all\n`/cleargames` - Clear all',
                    inline: false
                },
                {
                    name: '📊 Info',
                    value: '`/stats` - Statistics\n`/help` - This menu',
                    inline: false
                },
                {
                    name: '🔒 Admin',
                    value: '`/setadmin` - Manage bot admins\n`/setroles` - Manage permissions\n`/setchannel` - Set bot channel',
                    inline: false
                }
            )
            .setFooter({ text: 'Retreat Gateway' })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'stats') {
        const userStats = {};
        games.forEach(game => {
            userStats[game.addedBy] = (userStats[game.addedBy] || 0) + 1;
        });
        
        const topContributors = Object.entries(userStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map((entry, index) => `${index + 1}. **${entry[0]}** - ${entry[1]} game${entry[1] > 1 ? 's' : ''}`)
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
                    name: '👑 Top Contributors',
                    value: topContributors || 'No games yet',
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
                    content: `❌ Role ${role.name} already has permission!`,
                    ephemeral: true
                });
            }
            
            config.allowedRoles.push(role.id);
            saveConfig();
            
            return interaction.reply(`✅ Added ${role.name} to allowed roles!`);
        }
        
        else if (action === 'remove') {
            const role = interaction.options.getRole('role');
            
            const index = config.allowedRoles.indexOf(role.id);
            if (index === -1) {
                return interaction.reply({
                    content: `❌ Role ${role.name} doesn't have permission!`,
                    ephemeral: true
                });
            }
            
            config.allowedRoles.splice(index, 1);
            saveConfig();
            
            return interaction.reply(`✅ Removed ${role.name}!`);
        }
        
        else if (action === 'list') {
            if (config.allowEveryone) {
                return interaction.reply('📋 **Everyone** can manage games!');
            }
            
            if (config.allowedRoles.length === 0) {
                return interaction.reply('📋 No roles yet! Only server owner can manage.');
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
                .setFooter({ text: 'Server owner always has permission' })
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed] });
        }
        
        else if (action === 'everyone') {
            const enable = interaction.options.getBoolean('enable');
            config.allowEveryone = enable;
            saveConfig();
            
            return interaction.reply(enable ? '✅ Everyone can now manage games!' : '✅ Restricted to roles only!');
        }
    }

    if (commandName === 'addgame') {
        const gameIdInput = interaction.options.getString('gameid');
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
            ...gameInfo,
            addedBy: interaction.user.tag,
            addedAt: Date.now()
        });

        saveGames();

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Game Added')
            .addFields(
                { name: 'Name', value: gameInfo.name, inline: true },
                { name: 'ID', value: gameId, inline: true },
                { name: 'Creator', value: gameInfo.creator, inline: true },
                { name: 'Players', value: `${gameInfo.playing}/${gameInfo.maxPlayers}`, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
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
        
        if (game.addedBy !== interaction.user.tag && !isBotAdmin(interaction.member)) {
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
                { name: 'Name', value: game.name, inline: true },
                { name: 'ID', value: game.id, inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'listgames') {
        if (games.length === 0) {
            return interaction.reply('🔭 No games yet!');
        }

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🎮 Games in Hub')
            .setDescription(`Total: ${games.length}`)
            .setTimestamp();

        for (const [index, game] of games.entries()) {
            const uptime = Date.now() - game.addedAt;
            const uptimeText = formatUptime(uptime);
            const stats = await getGameStats(game.id);
            
            embed.addFields({
                name: `${index + 1}. ${game.name}`,
                value: `**ID:** ${game.id}\n**Added by:** ${game.addedBy}\n**⏱️ Uptime:** ${uptimeText}\n**👥 Players:** ${stats.playing}/${stats.maxPlayers}`,
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

app.get('/api/games', async (req, res) => {
    // Her oyun için güncel player count'u çek
    const gamesWithStats = await Promise.all(
        games.map(async (g) => {
            const stats = await getGameStats(g.id);
            return {
                id: g.id,
                name: g.name,
                creator: g.creator,
                uptime: Date.now() - g.addedAt,
                uptimeFormatted: formatUptime(Date.now() - g.addedAt),
                playing: stats.playing,
                maxPlayers: stats.maxPlayers
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

app.get('/', (req, res) => {
    res.json({ 
        message: 'Retreat Gateway Bot API',
        endpoints: ['/api/games', '/api/health']
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
