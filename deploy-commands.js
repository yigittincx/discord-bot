const { REST, Routes } = require('discord.js');
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = '1465302232001151170';
const GUILD_ID = '1465302756976758786';

const commands = [
    {
        name: 'addgame',
        description: 'Add Your Game',
        options: [
            {
                name: 'gameid',
                description: 'Game ID (example: 606849621)',
                type: 3,
                required: true
            },
            {
                name: 'genre',
                description: 'Select game genre',
                type: 3,
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
        description: 'Remove your game',
        options: [
            {
                name: 'gameid',
                description: 'Game ID to be deleted',
                type: 3,
                required: true
            }
        ]
    },
    {
        name: 'customizegame',
        description: 'Customize your game with custom name and description',
        options: [
            {
                name: 'gameid',
                description: 'Game ID to customize',
                type: 3,
                required: true
            },
            {
                name: 'name',
                description: 'Custom name for your game (max 50 chars)',
                type: 3,
                required: false,
                max_length: 50
            },
            {
                name: 'description',
                description: 'Custom description (max 200 chars)',
                type: 3,
                required: false,
                max_length: 200
            }
        ]
    },
    {
        name: 'listgames',
        description: 'List all games organized by genre'
    },
    {
        name: 'cleargames',
        description: 'Clear all games (Admin only)'
    },
    {
        name: 'checkgames',
        description: 'Check all games and remove deleted ones (Admin only)'
    },
    {
        name: 'setroles',
        description: 'Role management (Admin only)',
        options: [
            {
                name: 'action',
                description: 'Select action',
                type: 3,
                required: true,
                choices: [
                    { name: 'Add Role', value: 'add' },
                    { name: 'Remove Role', value: 'remove' },
                    { name: 'List Roles', value: 'list' },
                    { name: 'Toggle Everyone', value: 'everyone' }
                ]
            },
            {
                name: 'role',
                description: 'Select role',
                type: 8,
                required: false
            },
            {
                name: 'enable',
                description: 'Enable/Disable everyone access',
                type: 5,
                required: false
            }
        ]
    },
    {
        name: 'setchannel',
        description: 'Set bot channel restriction (Admin only)',
        options: [
            {
                name: 'channel',
                description: 'Select channel (leave empty to remove restriction)',
                type: 7,
                required: false
            }
        ]
    },
    {
        name: 'setadmin',
        description: 'Manage bot admins (Admin only)',
        options: [
            {
                name: 'action',
                description: 'Select action',
                type: 3,
                required: true,
                choices: [
                    { name: 'Add Admin', value: 'add' },
                    { name: 'Remove Admin', value: 'remove' },
                    { name: 'List Admins', value: 'list' }
                ]
            },
            {
                name: 'user',
                description: 'Select user',
                type: 6,
                required: false
            }
        ]
    },
    {
        name: 'help',
        description: 'Show help menu with all commands'
    },
    {
        name: 'stats',
        description: 'Show hub statistics and top contributors'
    }
];

if (!TOKEN) {
    console.error('❌ DISCORD_TOKEN not found in environment variables!');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('🔄 Registering slash commands...');
        console.log(`📊 Total commands: ${commands.length}`);
        
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );
        
        console.log('✅ All commands registered successfully!');
        console.log('🎮 Commands available:');
        commands.forEach((cmd, index) => {
            console.log(`   ${index + 1}. /${cmd.name} - ${cmd.description}`);
        });
        
    } catch (error) {
        console.error('❌ Error registering commands:', error);
        process.exit(1);
    }
})();
