import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

import {
    collection,
    addDoc,
    setDoc,
    getDocs,
    query,
    where,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    arrayUnion,
    arrayRemove,
    serverTimestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

import { auth, db } from "./firebase.js";






/* =========================
   DANG KY / DANG NHAP
========================= */

/* Hien thi thong bao */
function showMessage(text, color = "red") {
    const message =
        document.getElementById("authMessage") ||
        document.getElementById("message");

    if (message) {
        message.textContent = text;
        message.style.color = color;
    }
}

/* Chuyen sang form dang ky */
const showRegister = document.getElementById("showRegister");

if (showRegister) {
    showRegister.addEventListener("click", function (event) {
        event.preventDefault();

        document.getElementById("loginSection").classList.add("hidden");
        document.getElementById("registerSection").classList.remove("hidden");

        showMessage("");
    });
}

/* Chuyen sang form dang nhap */
const showLogin = document.getElementById("showLogin");

if (showLogin) {
    showLogin.addEventListener("click", function (event) {
        event.preventDefault();

        document.getElementById("registerSection").classList.add("hidden");
        document.getElementById("loginSection").classList.remove("hidden");

        showMessage("");
    });
}

/* Xu ly dang ky tai khoan */
const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const name = document.getElementById("registerName").value.trim();
        const email = document.getElementById("registerEmail").value.trim().toLowerCase();
        const password = document.getElementById("registerPassword").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (name === "") {
            showMessage("Vui lòng nhập họ tên!");
            return;
        }

        if (password.length < 6) {
            showMessage("Mật khẩu phải có ít nhất 6 ký tự!");
            return;
        }

        if (password !== confirmPassword) {
            showMessage("Mật khẩu xác nhận không khớp!");
            return;
        }

        try {
            const result = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

            await updateProfile(result.user, {
                displayName: name
            });

            // Luu ho so nguoi dung vao Firestore
            await setDoc(doc(db, "users", result.user.uid), {
                uid: result.user.uid,
                name: name,
                email: result.user.email,
                createdAt: serverTimestamp()
            });

            // Dang xuat sau khi dang ky thanh cong
            await signOut(auth);

            registerForm.reset();

            document.getElementById("registerSection").classList.add("hidden");
            document.getElementById("loginSection").classList.remove("hidden");
            document.getElementById("loginEmail").value = email;

            showMessage("Đăng ký thành công! Hãy đăng nhập.", "green");
        } catch (error) {
            if (error.code === "auth/email-already-in-use") {
                showMessage("Email này đã được đăng ký!");
            } else if (error.code === "auth/invalid-email") {
                showMessage("Email không hợp lệ!");
            } else if (error.code === "auth/weak-password") {
                showMessage("Mật khẩu quá yếu!");
            } else {
                showMessage("Đăng ký thất bại: " + error.message);
                console.error(error);
            }
        }
    });
}

/* Xu ly dang nhap */
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("loginEmail").value.trim().toLowerCase();
        const password = document.getElementById("loginPassword").value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            window.location.href = "groups.html";
        } catch (error) {
            if (
                error.code === "auth/invalid-credential" ||
                error.code === "auth/wrong-password" ||
                error.code === "auth/user-not-found"
            ) {
                showMessage("Email hoặc mật khẩu không đúng!");
            } else if (error.code === "auth/invalid-email") {
                showMessage("Email không hợp lệ!");
            } else {
                showMessage("Đăng nhập thất bại: " + error.message);
                console.error(error);
            }
        }
    });
}

/* Dang xuat */
async function logout() {
    try {
        await signOut(auth);
        window.location.href = "index.html";
    } catch (error) {
        alert("Đăng xuất thất bại. Vui lòng thử lại.");
        console.error(error);
    }
}

window.logout = logout;


/* =========================
   DU LIEU DASHBOARD
========================= */

let membersCache = [];
let tasksCache = [];
let usersCache = [];
let groupsCache = [];

let selectedGroupId = "";
let stopMembersListener = null;
let stopTasksListener = null;
let dashboardStarted = false;


/* Lay thong tin nhom dang duoc chon */
function getSelectedGroup() {
    return groupsCache.find(function (group) {
        return group.id === selectedGroupId;
    });
}

/* Lay UID cua Nhom truong
   Nhom cu chua co leaderUid thi dung createdBy */
function getLeaderUid(group) {
    if (!group) return "";
    return group.leaderUid || group.createdBy || "";
}

/* Kiem tra tai khoan hien tai co phai Nhom truong */
function isCurrentUserLeader() {
    const group = getSelectedGroup();

    return Boolean(
        auth.currentUser &&
        group &&
        getLeaderUid(group) === auth.currentUser.uid
    );
}


/* Chi hien thi khu vuc chuyen quyen cho Nhom truong */




function updateLeaderManagementVisibility() {
    const isLeader = isCurrentUserLeader();

    // Chi Nhom truong duoc chuyen quyen
    const leaderManagement =
        document.getElementById("leaderManagement");

    if (leaderManagement) {
        leaderManagement.hidden = !isLeader;
    }

    // Chi Nhom truong duoc thay tab Tao nhiem vu
    const createTaskTab =
        document.getElementById("tabCreateTask");

    if (createTaskTab) {
        createTaskTab.hidden = !isLeader;
    }

    // Chi Nhom truong duoc thay form them thanh vien
    const memberForm =
        document.getElementById("memberForm");

    if (memberForm) {
        memberForm.hidden = !isLeader;
    }

    // Neu khong phai Nhom truong thi khong mo tab Tao nhiem vu
    const createTaskPanel =
        document.getElementById("panelCreateTask");

    if (!isLeader && createTaskPanel &&
        !createTaskPanel.hidden) {
        activateDashboardTab("panelOverview");
    }
}




// Chuyển giữa các tab A, B, C, D.

function activateDashboardTab(panelId) {
    const isLeader = isCurrentUserLeader();

    // Thành viên thường không được mở tab Tạo nhiệm vụ.
    if (panelId === "panelCreateTask" && !isLeader) {
        panelId = "panelOverview";
    }

    // Cập nhật trạng thái các nút điều hướng.
    document.querySelectorAll(".dashboard-tab").forEach((tab) => {
        const isActive = tab.dataset.tab === panelId;

        tab.classList.toggle("active", isActive);
        tab.setAttribute("aria-selected", String(isActive));
    });

    // Chỉ hiển thị nội dung của tab đang chọn.
    document.querySelectorAll(".dashboard-tab-panel").forEach((panel) => {
        panel.hidden = panel.id !== panelId;
    });
}


// Gắn sự kiện cho các nút tab.
document.querySelectorAll(".dashboard-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        activateDashboardTab(tab.dataset.tab);
    });
});

