const nodemailer = require("nodemailer");

// Cấu hình Gmail
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

// Hàm gửi email
async function sendEmail(to, subject, message) {
    try {
        await transporter.sendMail({
            from: `"Quản lý bài tập nhóm" <${process.env.GMAIL_USER}>`,
            to: to,
            subject: subject,
            text: message
        });

        console.log("Gửi email thành công đến:", to);
        return true;

    } catch (error) {
        console.error("Lỗi gửi email:", error.message);
        return false;
    }
}

module.exports = sendEmail;
