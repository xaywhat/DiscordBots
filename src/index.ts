import { Client as DiscordClient, GatewayIntentBits, TextChannel, ChannelType, Role } from 'discord.js';
import fetch from 'node-fetch';
import tmi from 'tmi.js';
import 'dotenv/config';

const discordClient = new DiscordClient({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
});

discordClient.once('ready', () => {
    console.log('Ready!');
    // Check stream status when the bot is ready
    checkStreamStatus();
    // Schedule to check stream status periodically, e.g., every 5 minutes
    setInterval(checkStreamStatus, 5 * 60 * 1000);
});

interface TwitchStream {
    viewer_count: number;
}

interface TwitchApiResponse {
    data: TwitchStream[];
}

interface TwitchUser {
    id: string;
}

interface TwitchUserResponse {
    data: TwitchUser[];
}

const checkStreamStatus = async () => {
    try {
        const twitchChannelName = process.env.TWITCH_CHANNEL_NAME as string;
        const clientId = process.env.TWITCH_CLIENT_ID as string;
        const accessToken = process.env.TWITCH_ACCESS_TOKEN as string;

        const response = await fetch(`https://api.twitch.tv/helix/streams?user_login=${twitchChannelName}`, {
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        const data = (await response.json()) as TwitchApiResponse;
        const stream = data.data[0];

        let statusMessage = '';

        if (stream) {
            statusMessage = `🔴 LIVE | ${stream.viewer_count} viewers`;
        } else {
            statusMessage = `⚪ OFFLINE`;
        }

        // Find the designated channel and update its name
        const channel = discordClient.channels.cache.find(
            (channel) =>
                channel.type === ChannelType.GuildText &&
                (channel as TextChannel).name?.startsWith('status')
        ) as TextChannel;

        if (!channel) {
            console.error('Status channel not found');
            return;
        }

        await channel.setName(statusMessage);
    } catch (error) {
        console.error('Failed to fetch stream status:', error);
    }
};

const messageCounts: { [key: string]: number } = {};

const tmiClient = new tmi.Client({
    options: { debug: true },
    connection: {
        reconnect: true,
        secure: true
    },
    identity: {
        username: process.env.TWITCH_BOT_USERNAME as string,
        password: process.env.TWITCH_OAUTH_TOKEN as string
    },
    channels: [process.env.TWITCH_CHANNEL_NAME as string]
});

tmiClient.connect();

tmiClient.on('message', (channel: string, tags: tmi.ChatUserstate, message: string, self: boolean) => {
    if (self) return; // Ignore messages from the bot

    const username = tags['display-name'] || tags['username'];

    if (username) {
        if (!messageCounts[username.toLowerCase()]) {
            messageCounts[username.toLowerCase()] = 0;
        }
        messageCounts[username.toLowerCase()]++;
    }
});

const getUserChatActivity = async (username: string): Promise<number> => {
    return messageCounts[username.toLowerCase()] || 0;
};

const assignRoleBasedOnActivity = async (message: any) => {
    const username = message.content.split(' ')[1];
    if (!username) {
        message.channel.send('Please provide a Twitch username.');
        return;
    }

    try {
        const activity = await getUserChatActivity(username);
        const guild = message.guild;

        if (!guild) return;

        let role: Role | undefined;
        if (activity >= 1500) {
            role = guild.roles.cache.find((r: Role) => r.name === 'Veteran');
        } else if (activity >= 500) {
            role = guild.roles.cache.find((r: Role) => r.name === 'Kæmpe Fisk');
        } else if (activity >= 250) {
            role = guild.roles.cache.find((r: Role) => r.name === 'Stor Fisk');
        } else {
            role = guild.roles.cache.find((r: Role) => r.name === 'Lille Fisk');
        }

        if (role) {
            const member = guild.members.cache.get(message.author.id);
            if (member) {
                await member.roles.add(role);
                message.channel.send(`Assigned role ${role.name} to ${message.author.username}`);
            } else {
                message.channel.send(`Could not find member ${message.author.username}`);
            }
        } else {
            message.channel.send(`Appropriate role not found for activity level ${activity}`);
        }
    } catch (error) {
        console.error(error);
        message.channel.send('Failed to fetch user activity.');
    }
};

discordClient.on('messageCreate', (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('!watchtime')) {
        assignRoleBasedOnActivity(message);
    }
});

discordClient.login(process.env.DISCORD_BOT_TOKEN as string);
