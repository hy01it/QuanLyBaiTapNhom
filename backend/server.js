const express = require("express");
const cors = require("cors");
require("dotenv").config();
const cron = require("node-cron");

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const sendEmail = require("./emailService");

// Thêm middleware xác thực
const verifyToken = require("./middleware/authMiddleware");

// Kết nối Firebase Admin SDK
const serviceAccount = require("./serviceAccountKey.json");

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

const app = express();

// Cho phép frontend gửi yêu cầu đến backend
app.use(cors({
    origin: process.env.FRONTEND_URL
}));

// Đọc dữ liệu JSON
app.use(express.json());

// Kiểm tra backend có hoạt động không
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Backend Quản lý bài tập nhóm đang hoạt động!"
    });
});

// Kiểm tra kết nối Firebase
app.get("/api/firebase-test", async (req, res) => {
    try {
        await db.collection("users").limit(1).get();

        res.json({
            success: true,
            message: "Kết nối Firebase thành công!"
        });
    } catch (error) {
        console.error("Lỗi Firebase:", error.message);

        res.status(500).json({
            success: false,
            message: "Không thể kết nối Firebase."
        });
    }
});

// Kiểm tra xác thực người dùng
app.get("/api/protected-test", verifyToken, (req, res) => {
    res.json({
        success: true,
        message: "Xác thực người dùng thành công!",
        uid: req.user.uid
    });
});



// Gửi email khi Nhóm trưởng tạo nhiệm vụ
app.post("/api/task-created", verifyToken, async (req, res) => {
    try {
        const { taskId } = req.body;

        if (!taskId) {
            return res.status(400).json({
                success: false,
                message: "Thiếu mã nhiệm vụ!"
            });
        }

        // Lấy nhiệm vụ từ Firestore
        const taskRef = db.collection("tasks").doc(taskId);
        const taskSnapshot = await taskRef.get();

        if (!taskSnapshot.exists) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy nhiệm vụ!"
            });
        }

        const task = taskSnapshot.data();

        // Lấy thông tin nhóm
        const groupSnapshot = await db
            .collection("groups")
            .doc(task.groupId)
            .get();

        if (!groupSnapshot.exists) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy nhóm!"
            });
        }

        const group = groupSnapshot.data();
        const leaderUid = group.leaderUid || group.createdBy;

        // Chỉ Nhóm trưởng được gửi thông báo giao nhiệm vụ
        if (
            req.user.uid !== leaderUid ||
            task.createdBy !== req.user.uid
        ) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền thực hiện!"
            });
        }

        // Lấy danh sách người được giao
        const assigneeUids = [
            ...new Set(
                Array.isArray(task.assigneeUids)
                    ? task.assigneeUids
                    : task.assigneeUid
                        ? [task.assigneeUid]
                        : []
            )
        ];

        if (assigneeUids.length === 0) {
            return res.json({
                success: true,
                sent: 0,
                message: "Nhiệm vụ chưa được phân công."
            });
        }

        // Kiểm tra người nhận thuộc nhóm
        const memberUids = group.memberUids || [];

        if (!assigneeUids.every(uid => memberUids.includes(uid))) {
            return res.status(400).json({
                success: false,
                message: "Người được giao không thuộc nhóm!"
            });
        }

        let sent = 0;

        for (const uid of assigneeUids) {
            const userSnapshot = await db
                .collection("users")
                .doc(uid)
                .get();

            if (!userSnapshot.exists) continue;

            const user = userSnapshot.data();

            if (!user.email) continue;

            const result = await sendEmail(
                user.email,
                "Bạn vừa được giao nhiệm vụ mới",
                `Xin chào ${user.name || "bạn"}!

Bạn vừa được giao nhiệm vụ: ${task.name}

Hạn nộp: ${task.dueDate || "Chưa đặt hạn"}

Vui lòng đăng nhập vào hệ thống Quản lý bài tập nhóm để xem chi tiết.

Trân trọng!`
            );

            if (result) sent++;
        }

        res.json({
            success: sent === assigneeUids.length,
            sent: sent,
            message: `Đã gửi email cho ${sent}/${assigneeUids.length} thành viên.`
        });

    } catch (error) {
        console.error("Lỗi gửi email giao nhiệm vụ:", error);

        res.status(500).json({
            success: false,
            message: "Không thể gửi email thông báo."
        });
    }
});

