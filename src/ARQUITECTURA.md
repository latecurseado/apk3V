# 🏗️ Tres Valles - Guía de Arquitectura Modular

## ✅ SISTEMAS IMPLEMENTADOS

### 1. **Base de Datos Extendida (App.db)**
- `users` - Cuentas de usuarios con roles (citizen, verified, admin)
- `threads` - Posts con comentarios anidados, likes, attachments
- `session` - Usuario actualmente logueado
- `following` - Relaciones de seguimiento bidireccionales
- `bookmarks` - Posts guardados por usuario
- `blockedUsers` - Lista negra de usuarios bloqueados
- `notifications` - Centro de notificaciones en tiempo real
- `save()` - Persiste todo a localStorage automáticamente

### 2. **Sistema de Autenticación (App.auth)**
```javascript
// Métodos principales
App.auth.login()           // Login local
App.auth.register()        // Registro nuevo usuario
App.auth.initGoogle()      // Google Sign-In
App.auth.getUserRole(userId)
```

### 3. **Foro con Comentarios Anidados (App.forum)**
**Estructura de Thread:**
```javascript
{
    id: timestamp,
    author: "nombre",
    authorId: userId,
    content: "texto",
    category: "economia|deportes|educacion|etc",
    likes: [userId1, userId2],
    comments: [
        {
            id: timestamp,
            author: "nombre",
            content: "respuesta",
            likes: [...],
            replies: [...] // Comentarios recursivos
        }
    ]
}
```

**Métodos:**
```javascript
App.forum.createThread(content, category, attachments)
App.forum.addComment(threadId, content, parentCommentId)
App.forum.render(filter, category)
```

### 4. **Sistema Social (App.social)**
```javascript
App.social.toggleLike(threadId, isComment, commentId)
App.social.saveThread(threadId)           // Guardar en bookmarks
App.social.shareThread(threadId)          // Re-publicar con quote
App.social.toggleFollow(username)         // Seguir/dejar de seguir
App.social.blockUser(username)            // Bloquear usuario
```