// Tab mặc định khi mở dashboard.
activateDashboardTab("panelOverview");



/* Lay danh sach UID dang nhan nhiem vu
   Ho tro ca nhiem vu cu va nhiem vu moi */
function getTaskAssigneeUids(task) {
    if (Array.isArray(task.assigneeUids)) {
        return task.assigneeUids;
    }

    if (task.assigneeUid) {
        return [task.assigneeUid];
    }

    if (task.memberId) {
        const member = membersCache.find(function (item) {
            return item.id === task.memberId;
        });

        if (member && member.userId) {
            return [member.userId];
        }
    }

    return [];
}

/* Lay tien do cua mot thanh vien tren mot nhiem vu */
function getMemberProgress(task, uid) {
    if (
        task.progressByUid &&
        typeof task.progressByUid[uid] === "number"
    ) {
        return task.progressByUid[uid];
    }

    // Tuong thich voi nhiem vu cu
    if (task.assigneeUid === uid && task.completed === true) {
        return 100;
    }

    return 0;
}


const isDashboard = window.location.pathname.endsWith("dashboard.html");

const groupForm = document.getElementById("groupForm");
const currentGroupSelect = document.getElementById("currentGroup");
const groupMessage = document.getElementById("groupMessage");

/* Hien thi thong bao trong khu vuc quan ly nhom */
function showGroupMessage(message, color = "#68778a") {
    if (groupMessage) {
        groupMessage.textContent = message;
        groupMessage.style.color = color;
    }
}

/* Cap nhat danh sach tai khoan co the them vao nhom */
function renderAccountOptions() {
    const memberAccount = document.getElementById("memberAccount");

    if (!memberAccount) return;

    const previousValue = memberAccount.value;

    memberAccount.innerHTML =
        '<option value="">-- Chọn tài khoản đã đăng ký --</option>';

    usersCache.forEach(function (user) {
        // Khong hien thi tai khoan dang dang nhap
        if (auth.currentUser && user.uid === auth.currentUser.uid) {
            return;
        }

        const option = document.createElement("option");

        option.value = user.uid;
        option.textContent =
            (user.name || "Chưa có tên") +
            " (" + (user.email || "") + ")";

        memberAccount.appendChild(option);
    });

    // Giu lai tai khoan dang duoc chon neu van ton tai
    if ([...memberAccount.options].some(function (option) {
        return option.value === previousValue;
    })) {
        memberAccount.value = previousValue;
    }
}

/* Tai danh sach tai khoan da dang ky */
function listenToUsers() {
    onSnapshot(
        collection(db, "users"),
        function (snapshot) {
            usersCache = snapshot.docs.map(function (item) {
                return {
                    uid: item.id,
                    ...item.data()
                };
            });

            renderAccountOptions();
        },
        function (error) {
            console.error("Lỗi tải tài khoản:", error);

            showGroupMessage(
                "Không tải được danh sách tài khoản. Hãy kiểm tra Firestore Rules.",
                "#b72d2d"
            );
        }
    );
}

/* Hien thi cac nhom ma tai khoan hien tai tham gia */

function renderGroups(groups) {
    myGroupsList.replaceChildren();

    if (groups.length === 0) {
        myGroupsList.textContent =
            "Bạn chưa có nhóm nào. Hãy tạo nhóm mới hoặc nhập mã để tham gia.";
        return;
    }

    groups.forEach(group => {
        const card = document.createElement("article");
        card.className = "my-group-card";

        // Ten nhom
        const title = document.createElement("h3");
        title.textContent = group.name || "Nhóm chưa có tên";
        card.appendChild(title);

        // Ma nhom
        const code = document.createElement("p");
        code.textContent = "Mã nhóm: " + (group.joinCode || "Chưa có mã");
        card.appendChild(code);

        // So thanh vien
        const count = document.createElement("p");
        const memberCount = Array.isArray(group.memberUids)
            ? group.memberUids.length
            : 0;

        count.textContent = "Số thành viên: " + memberCount;
        card.appendChild(count);

        // Nut vao nhom
        const enterButton = document.createElement("button");
        enterButton.type = "button";
        enterButton.textContent = "Vào nhóm";

        enterButton.addEventListener("click", function () {
            window.location.href =
                "dashboard.html?groupId=" + encodeURIComponent(group.id);
        });

        card.appendChild(enterButton);

        // Chi nguoi tao nhom moi thay nut Xoa nhom
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
    updateLeaderManagementVisibility();
}


/* Xoa nhom va du lieu thanh vien, nhiem vu thuoc nhom */
async function deleteGroup(groupId, groupName) {
    if (!currentUser) {
        alert("Vui lòng đăng nhập lại!");
        return;
    }

    try {
        // Kiem tra nhom tren Firebase
        const groupRef = doc(db, "groups", groupId);
        const groupSnapshot = await getDoc(groupRef);

        if (!groupSnapshot.exists()) {
            alert("Nhóm không còn tồn tại!");
            return;
        }

        const groupData = groupSnapshot.data();

        // Chi nguoi tao nhom duoc xoa
        if (groupData.createdBy !== currentUser.uid) {
            alert("Bạn không có quyền xóa nhóm này!");
            return;
        }

        // Xac nhan xoa
        const confirmed = confirm(
            'Bạn có chắc muốn xóa nhóm "' + groupName +
            '" không?\nThành viên và nhiệm vụ của nhóm cũng sẽ bị xóa.'
        );

        if (!confirmed) return;

        // Tim thanh vien thuoc nhom
        const membersQuery = query(
            collection(db, "members"),
            where("groupId", "==", groupId)
        );
        const membersSnapshot = await getDocs(membersQuery);

        for (const member of membersSnapshot.docs) {
            await deleteDoc(member.ref);
        }

        // Tim nhiem vu thuoc nhom
        const tasksQuery = query(
            collection(db, "tasks"),
            where("groupId", "==", groupId)
        );
        const tasksSnapshot = await getDocs(tasksQuery);

        for (const task of tasksSnapshot.docs) {
            await deleteDoc(task.ref);
        }

        // Xoa nhom sau cung
        await deleteDoc(groupRef);

        alert("Đã xóa nhóm thành công!");

    } catch (error) {
        console.error("Lỗi khi xóa nhóm:", error);
        alert("Không thể xóa nhóm. Hãy kiểm tra Firebase Firestore Rules.");
    }
}


/* Lang nghe cac nhom co UID nguoi dang dang nhap */
function listenToGroups(user) {
    const groupsQuery = query(
        collection(db, "groups"),
        where("memberUids", "array-contains", user.uid)
    );

    onSnapshot(
        groupsQuery,
        function (snapshot) {
            groupsCache = snapshot.docs.map(function (item) {
                return {
                    id: item.id,
                    ...item.data()
                };
            });

            groupsCache.sort(function (a, b) {
                return (a.name || "").localeCompare(b.name || "", "vi");
            });

            renderGroupOptions();

            if (groupsCache.length === 0) {
                showGroupMessage(
                    "Bạn chưa tham gia nhóm nào. Hãy tạo nhóm trước khi thêm thành viên."
                );
            }
        },
        function (error) {
            console.error("Lỗi tải nhóm:", error);

            showGroupMessage(
                "Không tải được nhóm. Hãy kiểm tra Firestore Rules.",
                "#b72d2d"
            );
        }
    );
}


/* Hien thi danh sach nhom trong o chon nhom */
function renderGroupOptions() {
    if (!currentGroupSelect) return;

    const previousGroupId = selectedGroupId;
    const urlGroupId =
        new URLSearchParams(window.location.search).get("groupId");

    currentGroupSelect.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "-- Chọn nhóm --";
    currentGroupSelect.appendChild(placeholder);

    groupsCache.forEach(function (group) {
        const option = document.createElement("option");
        option.value = group.id;
        option.textContent = group.name || "Nhóm chưa có tên";
        currentGroupSelect.appendChild(option);
    });

    // Uu tien nhom duoc mo tu trang danh sach nhom
    let nextGroupId = "";

    if (groupsCache.some(group => group.id === urlGroupId)) {
        nextGroupId = urlGroupId;
    } else if (
        groupsCache.some(group => group.id === previousGroupId)
    ) {
        nextGroupId = previousGroupId;
    } else if (groupsCache.length > 0) {
        nextGroupId = groupsCache[0].id;
    }

    currentGroupSelect.value = nextGroupId;

    const groupNameElement =
        document.getElementById("currentGroupName");

    const selectedGroup = groupsCache.find(
        group => group.id === nextGroupId
    );

    if (groupNameElement) {
        groupNameElement.textContent = selectedGroup
            ? "Nhóm hiện tại: " + selectedGroup.name
            : "Chưa chọn nhóm";
    }


    if (nextGroupId !== selectedGroupId) {
        selectedGroupId = nextGroupId;
        subscribeToSelectedGroup();
    }

    updateLeaderManagementVisibility();
}





/* Tao nhom moi */
if (groupForm) {
    groupForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const nameInput = document.getElementById("groupName");
        const groupName = nameInput.value.trim();

        if (!auth.currentUser) {
            alert("Vui lòng đăng nhập lại.");
            return;
        }

        if (!groupName) {
            alert("Vui lòng nhập tên nhóm.");
            return;
        }

        try {
            const newGroup = await addDoc(collection(db, "groups"), {
                name: groupName,
                createdBy: auth.currentUser.uid,
                leaderUid: auth.currentUser.uid,
                memberUids: [auth.currentUser.uid],
                createdAt: serverTimestamp()
            });

            selectedGroupId = newGroup.id;
            groupForm.reset();

            showGroupMessage(
                'Đã tạo nhóm "' + groupName +
                '" thành công. Đang tải nhóm...',
                "#247a3d"
            );
        } catch (error) {
            console.error("Lỗi tạo nhóm:", error);
            alert("Không tạo được nhóm. Hãy kiểm tra Firestore Rules.");
        }
    });
}


