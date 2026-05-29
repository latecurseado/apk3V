<?php
/* ============================================================
   TRES VALLES — Fetch de Noticias (Facebook Graph API)
   ------------------------------------------------------------
   Este endpoint devuelve un JSON que App.news.fetchRemote consume.
   Cada item DEBE incluir sourceUrl para que se publique.

   QUÉ NECESITAS PARA QUE ESTO TRAIGA NOTICIAS REALES:
   1) Crear App en https://developers.facebook.com/
   2) Obtener un Page Access Token de cada página (requiere ser admin
      de la página o que el admin te autorice).
   3) Pegar los IDs de página y el token en la config de abajo.
   4) Hospedar este archivo en un servidor con PHP + cURL habilitado.
   5) Configurar un cron diario (o cada N horas) que invoque la URL
      o que llame a refresh desde el frontend al entrar a Noticias.

   SIN TOKEN VÁLIDO el endpoint devuelve [] y el feed queda vacío.
   La opción manual (botón 📋 en navbar) sigue funcionando siempre.
   ============================================================ */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// ============ CONFIGURACIÓN ============
$ACCESS_TOKEN = getenv('FB_PAGE_TOKEN') ?: ''; // <- pega tu Page Token aquí o usa env var
$PAGES = [
    [
        'id'        => 'laretro3valles',                            // username o ID numérico
        'outletId'  => 'laretro',                                   // debe coincidir con App.db.outlets
        'page_url'  => 'https://www.facebook.com/laretro3valles/'
    ],
    [
        'id'        => '61551521516190',                            // ID numérico de la página
        'outletId'  => 'elcanero',
        'page_url'  => 'https://www.facebook.com/p/El-Ca%C3%B1ero-de-La-Cuenca-61551521516190/'
    ]
];
$LIMIT_PER_PAGE  = 5;
$CACHE_FILE      = __DIR__ . '/cache_noticias.json';
$CACHE_TTL_SECS  = 1800; // 30 min

// ============ CACHÉ ============
if (file_exists($CACHE_FILE) && (time() - filemtime($CACHE_FILE)) < $CACHE_TTL_SECS) {
    readfile($CACHE_FILE);
    exit;
}

// Sin token: respondemos vacío. El frontend mantendrá el feed sin tocar.
if (!$ACCESS_TOKEN) {
    echo json_encode([]);
    exit;
}

// ============ FETCH ============
$news = [];

foreach ($PAGES as $page) {
    $url = sprintf(
        'https://graph.facebook.com/v18.0/%s/posts?fields=message,created_time,permalink_url&limit=%d&access_token=%s',
        urlencode($page['id']),
        $LIMIT_PER_PAGE,
        urlencode($ACCESS_TOKEN)
    );

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_SSL_VERIFYPEER => true
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$response) continue;

    $data = json_decode($response, true);
    if (empty($data['data'])) continue;

    foreach ($data['data'] as $post) {
        if (empty($post['message']) || empty($post['permalink_url'])) continue;

        $news[] = [
            'content'   => mb_substr($post['message'], 0, 1200),
            'sourceUrl' => $post['permalink_url'],          // URL exacta del post original
            'outletId'  => $page['outletId'],
            'category'  => 'noticias',
            'timestamp' => $post['created_time'] ?? date('c')
        ];
    }
}

// Ordenar por fecha (más reciente primero)
usort($news, fn($a, $b) => strtotime($b['timestamp']) - strtotime($a['timestamp']));

$json = json_encode($news, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

// Guardar caché para no martillar la API
@file_put_contents($CACHE_FILE, $json);

echo $json;
