# Lumina Blog

Lumina là project blog cá nhân được xây dựng từ UI mockup Stitch theo phong cách editorial tối giản. Project dùng kiến trúc **modular monolith**: React và Go nằm trong cùng repository; production chỉ cần chạy một Go application để phục vụ cả API và frontend.

## Công nghệ

- Backend: Go 1.24, Fiber, MongoDB official Go driver.
- Frontend: React, TypeScript, Vite.
- Database: MongoDB container khi development hoặc MongoDB Atlas khi production.
- Authentication: access token và refresh token HttpOnly cookie.
- Image storage: `Storage` abstraction, hiện dùng local filesystem.
- Infrastructure: Docker và Docker Compose.

## Chức năng

- Đăng ký, đăng nhập, refresh session và đăng xuất.
- Phân quyền theo role và quyền sở hữu: khách chỉ đọc public; user viết/quản lý bài của mình; admin quản lý toàn bộ.
- Trang tài khoản cho phép cập nhật tên, số điện thoại tùy chọn và đổi mật khẩu có xác minh mật khẩu cũ.
- Bài viết, categories, tags, tìm kiếm và bình luận.
- Admin API quản lý nội dung và moderation bình luận.
- Trang quản trị danh sách, tạo, lưu draft, publish và cập nhật bài viết.
- Markdown editor có preview, toolbar, GitHub Flavored Markdown và upload ảnh nội dung.
- Tạo nhanh category/tag ngay trong sidebar: nhấn `+`, nhập tên và Enter.
- Upload thumbnail; không lưu binary trong MongoDB.
- Seed admin và dữ liệu mẫu cho development.
- Giao diện responsive dựa trên mockup Lumina Stitch.

## Cấu trúc project

```text
.
├── src/
│   ├── api/                         # Fiber routes, handlers, middleware
│   ├── client/                      # React + TypeScript frontend
│   ├── domain/                      # Models, repository interfaces, services
│   ├── infrastructure/
│   │   ├── config/
│   │   ├── database/mongodb/
│   │   ├── seed/
│   │   └── storage/
│   └── main.go
├── dist/                            # Vite production build
├── uploads/                         # Upload local
├── compose.yaml
├── Dockerfile
└── .env.example
```

## Chạy nhanh bằng Docker Compose

Yêu cầu máy đã cài Docker Engine và Docker Compose.

### 1. Tạo file môi trường

```bash
cp .env.example .env
```

Hãy thay `JWT_SECRET`, `SEED_ADMIN_EMAIL` và `SEED_ADMIN_PASSWORD` trước khi sử dụng.

### 2. Build và khởi động

```bash
docker compose up --build
```

Hoặc chạy dưới nền:

```bash
docker compose up -d --build
```

Mở `http://localhost:8080`.

MongoDB không được public ra host. Container Go kết nối qua hostname nội bộ `mongodb://mongodb:27017`.

### Lệnh Docker thường dùng

```bash
docker compose ps                 # Xem trạng thái
docker compose logs -f app        # Log backend
docker compose logs -f mongodb    # Log database
docker compose down               # Dừng, giữ dữ liệu
docker compose down -v            # Cảnh báo: dừng và xóa database/uploads
```

Nếu trình duyệt vẫn hiển thị bản cũ, nhấn `Ctrl + Shift + R`.

## Chạy source để phát triển

Cần cài Go 1.24+, Node.js 22+, npm và MongoDB.

### 1. Cài frontend dependencies

```bash
npm install
```

### 2. Chuẩn bị MongoDB

Nếu máy đã có MongoDB tại port 27017 thì bỏ qua bước này. Nếu muốn dùng MongoDB container:

```bash
docker compose up -d mongodb
```

MongoDB trong `compose.yaml` mặc định không publish port ra host. Để Go chạy trực tiếp trên máy kết nối được, thêm vào service `mongodb`:

```yaml
ports:
  - "27017:27017"
```

Sau đó chạy lại `docker compose up -d mongodb`.

### 3. Tạo và nạp environment variables

```bash
cp .env.example .env
```

Khi Go chạy trên máy, sửa:

```env
MONGO_URI=mongodb://localhost:27017
```

Go application tự đọc file `.env` ở thư mục hiện tại. Vì vậy có thể chạy trực tiếp:

```bash
go run ./src
```

Bạn vẫn có thể nạp biến thủ công bằng `set -a; source .env; set +a`, nhưng không bắt buộc. Khi file `.env` tồn tại, giá trị trong file sẽ thay thế biến cũ đang được export trong terminal để tránh dùng nhầm cấu hình Docker.