/* Khi chon nhom khac, tai du lieu cua nhom do */
if (currentGroupSelect) {
    currentGroupSelect.addEventListener("change", function () {
        selectedGroupId = currentGroupSelect.value;
        subscribeToSelectedGroup();
    });
}

/* Huy listener cu va tai thanh vien/nhiem vu cua nhom dang chon */
function subscribeToSelectedGroup() {
    updateLeaderManagementVisibility();

    if (stopMembersListener) {
        stopMembersListener();
        stopMembersListener = null;
    }

    if (stopTasksListener) {
        stopTasksListener();
        stopTasksListener = null;
    }

    membersCache = [];
    tasksCache = [];

    displayMembers();
    displayTasks();
    displayDeadlineNotifications();
    updateDashboardStatistics();

    const memberFormElement = document.getElementById("memberForm");
    const taskFormElement = document.getElementById("taskForm");

    if (memberFormElement) {
        memberFormElement.querySelector("button[type='submit']").disabled =
            !selectedGroupId;
    }

    if (taskFormElement) {
        taskFormElement.querySelector("button[type='submit']").disabled =
            !selectedGroupId;
    }

    if (!selectedGroupId) {
        showGroupMessage(
            "Hãy tạo nhóm hoặc chọn nhóm trước khi thêm thành viên và nhiệm vụ."
        );
        return;
    }

    showGroupMessage("Đang làm việc trong nhóm đã chọn.");

    // Chi tai thanh vien thuoc nhom dang chon
    const membersQuery = query(
        collection(db, "members"),
        where("groupId", "==", selectedGroupId)
    );

    stopMembersListener = onSnapshot(
        membersQuery,
        function (snapshot) {
            membersCache = snapshot.docs.map(function (item) {
                return {
                    id: item.id,
                    ...item.data()
                };
            });

            displayMembers();
        },
        function (error) {
            console.error("Lỗi đọc thành viên:", error);

            showGroupMessage(
                "Không đọc được thành viên. Hãy kiểm tra Firestore Rules.",
                "#b72d2d"
            );
        }
    );

    // Chi tai nhiem vu thuoc nhom dang chon
    const tasksQuery = query(
        collection(db, "tasks"),
        where("groupId", "==", selectedGroupId)
    );

    stopTasksListener = onSnapshot(
        tasksQuery,
        function (snapshot) {
            tasksCache = snapshot.docs.map(function (item) {
                return {
                    id: item.id,
                    ...item.data()
                };
            });

            displayTasks();
            displayDeadlineNotifications();
            updateDashboardStatistics();
        },
        function (error) {
            console.error("Lỗi đọc nhiệm vụ:", error);

            showGroupMessage(
                "Không đọc được nhiệm vụ. Hãy kiểm tra Firestore Rules.",
                "#b72d2d"
            );
        }
    );
}

/* Them tai khoan vao nhom dang chon */
const memberForm = document.getElementById("memberForm");

