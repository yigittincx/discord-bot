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
        options: [{
            name: 'gameid',
            description: 'Game ID to be deleted',
            type: 3,
            required: true
        }]
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
        description: 'List Games'
    },
    {
        name: 'cleargames',
        description: 'Clear All Games'
    },
    {
        name: 'checkgames',
        description: '🔍 Check all games for 773 errors and remove them (Admin only)'
    },
    {
        name: 'test773',
        description: '🧪 Test a single game for 773 error (Admin only)',
        options: [{
            name: 'gameid',
            description: 'Game ID to test',
            type: 3,
            required: true
        }]
    },
    {
        name: 'setroles',
        description: 'Role management (Admin only)',
        options: [
            {
                name: 'action',
                description: 'Action',
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
                description: 'Role',
                type: 8,
                required: false
            },
            {
                name: 'enable',
                description: 'Enable/Disable',
                type: 5,
                required: false
            }
        ]
    },
    {
        name: 'setchannel',
        description: 'Set bot channel (Admin only)',
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
                description: 'Action',
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
                description: 'User',
                type: 6,
                required: false
            }
        ]
    },
    {
        name: 'help',
        description: 'Help menu'
    },
    {
        name: 'stats',
        description: 'Statistics'
    }
];

if (!TOKEN) {
    console.error('❌ DISCORD_TOKEN not found!');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('🔄 Registering commands with 773 detection...');
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );
        
        console.log('✅ Commands registered successfully!');
        console.log('✅ New command added: /test773');
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
})();
