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
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

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