if (memberForm) {
    memberForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!selectedGroupId) {
            alert("Bạn cần tạo hoặc chọn nhóm trước!");
            return;
        }

        const userId = document.getElementById("memberAccount").value;

        const selectedUser = usersCache.find(function (user) {
            return user.uid === userId;
        });

        if (!selectedUser) {
            alert("Vui lòng chọn một tài khoản đã đăng ký!");
            return;
        }

        // Kiem tra tai khoan da co trong nhom nay chua
        const alreadyAdded = membersCache.some(function (member) {
            return member.userId === selectedUser.uid;
        });

        if (alreadyAdded) {
            alert("Tài khoản này đã có trong nhóm!");
            return;
        }

        try {
            const groupId = selectedGroupId;

            if (!groupId) {
                alert("Vui lòng chọn nhóm trước khi thêm thành viên!");
                return;
            }

            if (!groupId) {
                alert("Không tìm thấy nhóm đang mở!");
                return;
            }

            await addDoc(collection(db, "members"), {
                name: selectedUser.name,
                email: selectedUser.email,
                userId: selectedUser.uid,
                groupId: groupId,
                createdBy: auth.currentUser.uid,
                createdAt: serverTimestamp()
            });

            // Them UID vao danh sach thanh vien cua nhom
            await updateDoc(doc(db, "groups", selectedGroupId), {
                memberUids: arrayUnion(selectedUser.uid)
            });

            memberForm.reset();

            alert("Đã thêm thành viên vào nhóm thành công!");
        } catch (error) {
            console.error("Lỗi thêm thành viên:", error);

            alert("Không thêm được thành viên. Hãy kiểm tra Firestore Rules.");
        }
    });
}

/* Hien thi thanh vien va danh sach nguoi nhan nhiem vu */

/* Hiển thị thành viên và danh sách người nhận nhiệm vụ */
function displayMembers() {
    const memberList = document.getElementById("memberList");
    const taskMember = document.getElementById("taskMember");

    if (!memberList || !taskMember) return;

    memberList.innerHTML = "";
    taskMember.innerHTML =
        '<option value="">-- Chọn thành viên --</option>';

    if (!selectedGroupId) {
        memberList.textContent = "Hãy tạo hoặc chọn nhóm trước.";
        renderLeaderOptions();
        updateLeaderManagementVisibility();
        return;
    }

    if (membersCache.length === 0) {
        memberList.textContent =
            "Nhóm chưa có thành viên. Hãy thêm tài khoản đã đăng ký.";
    }

    membersCache.forEach(function (member) {
        const li = document.createElement("li");
        li.className = "member-item";

        // Cột trái: tên và Gmail
        const info = document.createElement("div");
        info.className = "member-info";

        const nameSpan = document.createElement("span");
        nameSpan.className = "member-name";
        nameSpan.textContent = member.name || "Chưa có tên";

        const emailSpan = document.createElement("span");
        emailSpan.className = "member-email";
        emailSpan.textContent = member.email || "Chưa có Gmail";

        info.appendChild(nameSpan);
        info.appendChild(emailSpan);
        li.appendChild(info);

        // Cột phải: nút Sửa và Xóa, chỉ dành cho Nhóm trưởng
        if (isCurrentUserLeader()) {
            const actions = document.createElement("div");
            actions.className = "member-actions";

            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.textContent = "Sửa";
            editButton.className = "member-edit-button";

            editButton.addEventListener("click", function () {
                editMember(member.id);
            });

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.textContent = "Xóa";
            deleteButton.className = "member-delete-button";

            deleteButton.addEventListener("click", function () {
                deleteMember(member.id);
            });

            actions.appendChild(editButton);
            actions.appendChild(deleteButton);
            li.appendChild(actions);
        }

        memberList.appendChild(li);

        // Thêm thành viên vào danh sách giao nhiệm vụ
        const option = document.createElement("option");
        option.value = member.id;
        option.textContent =
            member.name || member.email || "Thành viên";

        taskMember.appendChild(option);
    });

    renderLeaderOptions();
    updateLeaderManagementVisibility();
}


renderLeaderOptions();
updateLeaderManagementVisibility();


// Hiển thị danh sách thành viên để chọn Nhóm trưởng mới
function renderLeaderOptions() {
    const newLeaderSelect = document.getElementById("newLeaderSelect");

    if (!newLeaderSelect) return;

    // Xóa danh sách cũ
    newLeaderSelect.innerHTML =
        '<option value="">-- Chọn thành viên --</option>';

    // Chỉ cho Nhóm trưởng hiện tại quản lý danh sách
    if (!isCurrentUserLeader()) return;

    const currentLeaderUid = auth.currentUser.uid;
    const addedUids = new Set();

    membersCache.forEach(function (member) {
        const memberUid = member.userId;

        // Bỏ qua thành viên không có tài khoản
        if (!memberUid) return;

        // Không hiển thị chính Nhóm trưởng hiện tại
        if (memberUid === currentLeaderUid) return;

        // Tránh thêm một người nhiều lần
        if (addedUids.has(memberUid)) return;

        addedUids.add(memberUid);

        const option = document.createElement("option");
        option.value = memberUid;
        option.textContent = member.name || member.email || "Thành viên";

        newLeaderSelect.appendChild(option);
    });
}



/* Tao nhiem vu: chi Nhom truong duoc tao */
const taskForm = document.getElementById("taskForm");

if (taskForm) {
    taskForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!selectedGroupId) {
            alert("Bạn cần chọn nhóm trước!");
            return;
        }

        if (!isCurrentUserLeader()) {
            alert("Chỉ Nhóm trưởng mới được tạo nhiệm vụ!");
            return;
        }

        const taskName =
            document.getElementById("taskName").value.trim();

        const dueDate =
            document.getElementById("taskDueDate").value;

        const memberId =
            document.getElementById("taskMember").value;

        const maxPeople = Number(
            document.getElementById("taskMaxPeople").value
        );

        if (!taskName) {
            alert("Vui lòng nhập tên nhiệm vụ!");
            return;
        }

        if (
            !Number.isInteger(maxPeople) ||
            maxPeople < 1 ||
            maxPeople > 100
        ) {
            alert("Số người tối đa phải từ 1 đến 100!");
            return;
        }

        // Nguoi nhan co the de trong
        const selectedMember = memberId
            ? membersCache.find(function (member) {
                return member.id === memberId;
            })
            : null;

        if (memberId && !selectedMember) {
            alert("Không tìm thấy thành viên được chọn!");
            return;
        }

        const assigneeUids = selectedMember?.userId
            ? [selectedMember.userId]
            : [];

        const progressByUid = {};

        assigneeUids.forEach(function (uid) {
            progressByUid[uid] = 0;
        });

        try {
            const taskData = {
                name: taskName,
                groupId: selectedGroupId,
                dueDate: dueDate,
                maxAssignees: maxPeople,
                assigneeUids: assigneeUids,
                progressByUid: progressByUid,
                completed: false,
                createdBy: auth.currentUser.uid,
                createdAt: serverTimestamp()
            };

            // Giu cac truong cu neu da chi dinh nguoi nhan
            if (selectedMember) {
                taskData.memberId = selectedMember.id;
                taskData.memberName = selectedMember.name;
                taskData.assigneeUid = selectedMember.userId;
                taskData.assigneeEmail = selectedMember.email;
            } else {
                taskData.memberId = "";
                taskData.memberName = "";
                taskData.assigneeUid = "";
                taskData.assigneeEmail = "";
            }

            await addDoc(collection(db, "tasks"), taskData);

            taskForm.reset();

            // Dat lai so nguoi mac dinh sau khi reset
            document.getElementById("taskMaxPeople").value = "1";

            alert("Đã tạo nhiệm vụ thành công!");
        } catch (error) {
            console.error("Lỗi tạo nhiệm vụ:", error);
            alert("Không tạo được nhiệm vụ. Hãy kiểm tra Firebase Rules.");
        }
    });
}