**Animaciones de Like:**
- Pulso suave al hacer clic
- Cambio a rojo (#ff6b6b) cuando está likeado
- Emoji de corazón con animación

### 5. **Búsqueda Multidimensional (App.search)**
```javascript
App.search.execute(query, options)
// Busca en:
// - Nombres de usuario
// - Contenido de posts
// - Categorías
// - Retorna con highlighting en <span class="highlight">
```

### 6. **Notificaciones en Tiempo Real (App.notifications)**
```javascript
App.notifications.create(targetUserId, type, sourceUserName, threadId)
// types: 'like', 'comment', 'follow', 'new_thread', 'system'

App.notifications.getForUser(userId)
App.notifications.getUnreadCount(userId)
App.notifications.markAsRead(notiId)
```

Panel deslizable desde navbar con badge pulsante

### 7. **Configuración y Privacidad (App.settings)**
```javascript
App.settings.updateProfile(name, bio, pfpBase64)
App.settings.changeTheme(themeName)  // cyber-cian, dark, light, retro
App.settings.deleteAccount()
App.settings.getSavedThreads()
App.settings.getUserThreads()
App.settings.getUserLikes()
```

### 8. **Procesamiento de Multimedia (App.mediaOps)**
```javascript
App.mediaOps.compressImage(base64, maxWidth, quality)
App.mediaOps.validateFile(file)  // Max 2MB
App.mediaOps.generateDocumentCard(fileName, fileSize)
```

### 9. **Interfaz de Usuario (App.ui)**
```javascript
App.ui.updateHeader()              // Actualiza botón login/perfil
App.ui.openSettings()              // Modal de configuración
App.ui.showUserPopover(el, userId) // Tarjeta tipo Discord
App.ui.renderNotifications()
App.ui.toggleCommentBox(threadId)
```

### 10. **Editor de Contenido (App.editor)**
```javascript
App.editor.handleProfilePic(input)
App.editor.handleFile(input)
```

---

## 🎨 TEMAS DISPONIBLES

### Cyber-Cian (Predeterminado)
```css
--bg: #0a0a0c
--accent: #00d2ff
```

### Dark
```css
--bg: #1a1a1a
--accent: #f39c12
```

### Light
```css
--bg: #ffffff
--accent: #5e72e4
```

### Retro
```css
--bg: #0f0f1e
--accent: #ff006e
```

---

## 📱 COMPONENTES NUEVOS EN HTML

### Modal de Configuración
- **ID:** `#settings-modal`
- **Tabs:** Perfil | Tema | Actividad | Peligro
- Edición de bio y foto
- Selector visual de temas de 4 opciones

### Panel de Notificaciones
- **ID:** `#notifications-panel`
- Se desliza desde la derecha
- Badge pulsante en campana
- Lista de últimas 10 notificaciones

### Perfil Emergente (Popover)
- Se activa al clic en nombre de usuario
- Muestra: Banner | Avatar | Stats | Botones (Seguir/Bloquear)
- Se cierra al clic fuera

### Editor Mejorado
- Select de categorías de post
- Contenteditable para texto
- Selector de tema integrado

---

## 🔐 ROLES Y PERMISOS

```javascript
// Roles automáticos
"citizen"     // Usuario normal
"verified"    // Usuario verificado (nombre azul)
"admin"       // Administrador (nombre rojo)
```

---

## 💾 ALMACENAMIENTO LOCAL

Todos los datos se guardan en localStorage bajo las claves:
- `tv_accounts` - Usuarios
- `tv_threads` - Posts
- `tv_session` - Usuario logueado
- `tv_following` - Seguimientos
- `tv_bookmarks` - Guardados
- `tv_blocked` - Bloqueados
- `tv_notis` - Notificaciones
- `tv_theme` - Tema actual

---

## 🚀 CÓMO USAR

### Crear un Thread
```javascript
App.forum.createThread("Mi mensaje", "economia", [])
```

### Agregar Comentario
```javascript
App.forum.addComment(threadId, "Mi respuesta", null)
// null = comentario principal, commentId para responder a comentario
```

### Seguir Usuario
```javascript
App.social.toggleFollow("NombreUsuario")
```

### Cambiar Tema
```javascript
App.settings.changeTheme("retro")
```

### Buscar
```javascript
const results = App.search.execute("palabra clave")
// results.users, results.threads
```

---

## 🔗 INTEGRACIÓN FACEBOOK (fetch_news.php)

El archivo PHP incluye comentarios detallados para:
1. Integración con Graph API
2. Alternativa con RSS feeds
3. Sistema de caché de 30 minutos

**Próximos pasos:** Reemplazar datos simulados con tokens reales

---

## 🐛 DEBUGGING

Abre la consola (F12) y prueba:
```javascript
console.log(App.db.threads)        // Ver todos los posts
console.log(App.db.session)        // Ver usuario actual
App.forum.render()                 // Recargar foro
App.ui.renderNotifications()       // Ver notificaciones
```

---

## 📊 ESTRUCTURA BASE DE DATOS

```
App.db
├── users[]
│   ├── id, name, email, pass
│   ├── pfp, bio, role, badges
│   ├── followers, following, joinDate
│
├── threads[]
│   ├── id, author, authorId
│   ├── content, category
│   ├── likes[], comments[], attachments[]
│
├── notifications[]
│   ├── id, targetUserId, type
│   ├── sourceUserName, threadId, read
│
├── following{}  // {userId: [followedIds...]}
├── bookmarks{}  // {userId: [threadIds...]}
└── blockedUsers{}  // {userId: [blockedIds...]}
```

---

**VERSIÓN:** 1.0 | **FECHA:** 2026-04-26  
**PRÓXIMA MEJORA:** Integración real con Facebook Graph API
