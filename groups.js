
import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    arrayUnion,
    serverTimestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const createGroupForm = document.getElementById("createGroupForm");
const joinGroupForm = document.getElementById("joinGroupForm");
const myGroupsList = document.getElementById("myGroupsList");
const createGroupMessage = document.getElementById("createGroupMessage");
const joinGroupMessage = document.getElementById("joinGroupMessage");

let currentUser = null;
let unsubscribeGroups = null;

// Hiển thị thông báo thành công hoặc lỗi
function showMessage(element, message, isError = false) {
    element.textContent = message;
    element.style.color = isError ? "#b42318" : "#247a3d";
}

// Tạo mã nhóm gồm 8 ký tự
function makeJoinCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";

    for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }

    return code;
}

// Đảm bảo người dùng có hồ sơ thành viên trong nhóm
async function ensureMemberDocument(groupId, user) {
    const memberQuery = query(
        collection(db, "members"),
        where("groupId", "==", groupId),
        where("userId", "==", user.uid)
    );

    const existing = await getDocs(memberQuery);

    if (!existing.empty) {
        return;
    }

    const userDoc = await getDoc(doc(db, "users", user.uid));
    const profile = userDoc.exists() ? userDoc.data() : {};

    await addDoc(collection(db, "members"), {
        name: profile.name || user.displayName || user.email || "Thành viên",
        email: profile.email || user.email || "",
        userId: user.uid,
        groupId: groupId,
        createdBy: user.uid,
        createdAt: serverTimestamp()
    });
}

// Theo dõi các nhóm mà tài khoản hiện tại tham gia
function listenToMyGroups(user) {
    const myGroupsQuery = query(
        collection(db, "groups"),
        where("memberUids", "array-contains", user.uid)
    );

    if (unsubscribeGroups) {
        unsubscribeGroups();
    }

    unsubscribeGroups = onSnapshot(
        myGroupsQuery,
        function (snapshot) {
            const groups = snapshot.docs.map(function (item) {
                return {
                    id: item.id,
                    ...item.data()
                };
            });

            groups.sort(function (a, b) {
                return (a.name || "").localeCompare(b.name || "", "vi");
            });

            renderGroups(groups);
        },
        function (error) {
            console.error("Lỗi tải nhóm:", error);
            myGroupsList.textContent =
                "Không tải được nhóm. Hãy kiểm tra Firestore Rules.";
        }
    );
}

// Hiển thị các nhóm trên giao diện
function renderGroups(groups) {
    myGroupsList.replaceChildren();

    if (groups.length === 0) {
        myGroupsList.textContent =
            "Bạn chưa có nhóm nào. Hãy tạo nhóm mới hoặc nhập mã để tham gia.";
        return;
    }

    groups.forEach(function (group) {
        const card = document.createElement("article");
        card.className = "my-group-card";

        const title = document.createElement("h3");
        title.textContent = group.name || "Nhóm chưa có tên";
        card.appendChild(title);

        const code = document.createElement("p");
        code.textContent = "Mã nhóm: " + (group.joinCode || "Chưa có mã");
        card.appendChild(code);

        const count = document.createElement("p");
        const memberCount = Array.isArray(group.memberUids)
            ? group.memberUids.length
            : 0;

        count.textContent = "Số thành viên: " + memberCount;
        card.appendChild(count);

        const enterButton = document.createElement("button");
        enterButton.type = "button";
        enterButton.textContent = "Vào nhóm";

        enterButton.addEventListener("click", function () {
            window.location.href =
                "dashboard.html?groupId=" + encodeURIComponent(group.id);
        });

        card.appendChild(enterButton);

        // Chỉ người tạo nhóm mới được thấy nút Xóa nhóm
        if (group.createdBy === currentUser.uid) {
            const deleteButton = document.createElement("button");

            deleteButton.type = "button";
            deleteButton.textContent = "Xóa nhóm";
            deleteButton.style.backgroundColor = "#dc2626";
            deleteButton.style.color = "#ffffff";
            deleteButton.style.marginLeft = "8px";

            deleteButton.addEventListener("click", function () {
                deleteGroup(group.id, group.name);
            });

            card.appendChild(deleteButton);
        }

        myGroupsList.appendChild(card);
            });
        }
        