/* Cap nhat tien do cua chinh minh */
async function updateMyTaskProgress(taskId, percent) {
    const task = tasksCache.find(function (item) {
        return item.id === taskId;
    });

    if (!task || !auth.currentUser) {
        alert("Không tìm thấy nhiệm vụ hoặc phiên đăng nhập.");
        return;
    }

    const uid = auth.currentUser.uid;
    const assigneeUids = getTaskAssigneeUids(task);

    // Chi nguoi duoc giao moi duoc cap nhat tien do cua minh
    if (!assigneeUids.includes(uid)) {
        alert("Bạn chưa được giao nhiệm vụ này!");
        return;
    }

    const progress = Number(percent);

    if (
        !Number.isInteger(progress) ||
        progress < 0 ||
        progress > 100
    ) {
        alert("Tiến độ phải là số nguyên từ 0 đến 100.");
        return;
    }

    const progressByUid = {
        ...(task.progressByUid || {}),
        [uid]: progress
    };

    // Khoi tao tien do cho nhung nguoi chua co gia tri
    assigneeUids.forEach(function (assigneeUid) {
        if (typeof progressByUid[assigneeUid] !== "number") {
            progressByUid[assigneeUid] =
                getMemberProgress(task, assigneeUid);
        }
    });

    // Hoan thanh khi tat ca nguoi duoc giao dat 100%
    const completed =
        assigneeUids.length > 0 &&
        assigneeUids.every(function (assigneeUid) {
            return progressByUid[assigneeUid] >= 100;
        });

    try {
        await updateDoc(doc(db, "tasks", taskId), {
            progressByUid: progressByUid,
            completed: completed
        });

        alert("Đã cập nhật tiến độ thành " + progress + "%.");
    } catch (error) {
        console.error("Lỗi cập nhật tiến độ:", error);
        alert("Không thể cập nhật tiến độ. Hãy kiểm tra Firebase Rules.");
    }
}


/* Thanh vien nhan nhiem vu neu van con cho */
async function claimTask(taskId) {
    const task = tasksCache.find(function (item) {
        return item.id === taskId;
    });

    const user = auth.currentUser;

    if (!task || !user) {
        alert("Không tìm thấy nhiệm vụ hoặc phiên đăng nhập.");
        return;
    }

    const assigneeUids = getTaskAssigneeUids(task);
    const maxAssignees = Number(task.maxAssignees || 1);

    if (assigneeUids.includes(user.uid)) {
        alert("Bạn đã nhận nhiệm vụ này rồi!");
        return;
    }

    if (assigneeUids.length >= maxAssignees) {
        alert("Nhiệm vụ đã đủ số người tối đa!");
        return;
    }

    const member = membersCache.find(function (item) {
        return item.userId === user.uid;
    });

    if (!member) {
        alert("Bạn cần là thành viên của nhóm mới nhận nhiệm vụ.");
        return;
    }

    try {
        const updatedAssignees = [...assigneeUids, user.uid];

        const progressByUid = {
            ...(task.progressByUid || {}),
            [user.uid]: 0
        };

        await updateDoc(doc(db, "tasks", taskId), {
            assigneeUids: updatedAssignees,
            progressByUid: progressByUid
        });

        alert("Bạn đã nhận nhiệm vụ thành công!");
    } catch (error) {
        console.error("Lỗi nhận nhiệm vụ:", error);
        alert("Không thể nhận nhiệm vụ. Hãy kiểm tra Firebase Rules.");
    }
}



/* Xoa nhiem vu */

/* Chi Nhom truong duoc xoa nhiem vu */
async function deleteTask(taskId) {
    if (!isCurrentUserLeader()) {
        alert("Chỉ Nhóm trưởng mới được xóa nhiệm vụ!");
        return;
    }

    const task = tasksCache.find(function (item) {
        return item.id === taskId;
    });

    if (!task) {
        alert("Không tìm thấy nhiệm vụ!");
        return;
    }

    const confirmed = confirm(
        'Bạn có chắc muốn xóa nhiệm vụ "' +
        (task.name || "Chưa có tên") + '" không?'
    );

    if (!confirmed) return;

    try {
        await deleteDoc(doc(db, "tasks", taskId));
        alert("Đã xóa nhiệm vụ!");
    } catch (error) {
        console.error("Lỗi xóa nhiệm vụ:", error);
        alert("Không thể xóa nhiệm vụ. Hãy kiểm tra Firebase Rules.");
    }
}


window.deleteTask = deleteTask;

/* Sua ten va han nop nhiem vu */

/* Chi Nhom truong duoc sua nhiem vu va han nop */
async function editTask(taskId) {
    if (!isCurrentUserLeader()) {
        alert("Chỉ Nhóm trưởng mới được sửa nhiệm vụ và hạn nộp!");
        return;
    }

    const task = tasksCache.find(function (item) {
        return item.id === taskId;
    });

    if (!task) {
        alert("Không tìm thấy nhiệm vụ!");
        return;
    }

    const newName = prompt("Nhập tên nhiệm vụ mới:", task.name || "");

    // Bam Cancel thi khong sua
    if (newName === null) return;

    if (!newName.trim()) {
        alert("Tên nhiệm vụ không được để trống!");
        return;
    }

    const newDueDate = prompt(
        "Nhập hạn nộp mới theo định dạng YYYY-MM-DD.\n" +
        "Để trống nếu không đặt hạn:",
        task.dueDate || ""
    );

    if (newDueDate === null) return;

    // Kiem tra dinh dang ngay
    if (
        newDueDate.trim() !== "" &&
        !/^\d{4}-\d{2}-\d{2}$/.test(newDueDate.trim())
    ) {
        alert("Ngày không hợp lệ. Hãy nhập theo dạng YYYY-MM-DD.");
        return;
    }

    try {
        await updateDoc(doc(db, "tasks", taskId), {
            name: newName.trim(),
            dueDate: newDueDate.trim()
        });

        alert("Đã cập nhật nhiệm vụ!");
    } catch (error) {
        console.error("Lỗi sửa nhiệm vụ:", error);
        alert("Không thể sửa nhiệm vụ. Hãy kiểm tra Firebase Rules.");
    }
}


