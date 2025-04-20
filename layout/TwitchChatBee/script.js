document.addEventListener('DOMContentLoaded', async () => {
    const settings = await fetch('settings.json').then(response => response.json());
    const channel = settings.channel;
    const announcerUsers = settings.announcerUsers;
    const blackListedUsers = settings.blackListedUsers;


    // Modify this function to customize the animation for user messages
    function animateUserMessage(element) {
        gsap.fromTo(element,
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
        );
    }

    // Modify this function to customize the animation for announcer messages
    function animateAnnouncerMessage(element) {
        gsap.fromTo(element,
            { opacity: 0, y: -20 },
            { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
        );
    }


    const chatBox = document.getElementById('chat-box');

    const socket = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

    socket.onopen = () => {
        socket.send('CAP REQ :twitch.tv/tags twitch.tv/commands');

        // In order to connect annonymously, you need to use justinfan<NUMS> as the username
        socket.send('NICK justinfan231');
        socket.send(`JOIN #${channel}`);
    };

    socket.onmessage = (event) => {

        console.log("Message received: ", event.data);
        const message = event.data;

        if (message.includes('PRIVMSG')) {
            const lines = message.split('\r\n');
            for (let line of lines) {
                if (!line.includes('PRIVMSG')) continue;
                const userMatch = line.match(/display-name=([^;]*)/);
                const msgMatch = line.match(/PRIVMSG #[^ ]+ :(.+)/);
                if (!userMatch || !msgMatch) continue;
                const user = userMatch[1];
                const msg = msgMatch[1];
                if (!blackListedUsers.includes(user)) {
                    const messageElement = document.createElement('div');
                    messageElement.classList.add('chat-message');
                    if (announcerUsers.includes(user)) {
                        messageElement.classList.add('announcer');
                    }
                    messageElement.textContent = `${user}: ${msg}`;
                    chatBox.appendChild(messageElement);

                    // Select user defined animation
                    if (announcerUsers.includes(user)) {
                        animateAnnouncerMessage(messageElement);
                    } else {
                        animateUserMessage(messageElement);
                    }

                    chatBox.scrollTop = chatBox.scrollHeight;
                }
            }
        }
    };
});