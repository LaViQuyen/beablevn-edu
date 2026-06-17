/* eslint-disable no-undef */
// ============================================================
// SERVICE WORKER nhận push FCM khi app/trình duyệt ĐÃ ĐÓNG
// Dùng bản compat qua CDN (service worker không bundle qua Vite)
// ============================================================
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDib-AzfVlINhKd-EiiFhZq1PQwPCMMrBw",
  authDomain: "bavn-learning.firebaseapp.com",
  databaseURL: "https://bavn-learning-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "bavn-learning",
  storageBucket: "bavn-learning.firebasestorage.app",
  messagingSenderId: "929043730121",
  appId: "1:929043730121:web:3f95e39b6bfe93d2f2c718",
});

const messaging = firebase.messaging();

// Push đến khi app đóng / tab không mở — Functions gửi DATA message, SW tự vẽ notification
messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  self.registration.showNotification(d.title || 'BE ABLE VN', {
    body: d.body || '',
    icon: '/BA LOGO.png',
    badge: '/BA LOGO.png',
    data: { url: d.url || '/' },
  });
});

// Bấm vào notification → mở/focus app đúng trang
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.navigate(url); return c.focus(); }
      }
      return clients.openWindow(url);
    })
  );
});
