const { REST, Routes } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = '1465302232001151170';
const GUILD_ID = '1465302756976758786';

const commands = [
    {
        name: 'addgame',
        description: 'Oyun ekle',
        options: [{
            name: 'gameid',
            description: 'Oyun ID (örn: 606849621)',
            type: 3,
            required: true
        }]
    },
    {
        name: 'removegame',
        description: 'Kendi oyununu sil',
        options: [{
            name: 'gameid',
            description: 'Silinecek oyun ID',
            type: 3,
            required: true
        }]
    },
    {
        name: 'listgames',
        description: 'Tüm oyunları listele'
    },
    {
        name: 'cleargames',
        description: 'Tüm oyunları sil'
    },
    {
        name: 'setroles',
        description: 'Rol yönetimi (Sadece admin)',
        options: [
            {
                name: 'action',
                description: 'İşlem',
                type: 3,
                required: true,
                choices: [
                    { name: 'Rol Ekle', value: 'add' },
                    { name: 'Rol Çıkar', value: 'remove' },
                    { name: 'Rolleri Listele', value: 'list' },
                    { name: 'Herkese Aç/Kapat', value: 'everyone' }
                ]
            },
            {
                name: 'role',
                description: 'Rol',
                type: 8,
                required: false
            },
            {
                name: 'enable',
                description: 'Aktif/Pasif',
                type: 5,
                required: false
            }
        ]
    },
    {
        name: 'help',
        description: 'Yardım menüsü'
    },
    {
        name: 'stats',
        description: 'İstatistikler'
    }
];

if (!TOKEN) {
    console.error('❌ DISCORD_TOKEN not found!');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('🔄 Registering commands...');

        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );
        
        console.log('✅ Commands registered!');
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
})();