window.editTask = editTask;

/* Sua ten hien thi thanh vien */
async function editMember(memberId) {
    if (!isCurrentUserLeader()) {
    alert("Chỉ Nhóm trưởng mới được sửa thành viên!");
    return;
}
    const member = membersCache.find(function (item) {
        return item.id === memberId;
    });

    if (!member) {
        alert("Không tìm thấy thành viên!");
        return;
    }

    const newName = prompt("Nhập tên hiển thị mới:", member.name);

    if (newName === null || newName.trim() === "") {
        return;
    }

    try {
        await updateDoc(doc(db, "members", memberId), {
            name: newName.trim()
        });

        // Cap nhat ten hien thi trong cac nhiem vu lien quan
        const relatedTasks = tasksCache.filter(function (task) {
            return task.memberId === memberId;
        });

        for (const task of relatedTasks) {
            await updateDoc(doc(db, "tasks", task.id), {
                memberName: newName.trim()
            });
        }

        alert("Đã sửa tên thành viên thành công!");
    } catch (error) {
        console.error("Lỗi khi sửa thành viên:", error);
        alert("Không thể sửa thành viên!");
    }
}

window.editMember = editMember;

/* Xoa thanh vien neu khong con nhiem vu */
async function deleteMember(memberId) {
    if (!isCurrentUserLeader()) {
    alert("Chỉ Nhóm trưởng mới được xóa thành viên!");
    return;
}
    const member = membersCache.find(function (item) {
        return item.id === memberId;
    });

    if (!member) {
        alert("Không tìm thấy thành viên!");
        return;
    }

    // Khong cho xoa thanh vien neu van con nhiem vu trong nhom
    const hasTasks = tasksCache.some(function (task) {
        return task.memberId === memberId;
    });

    if (hasTasks) {
        alert(
            "Thành viên này vẫn còn nhiệm vụ. " +
            "Hãy chuyển nhiệm vụ sang người khác trước khi xóa!"
        );
        return;
    }

    const confirmDelete = confirm(
        "Bạn có chắc muốn xóa thành viên " +
        member.name +
        " khỏi nhóm này không?"
    );

    if (!confirmDelete) {
        return;
    }

    try {
        await deleteDoc(doc(db, "members", memberId));
        alert("Đã xóa thành viên khỏi nhóm!");
    } catch (error) {
        console.error("Lỗi khi xóa thành viên:", error);
        alert("Không thể xóa thành viên!");
    }
}

window.deleteMember = deleteMember;



/* =========================
   CAP NHAT THONG KE DASHBOARD
========================= */

function updateDashboardStatistics() {
    const totalTasksElement = document.getElementById("totalTasks");
    const completedTasksElement = document.getElementById("completedTasks");
    const pendingTasksElement = document.getElementById("pendingTasks");
    const overdueTasksElement = document.getElementById("overdueTasks");
    const progressBar = document.getElementById("progressBar");
    const progressText = document.getElementById("progressText");

    // Khong lam gi neu trang khong co khu vuc thong ke
    if (
        !totalTasksElement ||
        !completedTasksElement ||
        !pendingTasksElement ||
        !overdueTasksElement ||
        !progressBar ||
        !progressText
    ) {
        return;
    }

    // Chi thong ke bai tap cua nhom dang chon
    const total = tasksCache.length;

    const completed = tasksCache.filter(function (task) {
        return task.completed === true;
    }).length;

    const pending = total - completed;

    // Lay ngay hom nay, bo phan gio
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdue = tasksCache.filter(function (task) {
        if (task.completed || !task.dueDate) {
            return false;
        }

        const parts = task.dueDate.split("-");

        const dueDate = new Date(
            Number(parts[0]),
            Number(parts[1]) - 1,
            Number(parts[2])
        );

        dueDate.setHours(0, 0, 0, 0);

        return !Number.isNaN(dueDate.getTime()) && dueDate < today;
    }).length;

    const percentage = total === 0
        ? 0
        : Math.round((completed / total) * 100);

    totalTasksElement.textContent = total;
    completedTasksElement.textContent = completed;
    pendingTasksElement.textContent = pending;
    overdueTasksElement.textContent = overdue;

    progressBar.style.width = percentage + "%";
    progressText.textContent = percentage + "% hoàn thành";
}




/* Tao nut thao tac nho gon cho nhiem vu */
function createTaskActionButton(text, className, onClick) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "task-action-button " + className;
    button.textContent = text;
    button.addEventListener("click", onClick);

    return button;
}




/* Hien thi danh sach nhiem vu va tien do */

