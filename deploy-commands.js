const { REST, Routes } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = '1465302232001151170';
const GUILD_ID = '1465302756976758786';

const commands = [
    {
        name: 'addgame',
        description: 'Add a game to the teleport hub (Game Manager+)',
        options: [{
            name: 'url',
            description: 'Roblox game URL or ID',
            type: 3,
            required: true
        }]
    },
    {
        name: 'removegame',
        description: 'Remove a game from the teleport hub (Game Manager+)',
        options: [{
            name: 'id',
            description: 'Game ID to remove',
            type: 3,
            required: true
        }]
    },
    {
        name: 'listgames',
        description: 'List all games in the teleport hub (Everyone)'
    },
    {
        name: 'cleargames',
        description: 'Clear all games from the teleport hub (Bot Admin+)'
    },
    {
        name: 'setroles',
        description: 'Manage role permissions (Full Admin only)',
        options: [
            {
                name: 'level',
                description: 'Permission level',
                type: 3,
                required: true,
                choices: [
                    { name: '🎮 Game Manager (Add/Remove games)', value: 'gamemanager' },
                    { name: '🔧 Bot Admin (Games + Channel + Clear)', value: 'botadmin' },
                    { name: '👑 Full Admin (Everything)', value: 'fulladmin' }
                ]
            },
            {
                name: 'action',
                description: 'Action to perform',
                type: 3,
                required: true,
                choices: [
                    { name: 'Add Role', value: 'add' },
                    { name: 'Remove Role', value: 'remove' },
                    { name: 'List All Roles', value: 'list' },
                    { name: 'Toggle Everyone Mode', value: 'everyone' }
                ]
            },
            {
                name: 'role',
                description: 'The role to add/remove',
                type: 8,
                required: false
            },
            {
                name: 'enable',
                description: 'Enable/disable everyone mode',
                type: 5,
                required: false
            }
        ]
    },
    {
        name: 'help',
        description: 'Show all available commands (Everyone)'
    },
    {
        name: 'stats',
        description: 'Show hub statistics (Everyone)'
    },
    {
        name: 'setchannel',
        description: 'Set the channel where bot commands work (Bot Admin+)',
        options: [{
            name: 'channel',
            description: 'The channel to use',
            type: 7,
            required: true
        }]
    }
];

if (!TOKEN) {
    console.error('❌ DISCORD_TOKEN environment variable not found!');
    console.error('💡 Set DISCORD_TOKEN in your environment');
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
