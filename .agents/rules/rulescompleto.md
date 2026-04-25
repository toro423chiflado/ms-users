---
trigger: always_on
---

# 📘 Reglas de Implementación — MS1 (ms-users)

## 🧠 Contexto del Sistema

- MS1 (ms-users) es la **fuente de verdad de usuarios, roles y autenticación**
- Otros microservicios dependen de MS1 para:
  - Validar usuarios
  - Verificar JWT
  - Controlar acceso a recursos (Padlet)

---

## 🔐 1. Autenticación y Dominio

- Solo se permiten correos con dominio:
  ```
  @utec.edu.pe
  ```

- Aplicar validación en:
  - Registro local
  - Login con Google (Firebase)

- Regla:
  - Si el dominio no coincide → `403 Forbidden`

---

## 👤 2. Registro de Usuarios

### Registro Local

- Endpoint: `POST /auth/register`
- Reglas:
  - Validar dominio
  - Hashear contraseña (`bcrypt`)
  - Rol por defecto: `ESTUDIANTE`
  - Guardar en PostgreSQL

---

### Registro/Login con Google (Firebase)

- Endpoint: `POST /auth/google`
- Flujo:
  1. Recibir `idToken`
  2. Verificar con Firebase Admin SDK
  3. Extraer email
  4. Validar dominio

- Lógica:
  - Si no existe → crear usuario `ESTUDIANTE`
  - Si existe → login

---

## 🔑 3. JWT y Sesiones

- Generar:
  - `accessToken` (corto)
  - `refreshToken` (persistido en DB)

- Tabla: `refresh_tokens`

- Reglas:
  - Permitir revocación (`revocado = true`)
  - Validar expiración

---

## 🛡️ 4. Roles y Seguridad

Roles:

- `ADMIN`
- `PROFESOR`
- `ESTUDIANTE`

Reglas:

- `ESTUDIANTE` → automático
- `ADMIN` / `PROFESOR`:
  - ❌ No se registran
  - ✅ Solo vía endpoint protegido

---

## ⚙️ 5. Endpoint de Gestión de Roles

- Endpoint:
  ```
  PUT /admin/usuarios/:id/role
  ```

- Requiere:
  - JWT válido
  - Rol `ADMIN`

---

## 🧩 6. Middlewares

```ts
authMiddleware → valida JWT
roleMiddleware(['ADMIN']) → valida rol
```

---

## 🗄️ 7. Base de Datos (PostgreSQL — auth_db)

### 👤 usuarios

- PK: `id (UUID)`
- `correo` UNIQUE con dominio @utec
- `rol` ENUM
- `activo` para soft delete

---

### 🔑 refresh_tokens

- Manejo de sesiones
- Permite logout y control de múltiples dispositivos

---

### 🔐 acceso_padlet

- Relación lógica con MS2 (NO FK real)
- Campo clave:
  ```
  profesor_curso_id (INT)
  ```

---

## 🔗 8. Endpoints Internos y Externos

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/google`

---

### Usuarios

- `GET /usuarios/:id`
  - Devuelve perfil completo
  - Protegido con JWT

---

### Padlet

- `GET /padlet/:profesor_curso_id`
  - Verifica si estudiante tiene acceso

- `POST /padlet/solicitar`
  - Crea registro en `acceso_padlet`
  - Estado inicial: `PENDIENTE`

- `PUT /padlet/:id/responder`
  - Solo `PROFESOR` o `ADMIN`
  - Cambia estado:
    - `PERMITIDO`
    - `DENEGADO`

---

## 🔄 9. Comunicación entre Microservicios

### MS1 (este servicio)

Responsable de:
- Validar JWT
- Validar existencia de usuario
- Validar roles

---

### MS2 → MS1

- Verifica:
  - Usuario existe
  - Profesor válido

---

### MS3 → MS1

- Verifica:
  - JWT del uploader

---

### MS4 → MS1

- Verifica:
  - Usuario existe
  - Token válido

---

## 📌 10. Regla Crítica de Arquitectura

⚠️ No usar Foreign Keys entre microservicios

- Ejemplo:
  ```
  acceso_padlet.profesor_curso_id
  ```
  → Referencia lógica a MS2 (MySQL)

- Validación:
  - Se hace vía API call, no DB

---

## 🔁 11. Flujo Real de Negocio (Ejemplo MS4)

1. MS4 recibe POST (review)
2. Llama a MS1:
   - validar JWT
   - validar usuario
3. Llama a MS2:
   - validar `profesor_curso_id`
4. Guarda review
5. Llama a OpenAI (moderación)
6. Resultado:
   - Contenido inválido → `AUTO_ELIMINADO`
   - Contenido válido → `PENDIENTE`

---

## 🌐 12. Configuración General

```env
NODE_PORT=3001
DATABASE_URL=postgresql://...
JWT_SECRET=supersecret
UTEC_DOMAIN=@utec.edu.pe
```

---

## 🚧 13. API Gateway (Preparado)

- Prefijo:
  ```
  /api/v1/
  ```

- Stateless (JWT)
- CORS habilitado

---

## 📄 14. Documentación

- Swagger: `/api/v1/docs`
- Postman collection incluida
- README obligatorio con:
  - Setup
  - Firebase config
  - Variables env

---

## ✅ 15. Buenas Prácticas

- Validación con `zod`
- Logs (`winston`)
- Manejo global de errores
- Arquitectura por capas:
  ```
  controller → service → repository
  ```

---

## 🚨 16. Reglas Críticas (NO NEGOCIABLES)

- ❌ No permitir correos fuera de `@utec.edu.pe`
- ❌ No crear ADMIN/PROFESOR sin endpoint protegido
- ❌ No confiar en datos de otros microservicios sin validación
- ❌ No usar FK entre servicios

- ✅ Siempre validar JWT en MS1
- ✅ MS1 es la fuente de verdad de usuarios