/* Hien thi danh sach nhiem vu va tien do */
function displayTasks() {
    const taskList = document.getElementById("taskList");

    if (!taskList) return;

    taskList.replaceChildren();

    const currentUser = auth.currentUser;
    const isLeader = isCurrentUserLeader();

    const sortedTasks = [...tasksCache].sort(function (a, b) {
        if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
        }

        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;

        return a.dueDate.localeCompare(b.dueDate);
    });

    if (!selectedGroupId) {
        taskList.textContent = "Hãy chọn nhóm để xem nhiệm vụ.";
        displayAllTasks();
        return;
    }

    if (sortedTasks.length === 0) {
        taskList.textContent = "Nhóm chưa có nhiệm vụ nào.";
        displayAllTasks();
        return;
    }

    sortedTasks.forEach(function (task) {
        const li = document.createElement("li");
        li.className = "task-item";

        const assigneeUids = getTaskAssigneeUids(task);
        const maxAssignees = Number(task.maxAssignees || 1);

        // Ten nhiem vu
        const title = document.createElement("h3");
        title.className = "task-title";
        title.textContent = task.name || "Nhiệm vụ chưa có tên";
        li.appendChild(title);

        // Han nop
        const dueDateInfo = document.createElement("p");
        dueDateInfo.className = "task-info";
        dueDateInfo.textContent =
            "Hạn nộp: " + (task.dueDate || "Chưa đặt hạn");
        li.appendChild(dueDateInfo);

        // So nguoi thuc hien
        const peopleInfo = document.createElement("p");
        peopleInfo.className = "task-info";
        peopleInfo.textContent =
            "Số người thực hiện: " +
            assigneeUids.length + "/" + maxAssignees;
        li.appendChild(peopleInfo);

        // Tien do tung thanh vien
        const progressTitle = document.createElement("p");
        progressTitle.className = "task-info";
        progressTitle.textContent = "Tiến độ thành viên:";
        li.appendChild(progressTitle);

        if (assigneeUids.length === 0) {
            const nobody = document.createElement("p");
            nobody.className = "task-info";
            nobody.textContent = "Chưa có ai nhận nhiệm vụ.";
            li.appendChild(nobody);
        }

        assigneeUids.forEach(function (uid) {
            const member = membersCache.find(function (item) {
                return item.userId === uid;
            });

            const name = member
                ? (member.name || member.email || "Thành viên")
                : (uid === currentUser?.uid
                    ? (currentUser.displayName || currentUser.email)
                    : "Thành viên");

            const progress = getMemberProgress(task, uid);

            const progressInfo = document.createElement("p");
            progressInfo.className = "task-info";
            progressInfo.textContent = name + ": " + progress + "%";
            li.appendChild(progressInfo);

            // Moi nguoi chi sua tien do cua chinh minh
            if (currentUser && uid === currentUser.uid) {
                const controls = document.createElement("div");
                controls.className = "task-progress-controls";

                const progressInput = document.createElement("input");
                progressInput.type = "number";
                progressInput.className = "task-progress-input";
                progressInput.min = "0";
                progressInput.max = "100";
                progressInput.step = "1";
                progressInput.value = String(progress);
                progressInput.setAttribute(
                    "aria-label",
                    "Tiến độ của bạn, từ 0 đến 100 phần trăm"
                );

                const saveButton = createTaskActionButton(
                    "Lưu tiến độ",
                    "task-btn-save",
                    function () {
                        updateMyTaskProgress(
                            task.id,
                            progressInput.value
                        );
                    }
                );

                controls.appendChild(progressInput);
                controls.appendChild(saveButton);
                li.appendChild(controls);
            }
        });

        // Trang thai nhiem vu
        const statusInfo = document.createElement("p");
        statusInfo.className = "task-status";

        if (task.completed) {
            statusInfo.textContent = "Đã hoàn thành";
        } else {
            statusInfo.textContent = "Đang thực hiện";
            statusInfo.classList.add("in-progress");
        }

        li.appendChild(statusInfo);

        // Hang nut thao tac
        const actions = document.createElement("div");
        actions.className = "task-actions";

        const alreadyAssigned = currentUser &&
            assigneeUids.includes(currentUser.uid);

        const canClaim = currentUser &&
            !alreadyAssigned &&
            assigneeUids.length < maxAssignees;

        // Nut Nhan nhiem vu
        if (canClaim) {
            const claimButton = createTaskActionButton(
                "✓ Nhận",
                "task-btn-claim",
                function () {
                    claimTask(task.id);
                }
            );

            actions.appendChild(claimButton);
        }

        // Chi Nhom truong duoc sua va xoa
        if (isLeader) {
            const editButton = createTaskActionButton(
                "Sửa",
                "task-btn-edit",
                function () {
                    editTask(task.id);
                }
            );

            const deleteButton = createTaskActionButton(
                "Xóa",
                "task-btn-delete",
                function () {
                    deleteTask(task.id);
                }
            );

            actions.appendChild(editButton);
            actions.appendChild(deleteButton);
        }

        if (actions.children.length > 0) {
            li.appendChild(actions);
        }

        taskList.appendChild(li);
    });

    displayAllTasks();
}





/* Hien thi tat ca nhiem vu trong tab Danh sach nhiem vu */
function displayAllTasks() {
    const allTaskList = document.getElementById("allTaskList");

    if (!allTaskList) return;

    allTaskList.replaceChildren();

    const currentUser = auth.currentUser;
    const isLeader = isCurrentUserLeader();

    const sortedTasks = [...tasksCache].sort(function (a, b) {
        if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
        }

        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;

        return a.dueDate.localeCompare(b.dueDate);
    });

    if (!selectedGroupId) {
        allTaskList.textContent = "Hãy chọn nhóm để xem nhiệm vụ.";
        return;
    }

    if (sortedTasks.length === 0) {
        allTaskList.textContent = "Nhóm chưa có nhiệm vụ nào.";
        return;
    }

    sortedTasks.forEach(function (task) {
        const li = document.createElement("li");
        li.className = "task-item";

        const assigneeUids = getTaskAssigneeUids(task);

        // Ten nhiem vu
        const title = document.createElement("h3");
        title.className = "task-title";
        title.textContent = task.name || "Nhiệm vụ chưa có tên";
        li.appendChild(title);

        // Han nop
        const dueDate = document.createElement("p");
        dueDate.className = "task-info";
        dueDate.textContent =
            "Hạn nộp: " + (task.dueDate || "Chưa đặt hạn");
        li.appendChild(dueDate);

        // Nguoi thuc hien
        const assigneesInfo = document.createElement("p");
        assigneesInfo.className = "task-info";

        if (assigneeUids.length === 0) {
            assigneesInfo.textContent =
                "Người thực hiện: Chưa có ai nhận";
        } else {
            const names = assigneeUids.map(function (uid) {
                const member = membersCache.find(function (item) {
                    return item.userId === uid;
                });

                if (member) {
                    return member.name || member.email || "Thành viên";
                }

                if (currentUser && uid === currentUser.uid) {
                    return currentUser.displayName ||
                        currentUser.email ||
                        "Thành viên";
                }

                return "Thành viên";
            });

            assigneesInfo.textContent =
                "Người thực hiện: " + names.join(", ");
        }

        li.appendChild(assigneesInfo);

        // Tien do tung thanh vien
        const progressTitle = document.createElement("p");
        progressTitle.className = "task-info";
        progressTitle.textContent = "Tiến độ từng thành viên:";
        li.appendChild(progressTitle);

        let totalProgress = 0;

        assigneeUids.forEach(function (uid) {
            const member = membersCache.find(function (item) {
                return item.userId === uid;
            });

            const name = member
                ? (member.name || member.email || "Thành viên")
                : (currentUser && uid === currentUser.uid
                    ? (currentUser.displayName || currentUser.email)
                    : "Thành viên");

            const progress = getMemberProgress(task, uid);
            totalProgress += progress;

            const progressInfo = document.createElement("p");
            progressInfo.className = "task-info";
            progressInfo.textContent = name + ": " + progress + "%";
            li.appendChild(progressInfo);
        });

        // Tien do trung binh
        const averageProgress = assigneeUids.length > 0
            ? Math.round(totalProgress / assigneeUids.length)
            : 0;

        const overallProgress = document.createElement("p");
        overallProgress.className = "task-info";
        overallProgress.textContent =
            "Tiến độ chung: " + averageProgress + "%";
        li.appendChild(overallProgress);

        // Trang thai
        const status = document.createElement("p");
        status.className = "task-status";

        if (task.completed) {
            status.textContent = "Đã hoàn thành";
        } else {
            status.textContent = "Đang thực hiện";
            status.classList.add("in-progress");
        }

        li.appendChild(status);

        // Hang nut thao tac
        const actions = document.createElement("div");
        actions.className = "task-actions";

        // Thanh vien chua nhan co the nhan neu con cho
        const alreadyAssigned = currentUser &&
            assigneeUids.includes(currentUser.uid);

        const maxAssignees = Number(task.maxAssignees || 1);

        const canClaim = currentUser &&
            !alreadyAssigned &&
            assigneeUids.length < maxAssignees;

        if (canClaim) {
            actions.appendChild(
                createTaskActionButton(
                    "✓ Nhận",
                    "task-btn-claim",
                    function () {
                        claimTask(task.id);
                    }
                )
            );
        }

        // Chi Nhom truong duoc sua va xoa
        if (isLeader) {
            actions.appendChild(
                createTaskActionButton(
                    "Sửa",
                    "task-btn-edit",
                    function () {
                        editTask(task.id);
                    }
                )
            );

            actions.appendChild(
                createTaskActionButton(
                    "Xóa",
                    "task-btn-delete",
                    function () {
                        deleteTask(task.id);
                    }
                )
            );
        }

        if (actions.children.length > 0) {
            li.appendChild(actions);
        }

        allTaskList.appendChild(li);
    });
}




