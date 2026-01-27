const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
const fs = require('fs');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds] 
});

const app = express();
app.use(express.json());

// CORS için
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
    allowEveryone: false
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

function hasPermission(member) {
    if (member.guild.ownerId === member.id) return true;
    if (config.allowEveryone) return true;
    return member.roles.cache.some(role => config.allowedRoles.includes(role.id));
}

function extractGameId(url) {
    const patterns = [
        /roblox\.com\/games\/(\d+)/,
        /roblox\.com\/games\/(\d+)\/[\w-]+/,
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
            throw new Error('Could not get universe ID');
        }
        
        const universeId = universeData.universeId;
        
        const response = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            return {
                id: gameId,
                name: data.data[0].name,
                creator: data.data[0].creator.name
            };
        }
    } catch (error) {
        console.error('Error fetching game info:', error);
    }
    return null;
}

client.once('ready', () => {
    console.log(`✅ Bot is online as ${client.user.tag}`);
    loadGames();
    loadConfig();
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // Yetki kontrolü
    const gameManagementCommands = ['addgame', 'cleargames'];
    if (gameManagementCommands.includes(commandName) && !hasPermission(interaction.member)) {
        return interaction.reply({
            content: '❌ You don\'t have permission to use this command!\n💡 Ask an administrator to add your role using `/setroles`',
            ephemeral: true
        });
    }
    
    // removegame için özel kontrol (herkes kendi oyununu silebilir)
    // setroles sadece admin
    if (commandName === 'setroles' && !interaction.member.permissions.has('Administrator')) {
        return interaction.reply({
            content: '❌ Only administrators can manage permissions!',
            ephemeral: true
        });
    }

    if (commandName === 'help') {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🤖 Bot Commands Help')
            .setDescription('Here are all available commands:')
            .addFields(
                {
                    name: '🎮 Game Management',
                    value: '`/addgame` - Add a game to the hub\n`/removegame` - Remove a game\n`/listgames` - List all games\n`/cleargames` - Clear all games',
                    inline: false
                },
                {
                    name: '📊 Information',
                    value: '`/stats` - Show hub statistics\n`/help` - Show this help message',
                    inline: false
                },
                {
                    name: '🔒 Permission Management',
                    value: '`/setroles` - Manage which roles can use the bot',
                    inline: false
                }
            )
            .setFooter({ text: 'Retreat Gateway Bot' })
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
                    value: `${games.length} game${games.length !== 1 ? 's' : ''}`,
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
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({
                content: '❌ Only administrators can manage permissions!',
                ephemeral: true
            });
        }

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
            
            return interaction.reply(`✅ Removed ${role.name} from allowed roles!`);
        }
        
        else if (action === 'list') {
            if (config.allowEveryone) {
                return interaction.reply('📋 **Everyone** can manage games!');
            }
            
            if (config.allowedRoles.length === 0) {
                return interaction.reply('📋 No roles have permission yet! Only server owner can manage games.');
            }
            
            const rolesList = config.allowedRoles
                .map(roleId => {
                    const role = interaction.guild.roles.cache.get(roleId);
                    return role ? `• ${role.name}` : `• Unknown Role (${roleId})`;
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
            
            if (enable) {
                return interaction.reply('✅ Everyone can now manage games!');
            } else {
                return interaction.reply('✅ Restricted to allowed roles only!');
            }
        }
    }

    if (commandName === 'addgame') {
        const gameUrl = interaction.options.getString('url');
        const gameId = extractGameId(gameUrl);

        if (!gameId) {
            return interaction.reply({
                content: '❌ Invalid Roblox game URL or ID!',
                ephemeral: true
            });
        }

        if (games.find(g => g.id === gameId)) {
            return interaction.reply({
                content: '❌ This game is already in the hub!',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        const gameInfo = await getGameInfo(gameId);
        
        if (!gameInfo) {
            return interaction.editReply('❌ Could not fetch game information. Make sure the game ID is correct.');
        }

        games.push({
            ...gameInfo,
            addedBy: interaction.user.tag,
            addedAt: Date.now()
        });

        saveGames();

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Game Added Successfully')
            .addFields(
                { name: 'Game Name', value: gameInfo.name, inline: true },
                { name: 'Game ID', value: gameId, inline: true },
                { name: 'Creator', value: gameInfo.creator, inline: true },
                { name: 'Added By', value: interaction.user.tag, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }

    else if (commandName === 'removegame') {
        const gameId = interaction.options.getString('id');

        const gameIndex = games.findIndex(g => g.id === gameId);

        if (gameIndex === -1) {
            return interaction.reply({
                content: '❌ Game not found in the hub!',
                ephemeral: true
            });
        }

        const game = games[gameIndex];
        
        // Sadece kendi eklediği oyunu silebilir (sunucu sahibi hariç)
        if (game.addedBy !== interaction.user.tag && interaction.guild.ownerId !== interaction.member.id) {
            return interaction.reply({
                content: `❌ You can only remove games you added!\nThis game was added by **${game.addedBy}**`,
                ephemeral: true
            });
        }

        games.splice(gameIndex, 1);
        saveGames();

        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🗑️ Game Removed Successfully')
            .addFields(
                { name: 'Game Name', value: game.name, inline: true },
                { name: 'Game ID', value: game.id, inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'listgames') {
        if (games.length === 0) {
            return interaction.reply('🔭 No games in the hub yet!');
        }

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🎮 Games in Hub')
            .setDescription(`Total Games: ${games.length}`)
            .setTimestamp();

        games.forEach((game, index) => {
            embed.addFields({
                name: `${index + 1}. ${game.name}`,
                value: `**ID:** ${game.id}\n**Creator:** ${game.creator}\n**Added By:** ${game.addedBy}`,
                inline: false
            });
        });

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

        await interaction.reply(`🗑️ Successfully cleared ${count} game(s) from the hub!`);
    }
});

// API Endpoints
app.get('/api/games', (req, res) => {
    res.json({
        success: true,
        games: games.map(g => ({
            id: g.id,
            name: g.name,
            creator: g.creator
        }))
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
    console.error('❌ DISCORD_TOKEN environment variable not found!');
    process.exit(1);
}

app.listen(PORT, () => {
    console.log(`🌐 API server running on port ${PORT}`);
    
    client.login(TOKEN).catch(err => {
        console.error('❌ Failed to login:', err);
        process.exit(1);
    });
});
