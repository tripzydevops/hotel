const VERSION = 'v1.2.2'; // KAİZEN: Version bump to force update

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('push', function (event) {
    if (event.data) {
        let data = {};
        try {
            data = event.data.json();
        } catch (e) {
            data = { title: 'HotelPlus', body: event.data.text() };
        }
        
        const options = {
            body: data.body,
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                url: data.url || '/dashboard/market-intelligence' // KAİZEN: Dynamic URL support
            },
            actions: [
                {
                    action: 'explore', title: 'View Details',
                    icon: '/checkmark.png'
                },
                {
                    action: 'close', title: 'Close',
                    icon: '/xmark.png'
                },
            ]
        };
        event.waitUntil(
            self.registration.showNotification(data.title || 'Market Update', options)
        );
    }
});

self.addEventListener('notificationclick', function (event) {
    console.log(`[SW ${VERSION}] Notification click received. Action:`, event.action);
    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    const targetUrl = new URL(event.notification.data?.url || '/dashboard', self.location.origin).href;

    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then((windowClients) => {
            let matchingClient = null;
            
            // Normalize URLs to ignore trailing slashes
            const normalize = (url) => url.split('?')[0].replace(/\/$/, "");
            const normalizedTargetUrl = normalize(targetUrl);

            // Attempt 1: Try to find a tab that is perfectly matched OR on the same origin
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                const clientUrl = new URL(client.url);
                
                // If we found ANY tab on our origin, we will use it instead of opening a new one
                if (clientUrl.origin === self.location.origin) {
                    matchingClient = client;
                    
                    // If it's an exact match on path, break early and use this one
                    if (normalize(client.url) === normalizedTargetUrl) {
                        break;
                    }
                }
            }

            if (matchingClient) {
                // We found an open tab. Just focus it and navigate if needed.
                if (normalize(matchingClient.url) !== normalizedTargetUrl) {
                    return matchingClient.navigate(targetUrl).then(c => c ? c.focus() : null);
                }
                return matchingClient.focus();
            } else {
                // No open tabs for this origin, open a new one
                return clients.openWindow(targetUrl);
            }
        })
    );
});
