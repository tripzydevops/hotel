self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('push', function (event) {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                primaryKey: '2'
            },
            actions: [
                {
                    action: 'explore', title: 'View Report',
                    icon: '/checkmark.png'
                },
                {
                    action: 'close', title: 'Close',
                    icon: '/xmark.png'
                },
            ]
        };
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

self.addEventListener('notificationclick', function (event) {
    console.log('Notification click received.');
    event.notification.close();

    // The base URL of the app
    const origin = self.location.origin;

    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then((windowClients) => {
            // Check if there is already a window/tab open with the target URL
            let matchingClient = null;
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                // Match if the client is on the same origin (covers /dashboard, /, etc.)
                if (new URL(client.url).origin === origin) {
                    matchingClient = client;
                    break;
                }
            }

            if (matchingClient) {
                return matchingClient.focus();
            } else {
                return clients.openWindow(origin + '/dashboard');
            }
        })
    );
});