// Gửi email thông báo cho những người được giao nhiệm vụ
async function notifyTaskAssignees(task, subject, action) {
    const assigneeUids = [
        ...new Set(
            Array.isArray(task.assigneeUids)
                ? task.assigneeUids
                : task.assigneeUid
                    ? [task.assigneeUid]
                    : []
        )
    ];

    let sent = 0;

    for (const uid of assigneeUids) {
        const userSnapshot = await db
            .collection("users")
            .doc(uid)
            .get();

        if (!userSnapshot.exists) continue;

        const user = userSnapshot.data();

        if (!user.email) continue;

        const result = await sendEmail(
            user.email,
            subject,
            `Xin chào ${user.name || "bạn"}!

Nhiệm vụ "${task.name}" trong nhóm của bạn vừa được ${action}.

Hạn nộp hiện tại: ${task.dueDate || "Chưa đặt hạn"}.

Vui lòng đăng nhập vào hệ thống Quản lý bài tập nhóm để xem chi tiết.

Trân trọng!`
        );

        if (result) sent++;
    }

    return sent;
}

// API thông báo khi sửa nhiệm vụ
app.post("/api/task-updated", verifyToken, async (req, res) => {
    try {
        const { taskId } = req.body;

        if (!taskId) {
            return res.status(400).json({
                success: false,
                message: "Thiếu mã nhiệm vụ!"
            });
        }

        const taskRef = db.collection("tasks").doc(taskId);
        const taskSnapshot = await taskRef.get();

        if (!taskSnapshot.exists) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy nhiệm vụ!"
            });
        }

        const task = taskSnapshot.data();

        const groupSnapshot = await db
            .collection("groups")
            .doc(task.groupId)
            .get();

        if (!groupSnapshot.exists) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy nhóm!"
            });
        }

        const group = groupSnapshot.data();

        if (req.user.uid !== (group.leaderUid || group.createdBy)) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền thực hiện!"
            });
        }

        const sent = await notifyTaskAssignees(
            task,
            "Nhiệm vụ đã được cập nhật",
            "chỉnh sửa"
        );

        res.json({
            success: true,
            sent: sent,
            message: `Đã gửi email cho ${sent} thành viên.`
        });

    } catch (error) {
        console.error("Lỗi thông báo sửa nhiệm vụ:", error);

        res.status(500).json({
            success: false,
            message: "Không thể gửi email thông báo."
        });
    }
});

// API thông báo khi xóa nhiệm vụ
app.post("/api/task-deleted", verifyToken, async (req, res) => {
    try {
        const { taskId } = req.body;

        if (!taskId) {
            return res.status(400).json({
                success: false,
                message: "Thiếu mã nhiệm vụ!"
            });
        }

        const taskRef = db.collection("tasks").doc(taskId);
        const taskSnapshot = await taskRef.get();

        if (!taskSnapshot.exists) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy nhiệm vụ!"
            });
        }

        const task = taskSnapshot.data();

        const groupSnapshot = await db
            .collection("groups")
            .doc(task.groupId)
            .get();

        if (!groupSnapshot.exists) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy nhóm!"
            });
        }

        const group = groupSnapshot.data();

        if (req.user.uid !== (group.leaderUid || group.createdBy)) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền thực hiện!"
            });
        }

        const sent = await notifyTaskAssignees(
            task,
            "Nhiệm vụ đã bị xóa",
            "xóa"
        );

        res.json({
            success: true,
            sent: sent,
            message: `Đã gửi email cho ${sent} thành viên.`
        });

    } catch (error) {
        console.error("Lỗi thông báo xóa nhiệm vụ:", error);

        res.status(500).json({
            success: false,
            message: "Không thể gửi email thông báo."
        });
    }
});