Backend chạy tại `http://localhost:8080`.

### 4. Chạy Vite ở terminal khác

```bash
npm run dev
```

Frontend development chạy tại `http://localhost:5173`. Vite proxy `/api` và `/uploads` tới Go tại port 8080.

## Biến môi trường

```env
APP_ENV=development
APP_PORT=8080
CLIENT_ORIGIN=http://localhost:5173

MONGO_URI=mongodb://localhost:27017
MONGO_USERNAME=
MONGO_PASSWORD=
MONGO_DATABASE=lumina

JWT_SECRET=thay-bang-secret-ngau-nhien-dai
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=168h

STORAGE_TYPE=local
STORAGE_PATH=uploads

SEED_ADMIN_EMAIL=admin@lumina.local
SEED_ADMIN_PASSWORD=mat-khau-development-du-manh
```

### `APP_ENV`

- `development`: chạy local.
- `production`: bật thuộc tính `Secure` cho refresh cookie, yêu cầu website dùng HTTPS.
- Giá trị này tự đặt theo môi trường, không cần lấy từ dịch vụ nào.

### `APP_PORT`

Port Go/Fiber lắng nghe, mặc định `8080`. Nếu đổi khi dùng Docker, phải đổi cả port mapping trong `compose.yaml`.

### `CLIENT_ORIGIN`

Origin được phép gọi API qua CORS:

- Vite local: `http://localhost:5173`.
- Production: URL public, ví dụ `https://blog.example.com`.
- Chỉ gồm protocol, hostname và port; không thêm path hay dấu `/` cuối.

### `MONGO_URI`

Connection string tới MongoDB:

```env
# Go chạy trực tiếp trên máy
MONGO_URI=mongodb://localhost:27017

# Go và MongoDB cùng Compose
MONGO_URI=mongodb://mongodb:27017
```

Để lấy URI MongoDB Atlas:

1. Tạo project và cluster trong MongoDB Atlas.
2. Vào **Database Access**, tạo database user và password.
3. Vào **Network Access**, allowlist IP của server deploy.
4. Chọn **Connect → Drivers → Go** trên cluster.
5. Sao chép URI và thay `<password>` bằng password database user.

```env
MONGO_URI=mongodb+srv://lumina_user:URL_ENCODED_PASSWORD@cluster.example.mongodb.net/?retryWrites=true&w=majority
```

Nếu password chứa `@`, `:`, `/`, `#` hoặc `%`, phải URL-encode password. Không commit Atlas URI vào Git.

Project cũng hỗ trợ cách an toàn hơn là tách credentials khỏi URI:

```env
MONGO_URI=mongodb+srv://ablog.r3wliuo.mongodb.net/?appName=ABlog
MONGO_USERNAME=database_user
MONGO_PASSWORD=database_password
```

Khi cả `MONGO_USERNAME` và `MONGO_PASSWORD` tồn tại, backend sẽ thay credentials trong `MONGO_URI` bằng hai giá trị này và tự URL-encode ký tự đặc biệt. Vì vậy không cần tự chèn username/password vào URI. Nếu thiếu một trong hai biến, URI được sử dụng nguyên trạng.

### `MONGO_DATABASE`

Tên database application sử dụng, ví dụ `lumina`. MongoDB sẽ tạo database/collections khi ghi dữ liệu lần đầu.

### `JWT_SECRET`

Secret ký access token. Tự tạo bằng OpenSSL:

```bash
openssl rand -base64 64
```

Hoặc:

```bash
openssl rand -hex 64
```

Không dùng secret trong file ví dụ cho production, không commit secret và không thay tùy tiện vì token đang tồn tại sẽ mất hiệu lực.

### `JWT_ACCESS_EXPIRES`

Thời gian sống access token. Hỗ trợ Go duration hoặc số giây:

```env
JWT_ACCESS_EXPIRES=15m
```

Khuyến nghị 10–30 phút. Access token chỉ nằm trong memory frontend, không lưu `localStorage`.

### `JWT_REFRESH_EXPIRES`

Thời gian sống refresh session và HttpOnly cookie:

```env
JWT_REFRESH_EXPIRES=168h
```

`168h` là 7 ngày; `720h` là 30 ngày. Refresh token được hash trong MongoDB và rotate sau mỗi lần refresh.

### `STORAGE_TYPE`

Hiện chỉ có implementation local, giữ:

