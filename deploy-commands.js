const { REST, Routes } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = '1465302232001151170';
const GUILD_ID = '1465302756976758786';

const commands = [
    {
        name: 'addgame',
        description: 'Add a game to the hub',
        options: [{
            name: 'url',
            description: 'Roblox game URL or ID',
            type: 3,
            required: true
        }]
    },
    {
        name: 'removegame',
        description: 'Remove a game from the hub',
        options: [{
            name: 'id',
            description: 'Game ID to remove',
            type: 3,
            required: true
        }]
    },
    {
        name: 'listgames',
        description: 'List all games in the hub'
    }
];

if (!TOKEN) {
    console.error('❌ DISCORD_TOKEN environment variable not found!');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('🔄 Registering slash commands...');

        if (GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
                { body: commands }
            );
            console.log('✅ Commands registered for guild!');
        } else {
            await rest.put(
                Routes.applicationCommands(CLIENT_ID),
                { body: commands }
            );
            console.log('✅ Commands registered globally!');
        }
    } catch (error) {
        console.error('❌ Error registering commands:', error);
        process.exit(1);
    }
})();
