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

    const gameManagementCommands = ['addgame', 'cleargames'];
    if (gameManagementCommands.includes(commandName) && !hasPermission(interaction.member)) {
        return interaction.reply({
            content: '❌ You don\'t have permission!\n💡 Ask admin to add your role: `/setroles action:add role:@YourRole`',
            ephemeral: true
        });
    }
    
    if (commandName === 'setroles' && !interaction.member.permissions.has('Administrator')) {
        return interaction.reply({
            content: '❌ Only administrators can manage permissions!',
            ephemeral: true
        });
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
                    value: '`/setroles` - Manage permissions',
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
                creator: 'Unknown'
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
                { name: 'Creator', value: gameInfo.creator, inline: true }
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
        
        if (game.addedBy !== interaction.user.tag && interaction.guild.ownerId !== interaction.member.id) {
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

        games.forEach((game, index) => {
            embed.addFields({
                name: `${index + 1}. ${game.name}`,
                value: `**ID:** ${game.id}\n**Added by:** ${game.addedBy}`,
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

        await interaction.reply(`🗑️ Cleared ${count} game(s)!`);
    }
});

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