```env
STORAGE_TYPE=local
```

Project đã có abstraction để bổ sung Cloudflare R2 nhưng phiên bản hiện tại chưa cần R2 credentials.

### `STORAGE_PATH`

Thư mục ghi file upload:

```env
STORAGE_PATH=uploads
```

Trong Docker, thư mục `/app/uploads` được gắn vào volume `uploads`, nên file không mất khi recreate container.

### `SEED_ADMIN_EMAIL` và `SEED_ADMIN_PASSWORD`

Hai biến tùy chọn dùng để tạo admin development và dữ liệu mẫu:

```env
SEED_ADMIN_EMAIL=admin@lumina.local
SEED_ADMIN_PASSWORD=mot-mat-khau-development-du-manh
```

- Email tự đặt, không cần là mailbox thật.
- Password nên dài tối thiểu 12 ký tự.
- Seed idempotent, không tạo trùng admin nếu email đã tồn tại.
- Bỏ trống một trong hai biến để không chạy seed.
- Production nên bỏ hai biến này sau khi đã tạo admin an toàn.

## Build production không dùng Docker

```bash
npm ci
npm run build
go build -o bin/lumina ./src
APP_ENV=production ./bin/lumina
```

Phải chạy binary với thư mục `dist` hiện diện trong working directory. Go phục vụ React tại `/*`, API tại `/api/*` và upload local tại `/uploads/*`.

## Kiểm tra project

```bash
npm run build                     # Type-check và build frontend
go test ./src/...                 # Unit tests backend
docker compose config             # Kiểm tra Compose
curl http://localhost:8080/api/posts
```

## API response

Các endpoint quản trị bài viết (yêu cầu access token của admin):

```text
GET    /api/admin/posts
GET    /api/admin/posts/:id
POST   /api/admin/posts
PUT    /api/admin/posts/:id
DELETE /api/admin/posts/:id
POST   /api/admin/uploads
```

Endpoint dành cho user đã đăng nhập; admin cũng có thể dùng và sẽ nhìn thấy toàn bộ bài:

```text
GET    /api/me/posts
GET    /api/me/posts/:id
POST   /api/me/posts
PUT    /api/me/posts/:id
DELETE /api/me/posts/:id
POST   /api/me/uploads
POST   /api/me/categories
PUT    /api/me/categories/:id
POST   /api/me/tags
PUT    /api/me/tags/:id
PUT    /api/me/profile
PUT    /api/me/password
```

User chỉ có thể lấy/sửa/xóa bài có `author_id` của chính mình. Admin được phép thao tác với mọi bài. API public `/api/posts` và `/api/posts/:slug` chỉ trả bài có status `published`.

Nội dung bài viết được lưu dưới dạng Markdown. Editor hỗ trợ heading, bold, italic, quote, bullet/numbered/task list, inline code, code block, divider, link, table theo GFM và ảnh. Ảnh tải trong editor được lưu qua `Storage` rồi chèn vào Markdown bằng `![alt](url)`.

UI tương ứng:

```text
/admin/posts
/admin/posts/create
/admin/posts/:id/edit
```

Thành công:

```json
{"data": {}, "message": "success"}
```

Lỗi:

```json
{"error": {"code": "INVALID_REQUEST", "message": "Invalid request"}}
```

## Lưu ý production

- Dùng HTTPS khi `APP_ENV=production`, nếu không Secure refresh cookie sẽ không hoạt động.
- Không commit `.env`, MongoDB URI, JWT secret hay password admin.
- Chỉ allowlist IP server thật trong MongoDB Atlas.
- Dùng database user riêng, không dùng password tài khoản Atlas.
- Local storage chỉ phù hợp một app instance; nhiều instance cần R2/S3-compatible storage.
- Sao lưu MongoDB và storage định kỳ.

## Troubleshooting

### Trang trắng hoặc vẫn thấy bản cũ

```bash
docker compose up -d --build
docker compose logs -f app
```

Sau đó nhấn `Ctrl + Shift + R`.

### Không kết nối được MongoDB

- Trong Docker dùng hostname `mongodb`, không dùng `localhost`.
- Go chạy trên host dùng `localhost` và port 27017 phải được publish/mở.
- Atlas: kiểm tra database user, URL-encoded password và Network Access allowlist.

### Sửa `.env` nhưng giá trị không đổi

- Docker: `docker compose up -d --build --force-recreate`.
- Go local: application tự đọc `.env`; chỉ cần restart `go run ./src`.
# ABlog