/* Xoa nhom va du lieu thanh vien, nhiem vu thuoc nhom */
async function deleteGroup(groupId, groupName) {
    if (!currentUser) {
        alert("Vui lòng đăng nhập lại!");
        return;
    }

    const confirmed = confirm(
        'Bạn có chắc muốn xóa nhóm "' + groupName +
        '" không?\nThành viên và bài tập của nhóm cũng sẽ bị xóa.'
    );

    if (!confirmed) return;

    try {
        // Kiem tra quyen xoa nhom tren Firestore
        const groupRef = doc(db, "groups", groupId);
        const groupSnapshot = await getDoc(groupRef);

        if (!groupSnapshot.exists()) {
            alert("Nhóm không còn tồn tại!");
            return;
        }

        if (groupSnapshot.data().createdBy !== currentUser.uid) {
            alert("Chỉ người tạo nhóm mới được xóa nhóm!");
            return;
        }

        // Lay danh sach thanh vien cua nhom
        const membersSnapshot = await getDocs(
            query(
                collection(db, "members"),
                where("groupId", "==", groupId)
            )
        );

        for (const member of membersSnapshot.docs) {
            await deleteDoc(member.ref);
        }

        // Lay danh sach bai tap cua nhom
        const tasksSnapshot = await getDocs(
            query(
                collection(db, "tasks"),
                where("groupId", "==", groupId)
            )
        );

        for (const task of tasksSnapshot.docs) {
            await deleteDoc(task.ref);
        }

        // Xoa tai lieu nhom sau cung
        await deleteDoc(groupRef);

        alert("Đã xóa nhóm thành công!");
    } catch (error) {
        console.error("Lỗi xóa nhóm:", error);
        alert("Không thể xóa nhóm. Hãy kiểm tra Firestore Rules.");
    }
}


// Xử lý tạo nhóm mới
createGroupForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!currentUser) {
        return;
    }

    const name = document.getElementById("newGroupName").value.trim();

    if (!name) {
        return;
    }

    try {
        // Tạo mã nhóm và kiểm tra xem mã đã tồn tại chưa
        let joinCode = makeJoinCode();

        for (let attempt = 0; attempt < 5; attempt++) {
            const check = await getDocs(
                query(
                    collection(db, "groups"),
                    where("joinCode", "==", joinCode)
                )
            );

            if (check.empty) {
                break;
            }

            joinCode = makeJoinCode();
        }

        // Lưu nhóm vào Firestore
        const groupRef = await addDoc(collection(db, "groups"), {
            name: name,
            joinCode: joinCode,
            createdBy: currentUser.uid,
            memberUids: [currentUser.uid],
            createdAt: serverTimestamp()
        });

        // Thêm người tạo vào danh sách thành viên
        await ensureMemberDocument(groupRef.id, currentUser);

        createGroupForm.reset();

        showMessage(
            createGroupMessage,
            "Tạo nhóm thành công! Mã nhóm của bạn là: " + joinCode
        );
    } catch (error) {
        console.error("Lỗi tạo nhóm:", error);

        showMessage(
            createGroupMessage,
            "Không tạo được nhóm. Kiểm tra kết nối và Firestore Rules.",
            true
        );
    }
});

// Xử lý tham gia nhóm bằng mã nhóm
joinGroupForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!currentUser) {
        return;
    }

    const code = document
        .getElementById("joinGroupCode")
        .value
        .trim()
        .toUpperCase();

    if (!code) {
        return;
    }

    try {
        // Tìm nhóm có mã tương ứng
        const matchingGroups = await getDocs(
            query(
                collection(db, "groups"),
                where("joinCode", "==", code)
            )
        );

        if (matchingGroups.empty) {
            showMessage(
                joinGroupMessage,
                "Không tìm thấy nhóm với mã này. Hãy kiểm tra lại mã nhóm.",
                true
            );
            return;
        }

        const groupDoc = matchingGroups.docs[0];
        const groupData = groupDoc.data();

        const memberUids = Array.isArray(groupData.memberUids)
            ? groupData.memberUids
            : [];

        // Không thêm trùng tài khoản vào cùng nhóm
        if (memberUids.includes(currentUser.uid)) {
            showMessage(
                joinGroupMessage,
                "Bạn đã là thành viên của nhóm này."
            );
            return;
        }

        // Cập nhật danh sách UID thành viên trong nhóm
        await updateDoc(doc(db, "groups", groupDoc.id), {
            memberUids: arrayUnion(currentUser.uid)
        });

        // Tạo hồ sơ thành viên của nhóm
        await ensureMemberDocument(groupDoc.id, currentUser);

        joinGroupForm.reset();

        showMessage(
            joinGroupMessage,
            'Bạn đã tham gia nhóm "' +
                (groupData.name || "Nhóm") +
                '" thành công!'
        );
    } catch (error) {
        console.error("Lỗi tham gia nhóm:", error);

        showMessage(
            joinGroupMessage,
            "Không thể tham gia nhóm. Kiểm tra kết nối và Firestore Rules.",
            true
        );
    }
});

// Xử lý đăng xuất
document.getElementById("groupsLogout").addEventListener(
    "click",
    async function () {
        try {
            if (unsubscribeGroups) {
                unsubscribeGroups();
            }

            await signOut(auth);
            window.location.href = "index.html";
        } catch (error) {
            console.error(error);
            alert("Không thể đăng xuất. Vui lòng thử lại.");
        }
    }
);

// Kiểm tra đăng nhập và tải danh sách nhóm
onAuthStateChanged(auth, function (user) {
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    currentUser = user;

    document.getElementById("groupsUserName").textContent =
        user.displayName || user.email || "Sinh viên";

    listenToMyGroups(user);
});
