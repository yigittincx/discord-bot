const { Client, GatewayIntentBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const fs = require('fs');

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
// 🧹 OTOMATIK TEMİZLEME SİSTEMİ
// ═══════════════════════════════════════════════════════════

async function checkGameExists(gameId) {
    try {
        const universeResponse = await fetch(`https://apis.roblox.com/universes/v1/places/${gameId}/universe`);
        const universeData = await universeResponse.json();
        
        if (!universeData.universeId) {
            return false;
        }
        
        const universeId = universeData.universeId;
        const response = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
        const data = await response.json();
        
        if (!data.data || data.data.length === 0) {
            return false;
        }
        
        return true;
    } catch (error) {
        console.error(`❌ Error checking game ${gameId}:`, error);
        return true;
    }
}

async function autoCleanupDeletedGames() {
    console.log('🧹 Starting auto-cleanup...');
    
    const deletedGames = [];
    
    for (const game of games) {
        const exists = await checkGameExists(game.id);
        
        if (!exists) {
            console.log(`🗑️ Game ${game.id} (${game.name}) is deleted from Roblox!`);
            deletedGames.push(game);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (deletedGames.length > 0) {
        games = games.filter(g => !deletedGames.find(d => d.id === g.id));
        saveGames();
        
        console.log(`✅ Auto-cleanup complete! Removed ${deletedGames.length} deleted game(s).`);
        
        for (const game of deletedGames) {
            try {
                const user = await client.users.fetch(game.addedByUserId);
                
                const embed = new EmbedBuilder()
                    .setColor(0xFF6B6B)
                    .setTitle('🗑️ Game Automatically Removed')
                    .setDescription('One of your games was removed because it no longer exists on Roblox.')
                    .addFields(
                        { name: '🎮 Game Name', value: game.customName || game.name, inline: true },
                        { name: '🆔 Game ID', value: game.id, inline: true },
                        { name: '📅 Added On', value: new Date(game.addedAt).toLocaleDateString(), inline: true }
                    )
                    .setFooter({ text: 'Retreat Gateway - Auto Cleanup System' })
                    .setTimestamp();
                
                await user.send({ embeds: [embed] });
                console.log(`📧 Notification sent to ${game.addedBy}`);
            } catch (error) {
                console.error(`❌ Could not notify ${game.addedBy}:`, error.message);
            }
        }
    } else {
        console.log('✅ Auto-cleanup complete! No deleted games found.');
    }
}

client.once('ready', () => {
    console.log(`✅ Bot is online as ${client.user.tag}`);
    loadGames();
    loadConfig();
    
    // İlk kontrol 10 saniye sonra
    setTimeout(() => {
        autoCleanupDeletedGames();
    }, 10000);
});

// Her 30 dakikada bir otomatik kontrol
setInterval(() => {
    autoCleanupDeletedGames();
}, 30 * 60 * 1000);

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
                    content: '❌ Failed to send link! The leader might have DMs disabled or the user was not found.',
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
                .setFooter({ text: 'Changes are now live in your Roblox hub!' })
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
                embed.setDescription('⚠️ No changes made. Both fields were empty.');
                embed.setColor(0xFFAA00);
            }
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    const channelRestrictedCommands = ['addgame', 'removegame', 'listgames', 'cleargames', 'help', 'stats', 'customizegame', 'checkgames'];
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
    
    const adminCommands = ['setroles', 'setchannel', 'setadmin', 'checkgames'];
    if (adminCommands.includes(commandName) && !isBotAdmin(interaction.member)) {
        return interaction.reply({
            content: '❌ Only bot admins can use this command!',
            ephemeral: true
        });
    }

    if (commandName === 'checkgames') {
        await interaction.deferReply();

        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('🔍 Checking All Games...')
            .setDescription('Please wait while I verify all games...')
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        const deletedGames = [];
        const validGames = [];

        for (const game of games) {
            const exists = await checkGameExists(game.id);

            if (!exists) {
                deletedGames.push(game);
            } else {
                validGames.push(game);
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (deletedGames.length > 0) {
            games = validGames;
            saveGames();

            const deletedList = deletedGames
                .map(g => `• **${g.customName || g.name}** (ID: ${g.id}) - Added by ${g.addedBy}`)
                .join('\n');

            const resultEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🗑️ Deleted Games Found & Removed')
                .setDescription(deletedList)
                .addFields(
                    { name: 'Total Checked', value: `${games.length + deletedGames.length}`, inline: true },
                    { name: 'Valid Games', value: `${validGames.length}`, inline: true },
                    { name: 'Deleted Games', value: `${deletedGames.length}`, inline: true }
                )
                .setFooter({ text: 'Games have been automatically removed from the hub' })
                .setTimestamp();

            await interaction.editReply({ embeds: [resultEmbed] });

            for (const game of deletedGames) {
                try {
                    const user = await client.users.fetch(game.addedByUserId);

                    const notifEmbed = new EmbedBuilder()
                        .setColor(0xFF6B6B)
                        .setTitle('🗑️ Your Game Was Removed')
                        .setDescription('One of your games was removed because it no longer exists on Roblox.')
                        .addFields(
                            { name: '🎮 Game Name', value: game.customName || game.name, inline: true },
                            { name: '🆔 Game ID', value: game.id, inline: true }
                        )
                        .setTimestamp();

                    await user.send({ embeds: [notifEmbed] });
                } catch (error) {
                    console.error(`Could not notify user:`, error.message);
                }
            }
        } else {
            const resultEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ All Games Valid')
                .setDescription('All games in the hub are still active on Roblox!')
                .addFields(
                    { name: 'Total Games Checked', value: `${games.length}`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [resultEmbed] });
        }
    }

    if (commandName === 'customizegame') {
        const gameId = interaction.options.getString('gameid');
        const customName = interaction.options.getString('name');
        const customDesc = interaction.options.getString('description');

        const game = games.find(g => g.id === gameId);

        if (!game) {
            return interaction.reply({
                content: '❌ Game not found in the hub!',
                ephemeral: true
            });
        }

        if (game.addedByUserId !== interaction.user.id) {
            return interaction.reply({
                content: `❌ You can only customize your own games!\nThis game was added by **${game.addedBy}**`,
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
                { name: '👤 Customized by', value: interaction.user.tag, inline: true },
                { name: '\u200B', value: '\u200B', inline: false },
                { name: '📝 Old Name', value: oldName, inline: true },
                { name: '📝 New Name', value: game.customName || oldName, inline: true },
                { name: '\u200B', value: '\u200B', inline: false },
                { name: '📄 Old Description', value: oldDesc, inline: false },
                { name: '📄 New Description', value: game.customDescription || oldDesc, inline: false }
            )
            .setFooter({ text: 'Changes will appear in Roblox hub' })
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
                    value: '`/addgame` - Add game (with genre)\n`/removegame` - Remove your game\n`/customizegame` - Customize your game\n`/listgames` - List all\n`/cleargames` - Clear all\n`/checkgames` - Check deleted games',
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
                },
                {
                    name: '🎯 Genres',
                    value: '⚔️ Official | 🗡️ SwordFight | 🔫 Crim | 👋 Slap | 🐐 Goat',
                    inline: false
                }
            )
            .setFooter({ text: 'Retreat Gateway' })
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

    // ═══════════════════════════════════════════════════════════
    // 🎮 ADDGAME - YENİ GENRE SİSTEMİ
    // ═══════════════════════════════════════════════════════════

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
            genre: genre, // 🎯 GENRE EKLENDİ
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

        // Genre'ye göre gruplandır
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
// 🌐 API ENDPOINTS - GENRE DESTEĞİYLE
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
                genre: g.genre, // 🎯 GENRE EKLENDİ
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

app.get('/', (req, res) => {
    res.json({ 
        message: 'Retreat Gateway Bot API',
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