// Tự động gửi email nhắc hạn nộp trước 1 ngày
async function sendDeadlineReminders() {
    try {
        // Lấy ngày hiện tại theo giờ Việt Nam
        const today = new Date();

        const todayVN = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Ho_Chi_Minh",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).format(today);

        // Tính ngày mai
        const [year, month, day] = todayVN.split("-").map(Number);

        const tomorrow = new Date(
            Date.UTC(year, month - 1, day + 1)
        ).toISOString().slice(0, 10);

        console.log("Đang kiểm tra nhiệm vụ có hạn:", tomorrow);

        // Tìm nhiệm vụ có hạn nộp vào ngày mai
        const taskSnapshot = await db
            .collection("tasks")
            .where("dueDate", "==", tomorrow)
            .get();

        for (const taskDoc of taskSnapshot.docs) {
            const task = taskDoc.data();

            // Bỏ qua nhiệm vụ đã hoàn thành
            if (task.completed === true) continue;

            // Bỏ qua nhiệm vụ đã gửi email nhắc cho hạn này
            if (task.reminderSentForDueDate === task.dueDate) {
                continue;
            }

            // Lấy danh sách người được giao
            const assigneeUids = [
                ...new Set(
                    Array.isArray(task.assigneeUids)
                        ? task.assigneeUids
                        : task.assigneeUid
                            ? [task.assigneeUid]
                            : []
                )
            ];

            if (assigneeUids.length === 0) continue;

            let allSent = true;

            // Gửi email cho từng người
            for (const uid of assigneeUids) {
                const userSnapshot = await db
                    .collection("users")
                    .doc(uid)
                    .get();

                if (!userSnapshot.exists) {
                    allSent = false;
                    continue;
                }

                const user = userSnapshot.data();

                if (!user.email) {
                    allSent = false;
                    continue;
                }

                const result = await sendEmail(
                    user.email,
                    "Nhắc nhở: Nhiệm vụ sắp đến hạn nộp",
                    `Xin chào ${user.name || "bạn"}!

Nhiệm vụ "${task.name}" của bạn sẽ đến hạn vào ngày mai (${task.dueDate}).

Vui lòng hoàn thành nhiệm vụ đúng thời hạn.

Trân trọng!`
                );

                if (!result) {
                    allSent = false;
                }
            }

            // Chỉ đánh dấu đã gửi khi tất cả email gửi thành công
            if (allSent) {
                await taskDoc.ref.update({
                    reminderSentForDueDate: task.dueDate
                });

                console.log("Đã gửi email nhắc hạn:", task.name);
            }
        }

        console.log("Hoàn thành kiểm tra nhắc hạn!");

    } catch (error) {
        console.error("Lỗi gửi email nhắc hạn:", error);
    }
}

// API kiểm tra gửi email nhắc hạn thủ công
app.post("/api/test-deadline-reminders", verifyToken, async (req, res) => {
    // Chỉ cho phép kiểm tra khi đang chạy môi trường phát triển
    if (process.env.NODE_ENV === "production") {
        return res.status(403).json({
            success: false,
            message: "API kiểm tra chỉ dùng trong môi trường phát triển!"
        });
    }

    try {
        await sendDeadlineReminders();

        res.json({
            success: true,
            message: "Đã chạy kiểm tra nhắc hạn. Hãy xem Terminal để biết kết quả."
        });

    } catch (error) {
        console.error("Lỗi kiểm tra nhắc hạn:", error);

        res.status(500).json({
            success: false,
            message: "Kiểm tra nhắc hạn thất bại!"
        });
    }
});

// Tự động chạy lúc 8 giờ sáng mỗi ngày
cron.schedule(
    "0 8 * * *",
    () => {
        sendDeadlineReminders();
    },
    {
        timezone: "Asia/Ho_Chi_Minh"
    }
);

console.log("Đã thiết lập lịch gửi email nhắc hạn lúc 8:00 sáng.");

// Khởi động server
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend đang chạy tại cổng ${PORT}`);
});