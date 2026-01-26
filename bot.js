const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const express = require('express');
const fs = require('fs');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds] 
});

const app = express();
app.use(express.json());

const TOKEN = process.env.DISCORD_TOKEN;
const PORT = process.env.PORT || 3000;
let ALLOWED_CHANNEL_ID = '1465302757693980788';

let config = {
    gameManagerRoles: [],   
    botAdminRoles: [],      
    fullAdminRoles: [],     
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

function isServerOwner(member) {
    return member.guild.ownerId === member.id;
}

function hasGameManagerPermission(member) {
    if (isServerOwner(member)) return true;
    if (config.allowEveryone) return true;
    return member.roles.cache.some(role => 
        config.gameManagerRoles.includes(role.id) || 
        config.botAdminRoles.includes(role.id) || 
        config.fullAdminRoles.includes(role.id)
    );
}

function hasBotAdminPermission(member) {
    if (isServerOwner(member)) return true;
    if (config.allowEveryone) return true;
    return member.roles.cache.some(role => 
        config.botAdminRoles.includes(role.id) || 
        config.fullAdminRoles.includes(role.id)
    );
}

function hasFullAdminPermission(member) {
    if (isServerOwner(member)) return true;
    if (config.allowEveryone) return true;
    return member.roles.cache.some(role => config.fullAdminRoles.includes(role.id));
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
        const response = await fetch(`https://games.roproxy.com/v1/games?universeIds=${gameId}`);
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

    if (interaction.commandName !== 'listgames' && interaction.channelId !== ALLOWED_CHANNEL_ID) {
        return interaction.reply({
            content: `❌ This bot only works in <#${ALLOWED_CHANNEL_ID}>!`,
            ephemeral: true
        });
    }

    const { commandName } = interaction;
    
    if (['addgame', 'removegame'].includes(commandName) && !hasGameManagerPermission(interaction.member)) {
        return interaction.reply({
            content: '❌ You need **Game Manager** permission or higher!\n💡 Ask an admin to add your role using `/setroles`',
            ephemeral: true
        });
    }

    if (['cleargames', 'setchannel'].includes(commandName) && !hasBotAdminPermission(interaction.member)) {
        return interaction.reply({
            content: '❌ You need **Bot Admin** permission or higher!\n💡 Ask a full admin to add your role using `/setroles`',
            ephemeral: true
        });
    }

    if (commandName === 'setroles' && !hasFullAdminPermission(interaction.member)) {
        return interaction.reply({
            content: '❌ You need **Full Admin** permission!\n💡 Only full admins and server owner can manage roles.',
            ephemeral: true
        });
    }

    if (commandName === 'setchannel') {
        const channel = interaction.options.getChannel('channel');
        ALLOWED_CHANNEL_ID = channel.id;

        return interaction.reply(`✅ Bot channel changed to <#${channel.id}>! All commands will now work there.`);
    }

    if (commandName === 'help') {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🤖 Bot Commands Help')
            .setDescription('Here are all available commands:')
            .addFields(
                {
                    name: '🎮 Game Management (Game Manager+)',
                    value: '`/addgame` - Add a game to the hub\n`/removegame` - Remove a game\n`/listgames` - List all games',
                    inline: false
                },
                {
                    name: '🔧 Bot Management (Bot Admin+)',
                    value: '`/cleargames` - Clear all games\n`/setchannel` - Change bot command channel',
                    inline: false
                },
                {
                    name: '👑 Full Admin (Full Admin Only)',
                    value: '`/setroles` - Manage role permissions',
                    inline: false
                },
                {
                    name: '📊 Information (Everyone)',
                    value: '`/stats` - Show hub statistics\n`/help` - Show this help message',
                    inline: false
                },
                {
                    name: '📌 Note',
                    value: `Bot commands only work in <#${ALLOWED_CHANNEL_ID}>`,
                    inline: false
                }
            )
            .setFooter({ text: 'Roblox Teleport Hub Bot' })
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

        let totalDuration = 0;
        games.forEach(game => {
            totalDuration += (Date.now() - game.addedAt);
        });
        const avgDuration = games.length > 0 ? totalDuration / games.length : 0;
        const avgDays = Math.floor(avgDuration / (1000 * 60 * 60 * 24));
        const avgHours = Math.floor((avgDuration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        const oldestGame = games.length > 0 ? games.reduce((oldest, game) => 
            game.addedAt < oldest.addedAt ? game : oldest
        ) : null;
        const newestGame = games.length > 0 ? games.reduce((newest, game) => 
            game.addedAt > newest.addedAt ? game : newest
        ) : null;

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
                    name: '⏱️ Average Game Duration',
                    value: games.length > 0 ? `${avgDays}d ${avgHours}h` : 'N/A',
                    inline: true
                },
                {
                    name: '\u200b',
                    value: '\u200b',
                    inline: true
                },
                {
                    name: '👑 Top Contributors',
                    value: topContributors || 'No games yet',
                    inline: false
                }
            )
            .setTimestamp();

        if (oldestGame) {
            const oldestDuration = Date.now() - oldestGame.addedAt;
            const oldestDays = Math.floor(oldestDuration / (1000 * 60 * 60 * 24));
            const oldestHours = Math.floor((oldestDuration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            
            embed.addFields({
                name: '⏳ Longest Game in Hub',
                value: `**${oldestGame.name}**\nIn hub for: **${oldestDays}d ${oldestHours}h**`,
                inline: true
            });
        }

        if (newestGame) {
            const newestDuration = Date.now() - newestGame.addedAt;
            const newestHours = Math.floor(newestDuration / (1000 * 60 * 60));
            const newestMinutes = Math.floor((newestDuration % (1000 * 60 * 60)) / (1000 * 60));
            
            embed.addFields({
                name: '🆕 Newest Game in Hub',
                value: `**${newestGame.name}**\nAdded: **${newestHours}h ${newestMinutes}m ago**`,
                inline: true
            });
        }

        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'setroles') {
        const level = interaction.options.getString('level');
        const action = interaction.options.getString('action');
        
        let targetArray;
        let levelName;
        
        if (level === 'gamemanager') {
            targetArray = config.gameManagerRoles;
            levelName = 'Game Manager';
        } else if (level === 'botadmin') {
            targetArray = config.botAdminRoles;
            levelName = 'Bot Admin';
        } else if (level === 'fulladmin') {
            targetArray = config.fullAdminRoles;
            levelName = 'Full Admin';
        }
        
        if (action === 'add') {
            const role = interaction.options.getRole('role');
            
            if (targetArray.includes(role.id)) {
                return interaction.reply({
                    content: `❌ Role ${role.name} already has ${levelName} permission!`,
                    ephemeral: true
                });
            }
            
            targetArray.push(role.id);
            saveConfig();
            
            const permissions = {
                gamemanager: 'Add/Remove games',
                botadmin: 'Add/Remove games, Clear games, Change channel',
                fulladmin: 'All permissions including role management'
            };
            
            return interaction.reply(`✅ Added ${role.name} as **${levelName}**!\n📋 Permissions: ${permissions[level]}`);
        }
        
        else if (action === 'remove') {
            const role = interaction.options.getRole('role');
            
            const index = targetArray.indexOf(role.id);
            if (index === -1) {
                return interaction.reply({
                    content: `❌ Role ${role.name} doesn't have ${levelName} permission!`,
                    ephemeral: true
                });
            }
            
            targetArray.splice(index, 1);
            saveConfig();
            
            return interaction.reply(`✅ Removed ${role.name} from **${levelName}**!`);
        }
        
        else if (action === 'list') {
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('🔒 Role Permissions')
                .setTimestamp();

            const gameManagerList = config.gameManagerRoles
                .map(roleId => {
                    const role = interaction.guild.roles.cache.get(roleId);
                    return role ? `• ${role.name}` : `• Unknown Role (${roleId})`;
                })
                .join('\n') || 'None';
            
            const botAdminList = config.botAdminRoles
                .map(roleId => {
                    const role = interaction.guild.roles.cache.get(roleId);
                    return role ? `• ${role.name}` : `• Unknown Role (${roleId})`;
                })
                .join('\n') || 'None';
            
            const fullAdminList = config.fullAdminRoles
                .map(roleId => {
                    const role = interaction.guild.roles.cache.get(roleId);
                    return role ? `• ${role.name}` : `• Unknown Role (${roleId})`;
                })
                .join('\n') || 'None';

            embed.addFields(
                {
                    name: '🎮 Game Managers',
                    value: gameManagerList,
                    inline: false
                },
                {
                    name: '🔧 Bot Admins',
                    value: botAdminList,
                    inline: false
                },
                {
                    name: '👑 Full Admins',
                    value: fullAdminList,
                    inline: false
                }
            );

            if (config.allowEveryone) {
                embed.setDescription('⚠️ **Everyone mode is enabled!** All members have full permissions.');
            }

            embed.setFooter({ text: 'Server owner always has full permission' });
            
            return interaction.reply({ embeds: [embed] });
        }
        
        else if (action === 'everyone') {
            const enable = interaction.options.getBoolean('enable');
            config.allowEveryone = enable;
            saveConfig();
            
            if (enable) {
                return interaction.reply('✅ **Everyone mode enabled!** All members can now use all bot commands.');
            } else {
                return interaction.reply('✅ **Everyone mode disabled!** Bot is now restricted to assigned roles.');
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

        const removedGame = games[gameIndex];
        games.splice(gameIndex, 1);
        saveGames();

        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🗑️ Game Removed Successfully')
            .addFields(
                { name: 'Game Name', value: removedGame.name, inline: true },
                { name: 'Game ID', value: removedGame.id, inline: true }
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
            .setTitle('🎮 Games in Teleport Hub')
            .setDescription(`Total Games: ${games.length}`)
            .setTimestamp();

        games.forEach((game, index) => {
            const duration = Date.now() - game.addedAt;
            const days = Math.floor(duration / (1000 * 60 * 60 * 24));
            const hours = Math.floor((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            
            embed.addFields({
                name: `${index + 1}. ${game.name}`,
                value: `**ID:** ${game.id}\n**Creator:** ${game.creator}\n**Added By:** ${game.addedBy}\n**In Hub:** ${days}d ${hours}h`,
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
    res.json({ status: 'online', gameCount: games.length });
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
