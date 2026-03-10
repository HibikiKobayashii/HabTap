// public/sw.js

self.addEventListener('push', function (event) {
  console.log('📡 [ServiceWorker] Push通知イベントを受信しました');

  if (event.data) {
    const data = event.data.json();
    
    // ★ 巡回人からの合言葉（type）に応じて、お出しするボタン（アクション）を変えます
    let actions = [];
    if (data.type === 'warning') {
      // 残り2日の場合は、Amazonへの誘いのみ
      actions = [{ action: 'amazon', title: '🛒 Amazonで注文する' }];
    } else if (data.type === 'empty') {
      // 残り0日の場合は、満タンにするボタンのみ
      actions = [{ action: 'restock', title: '📦 届いている（満タンにする）' }];
    }

    const options = {
      body: data.body,
      icon: data.icon || '/icon-192x192.png',
      badge: '/icon-192x192.png',
      data: {
        url: data.url,
        amazonUrl: data.amazonUrl,
        itemId: data.itemId
      },
      requireInteraction: true, // アクションを起こすまで静かに待ちます
      actions: actions
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function (event) {
  console.log('👆 [ServiceWorker] 通知がクリックされました:', event.action);
  const clickedNotification = event.notification;
  const action = event.action;
  const data = clickedNotification.data || {};

  // ボタンを押されたら、通知は美しく下げます
  clickedNotification.close();

  if (action === 'amazon') {
    // 🛒 Amazonで注文する
    if (data.amazonUrl) {
      event.waitUntil(clients.openWindow(data.amazonUrl));
    }
  } else if (action === 'restock') {
    // 📦 届いた（満タンにする）
    if (data.itemId) {
      event.waitUntil(
        fetch('/api/items/restock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: data.itemId })
        }).then(() => {
          console.log('📦 [ServiceWorker] 裏口からの在庫リセット成功。');
        }).catch(err => console.error('📦 [ServiceWorker] 在庫リセット失敗:', err))
      );
    }
  } else {
    // 通知本体が押された場合
    if (data.url) {
      event.waitUntil(clients.openWindow(data.url));
    }
  }
});