/* Thong bao qua han va sap den han trong 3 ngay */
function displayDeadlineNotifications() {
    const notificationBox =
        document.getElementById("deadlineNotifications");

    if (!notificationBox) return;

    notificationBox.replaceChildren();

    if (!selectedGroupId) {
        notificationBox.textContent = "Hãy chọn nhóm để xem thông báo.";
        return;
    }

    // Lay ngay hom nay theo gio may tinh
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Ngay gioi han thong bao la 3 ngay toi
    const limitDate = new Date(today);
    limitDate.setDate(limitDate.getDate() + 3);

    const upcomingTasks = tasksCache
        .filter(function (task) {
            return !task.completed && task.dueDate;
        })
        .map(function (task) {
            const parts = task.dueDate.split("-");

            const dueDate = new Date(
                Number(parts[0]),
                Number(parts[1]) - 1,
                Number(parts[2])
            );

            return {
                ...task,
                parsedDueDate: dueDate
            };
        })
        .filter(function (task) {
            return (
                !Number.isNaN(task.parsedDueDate.getTime()) &&
                task.parsedDueDate <= limitDate
            );
        })
        .sort(function (a, b) {
            return a.parsedDueDate - b.parsedDueDate;
        });

    if (upcomingTasks.length === 0) {
        notificationBox.textContent =
            "Không có nhiệm vụ sắp đến hạn trong 3 ngày tới.";
        return;
    }

    upcomingTasks.forEach(function (task) {
        const item = document.createElement("p");

        const dateText =
            task.parsedDueDate.toLocaleDateString("vi-VN");

        let message = "SẮP ĐẾN HẠN";

        if (task.parsedDueDate < today) {
            message = "QUÁ HẠN";
        } else if (
            task.parsedDueDate.getTime() === today.getTime()
        ) {
            message = "HẠN NỘP HÔM NAY";
        }

        item.textContent =
            message + ": " + task.name +
            " - Người thực hiện: " +
            (task.memberName || "Chưa phân công") +
            " - Hạn nộp: " + dateText;

        notificationBox.appendChild(item);
    });
}

/* Khoi dong du lieu dashboard sau khi dang nhap */
function startDashboard(user) {
    if (dashboardStarted || !isDashboard) return;

    dashboardStarted = true;

    const userNameElement = document.getElementById("userName");

    if (userNameElement) {
        userNameElement.textContent =
            user.displayName || user.email || "Sinh viên";
    }

    listenToUsers();
    listenToGroups(user);
}

/* Kiem tra dang nhap va khoi dong dashboard */
onAuthStateChanged(auth, function (user) {
    const isDashboardPage =
        window.location.pathname.endsWith("dashboard.html");

    const isGroupsPage =
        window.location.pathname.endsWith("groups.html");

    // Neu chua dang nhap, quay ve trang dang nhap
    if ((isDashboardPage || isGroupsPage) && !user) {
        window.location.href = "index.html";
        return;
    }

    // Dashboard phai co groupId tren URL
    if (isDashboardPage) {
        const params = new URLSearchParams(window.location.search);
        const groupId = params.get("groupId");

        if (!groupId) {
            window.location.href = "groups.html";
            return;
        }
    }

    // Hien thi ten tai khoan
    const userNameElement = document.getElementById("userName");

    if (userNameElement && user) {
        userNameElement.textContent =
            user.displayName || user.email;
    }

    // Khoi dong tai du lieu Dashboard
    if (user && isDashboardPage) {
        startDashboard(user);
    }
});



// Chuyển quyền Nhóm trưởng cho thành viên khác
const transferLeaderButton = document.getElementById("transferLeaderButton");

if (transferLeaderButton) {
    transferLeaderButton.addEventListener("click", async function () {
        const newLeaderSelect = document.getElementById("newLeaderSelect");
        const leaderMessage = document.getElementById("leaderMessage");

        if (!auth.currentUser || !isCurrentUserLeader()) {
            alert("Chỉ Nhóm trưởng hiện tại mới có quyền chuyển quyền.");
            return;
        }

        const newLeaderUid = newLeaderSelect.value;

        if (!newLeaderUid) {
            alert("Vui lòng chọn thành viên muốn chuyển quyền.");
            return;
        }

        const selectedGroup = getSelectedGroup();

        if (!selectedGroup) {
            alert("Không tìm thấy nhóm đang chọn.");
            return;
        }

        // Kiểm tra người được chọn có thuộc nhóm không
        const isGroupMember = membersCache.some(function (member) {
            return member.userId === newLeaderUid;
        });

        if (!isGroupMember) {
            alert("Người được chọn không phải thành viên của nhóm.");
            return;
        }

        const confirmed = confirm(
            "Bạn có chắc chắn muốn chuyển quyền Nhóm trưởng không?"
        );

        if (!confirmed) return;

        try {
            await updateDoc(doc(db, "groups", selectedGroupId), {
                leaderUid: newLeaderUid
            });

            if (leaderMessage) {
                leaderMessage.textContent =
                    "Đã chuyển quyền Nhóm trưởng thành công.";
            }

            alert("Chuyển quyền Nhóm trưởng thành công!");
        } catch (error) {
            console.error("Lỗi chuyển quyền:", error);
            alert("Không thể chuyển quyền. Vui lòng thử lại.");
        }
    });
}
