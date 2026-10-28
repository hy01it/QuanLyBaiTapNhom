# Database (Cloud Firestore)

Dự án sử dụng **Cloud Firestore** của Firebase;

Các collection được nhận diện từ mã nguồn:
- `users`: hồ sơ người dùng, thường dùng document ID là UID Firebase Auth.
- `groups`: thông tin nhóm; mã nguồn truy vấn trường `memberUids` (mảng UID).
- `members`: thành viên trong nhóm; mã nguồn dùng các trường `groupId`, `userId`, `name`, `email`, `createdBy`, `createdAt`.
- `tasks`: nhiệm vụ/bài tập nhóm 
