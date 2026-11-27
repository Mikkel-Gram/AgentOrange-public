/* Manifest version: aoqZMFkB */
// Caution! Be sure you understand the caveats before publishing an application with
// offline support. See https://aka.ms/blazor-offline-considerations

self.importScripts('./service-worker-assets.js');
self.addEventListener('install', event => event.waitUntil(onInstall(event)));
self.addEventListener('activate', event => event.waitUntil(onActivate(event)));
self.addEventListener('fetch', event => event.respondWith(onFetch(event)));
self.addEventListener('message', event => onMessage(event));

const cacheNamePrefix = 'offline-cache-';
const cacheName = `${cacheNamePrefix}${self.assetsManifest.version}`;
const offlineAssetsInclude = [ /\.dll$/, /\.pdb$/, /\.wasm/, /\.html/, /\.js$/, /\.json$/, /\.css$/, /\.woff$/, /\.png$/, /\.jpe?g$/, /\.gif$/, /\.ico$/, /\.blat$/, /\.dat$/, /\.webmanifest$/ ];
const offlineAssetsExclude = [ /^service-worker\.js$/ ];

// Derived from the worker's own scope rather than hardcoded, so the same build works at the custom
// domain root, at a GitHub Pages project sub-path, and locally. A hardcoded value is silently wrong
// in the others, leaving manifestUrlList pointing at URLs that never match a real request.
const baseUrl = new URL('./', self.registration.scope);
const manifestUrlList = self.assetsManifest.assets.map(asset => new URL(asset.url, baseUrl).href);

async function onInstall(event) {
    console.info('Service worker: Install');

    // Fetch and cache all matching items from the assets manifest
    const assetsRequests = self.assetsManifest.assets
        .filter(asset => offlineAssetsInclude.some(pattern => pattern.test(asset.url)))
        .filter(asset => !offlineAssetsExclude.some(pattern => pattern.test(asset.url)))
        .map(asset => new Request(asset.url, { integrity: asset.hash, cache: 'no-cache' }));
    await caches.open(cacheName).then(cache => cache.addAll(assetsRequests));
}

async function onActivate(event) {
    console.info('Service worker: Activate');

    // Delete unused caches
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys
        .filter(key => key.startsWith(cacheNamePrefix) && key !== cacheName)
        .map(key => caches.delete(key)));

    // Take control of the page that is already open. Without this, skipWaiting() activates the
    // new worker but leaves the existing page controlled by the old one, so 'controllerchange'
    // never fires and the Update button appears to do nothing.
    await self.clients.claim();
}

async function onFetch(event) {
    let cachedResponse = null;
    if (event.request.method === 'GET') {
        // For all navigation requests, try to serve index.html from cache,
        // unless that request is for an offline resource.
        // If you need some URLs to be server-rendered, edit the following check to exclude those URLs
        const shouldServeIndexHtml = event.request.mode === 'navigate'
            && !manifestUrlList.some(url => url === event.request.url);

        const request = shouldServeIndexHtml ? 'index.html' : event.request;
        const cache = await caches.open(cacheName);
        cachedResponse = await cache.match(request);
    }

    return cachedResponse || fetch(event.request);
}

function onMessage(event) {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
}

self.addEventListener('push', event => {
    let title = 'AgentOrange';
    let body = 'A price has changed.';
    let url = './';

    try {
        if (event.data) {
            const payload = event.data.json();
            title = payload.title || title;
            body = payload.body || body;
            url = payload.url || url;
        }
    } catch {
        // Malformed payload; use defaults
    }

    event.waitUntil(
        self.registration.showNotification(title, {
            body: body,
            icon: './icon-192.png',
            badge: './icon-192.png',
            data: { url: url }
        })
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();

    const url = event.notification.data?.url || './';
    const targetUrl = new URL(url, baseUrl).href;

    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then(clients => {
            // Try to find an existing client with the same URL
            for (const client of clients) {
                if (client.url === targetUrl && 'focus' in client) {
                    return client.focus();
                }
            }
            // No matching client; open a new window
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
        })
    );
});
