const { getAuth } = require("firebase-admin/auth");

async function verifyToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Bạn chưa đăng nhập!"
            });
        }

        const token = authHeader.split(" ")[1];

        const decodedToken = await getAuth().verifyIdToken(token);

        req.user = decodedToken;

        next();

    } catch (error) {
        console.error("Lỗi xác thực:", error.message);

        return res.status(401).json({
            success: false,
            message: "Phiên đăng nhập không hợp lệ!"
        });
    }
}

module.exports = verifyToken;