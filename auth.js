
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
    onSnapshot,
    runTransaction
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

import { auth, db } from "./firebase.js";


/* ==================================================
   1. DANG KY / DANG NHAP / DANG XUAT
================================================== */

function showMessage(text, color = "red") {
    const message =
        document.getElementById("authMessage") ||
        document.getElementById("message");

    if (message) {
        message.textContent = text;
        message.style.color = color;
    }
}

// Chuyen sang form dang ky
const showRegister = document.getElementById("showRegister");

if (showRegister) {
    showRegister.addEventListener("click", function (event) {
        event.preventDefault();

        document.getElementById("loginSection")?.classList.add("hidden");
        document.getElementById("registerSection")?.classList.remove("hidden");

        showMessage("");
    });
}

// Chuyen sang form dang nhap
const showLogin = document.getElementById("showLogin");

if (showLogin) {
    showLogin.addEventListener("click", function (event) {
        event.preventDefault();

        document.getElementById("registerSection")?.classList.add("hidden");
        document.getElementById("loginSection")?.classList.remove("hidden");

        showMessage("");
    });
}

// Dang ky tai khoan
const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const name =
            document.getElementById("registerName").value.trim();

        const email =
            document.getElementById("registerEmail").value.trim().toLowerCase();

        const password =
            document.getElementById("registerPassword").value;

        const confirmPassword =
            document.getElementById("confirmPassword").value;

        if (!name) {
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

            await setDoc(doc(db, "users", result.user.uid), {
                uid: result.user.uid,
                name: name,
                email: result.user.email,
                createdAt: serverTimestamp()
            });

            await signOut(auth);

            registerForm.reset();

            document.getElementById("registerSection")?.classList.add("hidden");
            document.getElementById("loginSection")?.classList.remove("hidden");

            const loginEmail = document.getElementById("loginEmail");

            if (loginEmail) {
                loginEmail.value = email;
            }

            showMessage("Đăng ký thành công! Hãy đăng nhập.", "green");

        } catch (error) {
            console.error("Lỗi đăng ký:", error);

            if (error.code === "auth/email-already-in-use") {
                showMessage("Email này đã được đăng ký!");
            } else if (error.code === "auth/invalid-email") {
                showMessage("Email không hợp lệ!");
            } else if (error.code === "auth/weak-password") {
                showMessage("Mật khẩu quá yếu!");
            } else {
                showMessage("Đăng ký thất bại: " + error.message);
            }
        }
    });
}

// Dang nhap tai khoan
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email =
            document.getElementById("loginEmail").value.trim().toLowerCase();

        const password =
            document.getElementById("loginPassword").value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            window.location.href = "groups.html";

        } catch (error) {
            console.error("Lỗi đăng nhập:", error);

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
            }
        }
    });
}

// Dang xuat
async function logout() {
    try {
        await signOut(auth);
        window.location.href = "index.html";

    } catch (error) {
        console.error("Lỗi đăng xuất:", error);
        alert("Đăng xuất thất bại. Vui lòng thử lại.");
    }
}

window.logout = logout;


/* ==================================================
   2. KHAI BAO DU LIEU DASHBOARD
================================================== */

const isDashboard =
    window.location.pathname.endsWith("dashboard.html");

let membersCache = [];
let tasksCache = [];
let usersCache = [];
let groupsCache = [];

let selectedGroupId = "";

let stopMembersListener = null;
let stopTasksListener = null;
let stopUsersListener = null;
let stopGroupsListener = null;

let dashboardStarted = false;

const currentGroupSelect =
    document.getElementById("currentGroup");

const groupMessage =
    document.getElementById("groupMessage");

const memberForm =
    document.getElementById("memberForm");

const taskForm =
    document.getElementById("taskForm");


/* ==================================================
   3. CAC HAM KIEM TRA NHOM
================================================== */

// Lay nhom dang duoc chon
function getSelectedGroup() {
    return groupsCache.find(function (group) {
        return group.id === selectedGroupId;
    });
}

// Lay UID nhom truong
function getLeaderUid(group) {
    if (!group) return "";

    return group.leaderUid || group.createdBy || "";
}

// Kiem tra nguoi dang dang nhap co phai nhom truong
function isCurrentUserLeader() {
    const group = getSelectedGroup();

    return Boolean(
        auth.currentUser &&
        group &&
        getLeaderUid(group) === auth.currentUser.uid
    );
}

// Hien thi thong bao quan ly nhom
function showGroupMessage(message, color = "#68778a") {
    if (!groupMessage) return;

    groupMessage.textContent = message;
    groupMessage.style.color = color;
}


/* ==================================================
   4. QUAN LY CAC TAB DASHBOARD
================================================== */

function activateDashboardTab(panelId) {
    const isLeader = isCurrentUserLeader();

    // Thanh vien thuong khong duoc mo tab tao nhiem vu
    if (panelId === "panelCreateTask" && !isLeader) {
        panelId = "panelOverview";
    }

    document.querySelectorAll(".dashboard-tab").forEach(function (tab) {
        const active = tab.dataset.tab === panelId;

        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
    });

    document.querySelectorAll(".dashboard-tab-panel").forEach(function (panel) {
        panel.hidden = panel.id !== panelId;
    });
}

// Gan su kien cho cac tab
document.querySelectorAll(".dashboard-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
        activateDashboardTab(tab.dataset.tab);
    });
});

// Tab mac dinh
if (isDashboard) {
    activateDashboardTab("panelOverview");
}


/* ==================================================
   5. HIEN THI QUYEN NHOM TRUONG
================================================== */

function updateLeaderManagementVisibility() {
    const isLeader = isCurrentUserLeader();

    const leaderManagement =
        document.getElementById("leaderManagement");

    const createTaskTab =
        document.getElementById("tabCreateTask");

    if (leaderManagement) {
        leaderManagement.hidden = !isLeader;
    }

    if (createTaskTab) {
        createTaskTab.hidden = !isLeader;
    }

    if (memberForm) {
        memberForm.hidden = !isLeader;
    }

    const createTaskPanel =
        document.getElementById("panelCreateTask");

    if (!isLeader && createTaskPanel && !createTaskPanel.hidden) {
        activateDashboardTab("panelOverview");
    }
}


/* ==================================================
   6. QUAN LY TAI KHOAN CO THE THEM VAO NHOM
================================================== */

// Hien thi danh sach tai khoan
function renderAccountOptions() {
    const memberAccount =
        document.getElementById("memberAccount");

    if (!memberAccount) return;

    const previousValue = memberAccount.value;

    memberAccount.innerHTML =
        '<option value="">-- Chọn tài khoản đã đăng ký --</option>';

    usersCache.forEach(function (user) {
        if (
            auth.currentUser &&
            user.uid === auth.currentUser.uid
        ) {
            return;
        }

        const option = document.createElement("option");

        option.value = user.uid;

        option.textContent =
            (user.name || "Chưa có tên") +
            " (" + (user.email || "") + ")";

        memberAccount.appendChild(option);
    });

    if (
        [...memberAccount.options].some(function (option) {
            return option.value === previousValue;
        })
    ) {
        memberAccount.value = previousValue;
    }
}

// Lang nghe danh sach tai khoan
function listenToUsers() {
    if (stopUsersListener) {
        stopUsersListener();
    }

    stopUsersListener = onSnapshot(
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


/* ==================================================
   7. TAI DANH SACH NHOM
================================================== */

function listenToGroups(user) {
    if (stopGroupsListener) {
        stopGroupsListener();
    }

    const groupsQuery = query(
        collection(db, "groups"),
        where("memberUids", "array-contains", user.uid)
    );

    stopGroupsListener = onSnapshot(
        groupsQuery,

        function (snapshot) {
            groupsCache = snapshot.docs.map(function (item) {
                return {
                    id: item.id,
                    ...item.data()
                };
            });

            groupsCache.sort(function (a, b) {
                return (a.name || "").localeCompare(
                    b.name || "",
                    "vi"
                );
            });

            renderGroupOptions();

            if (groupsCache.length === 0) {
                selectedGroupId = "";

                subscribeToSelectedGroup();

                showGroupMessage(
                    "Bạn chưa tham gia nhóm nào. Hãy tạo hoặc tham gia nhóm trước."
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

// Hien thi danh sach nhom trong o chon
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

    let nextGroupId = "";

    if (groupsCache.some(group => group.id === urlGroupId)) {
        nextGroupId = urlGroupId;

    } else if (groupsCache.some(group => group.id === previousGroupId)) {
        nextGroupId = previousGroupId;

    } else if (groupsCache.length > 0) {
        nextGroupId = groupsCache[0].id;
    }

    currentGroupSelect.value = nextGroupId;

    const selectedGroup = groupsCache.find(function (group) {
        return group.id === nextGroupId;
    });

    const groupNameElement =
        document.getElementById("currentGroupName");

    if (groupNameElement) {
        groupNameElement.textContent = selectedGroup
            ? "Nhóm hiện tại: " + selectedGroup.name
            : "Chưa chọn nhóm";
    }

    if (nextGroupId !== selectedGroupId) {
        selectedGroupId = nextGroupId;
        subscribeToSelectedGroup();

    } else {
        updateLeaderManagementVisibility();
    }
}

// Chon nhom khac
if (currentGroupSelect) {
    currentGroupSelect.addEventListener("change", function () {
        selectedGroupId = currentGroupSelect.value;

        const group = getSelectedGroup();
        const groupNameElement =
            document.getElementById("currentGroupName");

        if (groupNameElement) {
            groupNameElement.textContent = group
                ? "Nhóm hiện tại: " + group.name
                : "Chưa chọn nhóm";
        }

        subscribeToSelectedGroup();
    });
}


/* ==================================================
   8. TAO NHOM TU DASHBOARD NEU CO FORM
================================================== */

// HTML dashboard hien tai khong co groupForm.
// Phan nay chi hoat dong neu sau nay ban them form nay.
const groupForm = document.getElementById("groupForm");

if (groupForm) {
    groupForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const user = auth.currentUser;

        const nameInput =
            document.getElementById("groupName");

        const groupName = nameInput?.value.trim();

        if (!user) {
            alert("Vui lòng đăng nhập lại.");
            return;
        }

        if (!groupName) {
            alert("Vui lòng nhập tên nhóm.");
            return;
        }

        try {
            const groupRef = await addDoc(collection(db, "groups"), {
                name: groupName,
                createdBy: user.uid,
                leaderUid: user.uid,
                memberUids: [user.uid],
                createdAt: serverTimestamp()
            });

            // Tao ho so thanh vien cho nguoi tao nhom
            await addDoc(collection(db, "members"), {
                name: user.displayName || user.email,
                email: user.email,
                userId: user.uid,
                groupId: groupRef.id,
                createdBy: user.uid,
                createdAt: serverTimestamp()
            });

            groupForm.reset();

            showGroupMessage(
                "Đã tạo nhóm thành công!",
                "#247a3d"
            );

        } catch (error) {
            console.error("Lỗi tạo nhóm:", error);
            alert("Không tạo được nhóm. Hãy kiểm tra Firestore Rules.");
        }
    });
}


/* ==================================================
   9. TAI THANH VIEN VA NHIEM VU CUA NHOM
================================================== */

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

    const memberSubmitButton =
        memberForm?.querySelector("button[type='submit']");

    const taskSubmitButton =
        taskForm?.querySelector("button[type='submit']");

    if (memberSubmitButton) {
        memberSubmitButton.disabled = !selectedGroupId;
    }

    if (taskSubmitButton) {
        taskSubmitButton.disabled = !selectedGroupId;
    }

    if (!selectedGroupId) {
        showGroupMessage(
            "Hãy tạo hoặc chọn nhóm trước khi thêm thành viên và nhiệm vụ."
        );
        return;
    }

    showGroupMessage("Đang làm việc trong nhóm đã chọn.");

    // Lang nghe thanh vien
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
            displayTasks();
        },

        function (error) {
            console.error("Lỗi đọc thành viên:", error);

            showGroupMessage(
                "Không đọc được thành viên. Hãy kiểm tra Firestore Rules.",
                "#b72d2d"
            );
        }
    );

    // Lang nghe nhiem vu
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


/* ==================================================
   10. THEM THANH VIEN VAO NHOM
================================================== */

if (memberForm) {
    memberForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!auth.currentUser || !selectedGroupId) {
            alert("Bạn cần đăng nhập và chọn nhóm trước!");
            return;
        }

        if (!isCurrentUserLeader()) {
            alert("Chỉ Nhóm trưởng mới được thêm thành viên!");
            return;
        }

        const userId =
            document.getElementById("memberAccount").value;

        const selectedUser = usersCache.find(function (user) {
            return user.uid === userId;
        });

        if (!selectedUser) {
            alert("Vui lòng chọn một tài khoản đã đăng ký!");
            return;
        }

        const alreadyAdded = membersCache.some(function (member) {
            return member.userId === selectedUser.uid;
        });

        if (alreadyAdded) {
            alert("Tài khoản này đã có trong nhóm!");
            return;
        }

        try {
            const groupId = selectedGroupId;

            await addDoc(collection(db, "members"), {
                name: selectedUser.name || "Chưa có tên",
                email: selectedUser.email || "",
                userId: selectedUser.uid,
                groupId: groupId,
                createdBy: auth.currentUser.uid,
                createdAt: serverTimestamp()
            });

            await updateDoc(doc(db, "groups", groupId), {
                memberUids: arrayUnion(selectedUser.uid)
            });

            memberForm.reset();

            alert("Đã thêm thành viên vào nhóm thành công!");

        } catch (error) {
            console.error("Lỗi thêm thành viên:", error);

            alert(
                "Không thêm được thành viên. Hãy kiểm tra Firebase Rules."
            );
        }
    });
}


/* ==================================================
   11. HIEN THI THANH VIEN
================================================== */

function displayMembers() {
    const memberList =
        document.getElementById("memberList");

    const taskMember =
        document.getElementById("taskMember");

    if (memberList) {
        memberList.replaceChildren();
    }

    if (taskMember) {
        taskMember.innerHTML =
            '<option value="">-- Chọn thành viên --</option>';
    }

    if (!selectedGroupId) {
        if (memberList) {
            memberList.textContent =
                "Hãy tạo hoặc chọn nhóm trước.";
        }

        renderLeaderOptions();
        updateLeaderManagementVisibility();
        return;
    }

    if (membersCache.length === 0 && memberList) {
        memberList.textContent =
            "Nhóm chưa có thành viên. Hãy thêm tài khoản đã đăng ký.";
    }

    membersCache.forEach(function (member) {
        // Hien thi danh sach thanh vien
        if (memberList) {
            const li = document.createElement("li");
            li.className = "member-item";

            const info = document.createElement("div");
            info.className = "member-info";

            const name = document.createElement("span");
            name.className = "member-name";
            name.textContent = member.name || "Chưa có tên";

            const email = document.createElement("span");
            email.className = "member-email";
            email.textContent = member.email || "Chưa có email";

            info.appendChild(name);
            info.appendChild(email);
            li.appendChild(info);

            // Chi nhom truong duoc sua va xoa
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
        }

        // Them vao danh sach giao nhiem vu
        if (taskMember) {
            const option = document.createElement("option");

            option.value = member.id;
            option.textContent =
                member.name || member.email || "Thành viên";

            taskMember.appendChild(option);
        }
    });

    renderLeaderOptions();
    updateLeaderManagementVisibility();
}


/* ==================================================
   12. CHUYEN QUYEN NHOM TRUONG
================================================== */

function renderLeaderOptions() {
    const newLeaderSelect =
        document.getElementById("newLeaderSelect");

    if (!newLeaderSelect) return;

    newLeaderSelect.innerHTML =
        '<option value="">-- Chọn thành viên --</option>';

    if (!isCurrentUserLeader()) return;

    const currentLeaderUid = auth.currentUser.uid;
    const addedUids = new Set();

    membersCache.forEach(function (member) {
        const memberUid = member.userId;

        if (!memberUid) return;
        if (memberUid === currentLeaderUid) return;
        if (addedUids.has(memberUid)) return;

        addedUids.add(memberUid);

        const option = document.createElement("option");

        option.value = memberUid;
        option.textContent =
            member.name || member.email || "Thành viên";

        newLeaderSelect.appendChild(option);
    });
}

const transferLeaderButton =
    document.getElementById("transferLeaderButton");

if (transferLeaderButton) {
    transferLeaderButton.addEventListener("click", async function () {
        const newLeaderSelect =
            document.getElementById("newLeaderSelect");

        const leaderMessage =
            document.getElementById("leaderMessage");

        if (!auth.currentUser || !isCurrentUserLeader()) {
            alert("Chỉ Nhóm trưởng hiện tại mới có quyền chuyển quyền.");
            return;
        }

        const newLeaderUid = newLeaderSelect?.value;

        if (!newLeaderUid) {
            alert("Vui lòng chọn thành viên muốn chuyển quyền.");
            return;
        }

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


/* ==================================================
   13. TAO NHIEM VU
================================================== */

if (taskForm) {
    taskForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!auth.currentUser || !selectedGroupId) {
            alert("Bạn cần đăng nhập và chọn nhóm trước!");
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
                createdAt: serverTimestamp(),

                // Cac truong tuong thich voi du lieu cu
                memberId: selectedMember ? selectedMember.id : "",
                memberName: selectedMember ? selectedMember.name : "",
                assigneeUid: selectedMember ? selectedMember.userId : "",
                assigneeEmail: selectedMember ? selectedMember.email : ""
            };

            await addDoc(collection(db, "tasks"), taskData);

            taskForm.reset();

            document.getElementById("taskMaxPeople").value = "1";

            alert("Đã tạo nhiệm vụ thành công!");

        } catch (error) {
            console.error("Lỗi tạo nhiệm vụ:", error);

            alert("Không tạo được nhiệm vụ. Hãy kiểm tra Firebase Rules.");
        }
    });
}


/* ==================================================
   14. CAC HAM HO TRO NHIEM VU
================================================== */

// Lay UID nhung nguoi duoc giao nhiem vu
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

        if (member?.userId) {
            return [member.userId];
        }
    }

    return [];
}

// Lay tien do cua mot thanh vien
function getMemberProgress(task, uid) {
    if (
        task.progressByUid &&
        typeof task.progressByUid[uid] === "number"
    ) {
        return task.progressByUid[uid];
    }

    if (task.assigneeUid === uid && task.completed === true) {
        return 100;
    }

    return 0;
}

// Tao nut thao tac
function createTaskActionButton(text, className, onClick) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "task-action-button " + className;
    button.textContent = text;
    button.addEventListener("click", onClick);

    return button;
}


/* ==================================================
   15. CAP NHAT TIEN DO CA NHAN
================================================== */

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

    assigneeUids.forEach(function (assigneeUid) {
        if (typeof progressByUid[assigneeUid] !== "number") {
            progressByUid[assigneeUid] =
                getMemberProgress(task, assigneeUid);
        }
    });

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


/* ==================================================
   16. NHAN NHIEM VU
================================================== */

async function claimTask(taskId) {
    const task = tasksCache.find(function (item) {
        return item.id === taskId;
    });

    const user = auth.currentUser;

    if (!task || !user) {
        alert("Không tìm thấy nhiệm vụ hoặc phiên đăng nhập.");
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
        const taskRef = doc(db, "tasks", taskId);

        // Giao dich giup tranh hai nguoi nhan cung mot cho cuoi
        await runTransaction(db, async function (transaction) {
            const taskSnapshot = await transaction.get(taskRef);

            if (!taskSnapshot.exists()) {
                throw new Error("Nhiệm vụ không còn tồn tại.");
            }

            const latestTask = taskSnapshot.data();

            if (latestTask.groupId !== selectedGroupId) {
                throw new Error("Nhiệm vụ không thuộc nhóm hiện tại.");
            }

            const assignees = Array.isArray(latestTask.assigneeUids)
                ? [...latestTask.assigneeUids]
                : (latestTask.assigneeUid
                    ? [latestTask.assigneeUid]
                    : []);

            const maxAssignees = Number(latestTask.maxAssignees || 1);

            if (assignees.includes(user.uid)) {
                throw new Error("Bạn đã nhận nhiệm vụ này rồi.");
            }

            if (assignees.length >= maxAssignees) {
                throw new Error("Nhiệm vụ đã đủ số người tối đa.");
            }

            const progressByUid = {
                ...(latestTask.progressByUid || {}),
                [user.uid]: 0
            };

            assignees.push(user.uid);

            transaction.update(taskRef, {
                assigneeUids: assignees,
                progressByUid: progressByUid
            });
        });

        alert("Bạn đã nhận nhiệm vụ thành công!");

    } catch (error) {
        console.error("Lỗi nhận nhiệm vụ:", error);
        alert(error.message || "Không thể nhận nhiệm vụ.");
    }
}


/* ==================================================
   17. SUA VA XOA NHIEM VU
================================================== */

// Xoa nhiem vu
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


// Sua ten va han nop nhiem vu
async function editTask(taskId) {
    if (!isCurrentUserLeader()) {
        alert("Chỉ Nhóm trưởng mới được sửa nhiệm vụ!");
        return;
    }

    const task = tasksCache.find(function (item) {
        return item.id === taskId;
    });

    if (!task) {
        alert("Không tìm thấy nhiệm vụ!");
        return;
    }

    const newName = prompt(
        "Nhập tên nhiệm vụ mới:",
        task.name || ""
    );

    if (newName === null) return;

    if (!newName.trim()) {
        alert("Tên nhiệm vụ không được để trống!");
        return;
    }

    const newDueDate = prompt(
        "Nhập hạn nộp theo định dạng YYYY-MM-DD. Để trống nếu không đặt hạn:",
        task.dueDate || ""
    );

    if (newDueDate === null) return;

    const dateValue = newDueDate.trim();

    if (dateValue && !isValidDate(dateValue)) {
        alert("Ngày không hợp lệ. Hãy nhập theo dạng YYYY-MM-DD.");
        return;
    }

    try {
        await updateDoc(doc(db, "tasks", taskId), {
            name: newName.trim(),
            dueDate: dateValue
        });

        alert("Đã cập nhật nhiệm vụ!");

    } catch (error) {
        console.error("Lỗi sửa nhiệm vụ:", error);
        alert("Không thể sửa nhiệm vụ. Hãy kiểm tra Firebase Rules.");
    }
}

window.editTask = editTask;

// Kiem tra ngay hop le
function isValidDate(dateString) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return false;
    }

    const [year, month, day] = dateString.split("-").map(Number);

    const date = new Date(year, month - 1, day);

    return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
    );
}


/* ==================================================
   18. SUA THANH VIEN
================================================== */

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

    const newName = prompt(
        "Nhập tên hiển thị mới:",
        member.name || ""
    );

    if (newName === null) return;

    if (!newName.trim()) {
        alert("Tên thành viên không được để trống!");
        return;
    }

    try {
        await updateDoc(doc(db, "members", memberId), {
            name: newName.trim()
        });

        // Cap nhat ten trong cac nhiem vu cu
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
        console.error("Lỗi sửa thành viên:", error);
        alert("Không thể sửa thành viên!");
    }
}

window.editMember = editMember;


/* ==================================================
   19. XOA THANH VIEN VA DONG BO DU LIEU
================================================== */

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

    // Khong cho xoa nhom truong hien tai
    if (member.userId === getLeaderUid(getSelectedGroup())) {
        alert("Không thể xóa Nhóm trưởng hiện tại. Hãy chuyển quyền trước.");
        return;
    }

    // Kiem tra thanh vien co dang duoc giao nhiem vu khong
    const hasTasks = tasksCache.some(function (task) {
        const assignees = getTaskAssigneeUids(task);

        return (
            task.memberId === memberId ||
            assignees.includes(member.userId)
        );
    });

    if (hasTasks) {
        alert(
            "Thành viên này vẫn còn nhiệm vụ. " +
            "Hãy xử lý hoặc chuyển nhiệm vụ trước khi xóa!"
        );
        return;
    }

    const confirmed = confirm(
        "Bạn có chắc muốn xóa thành viên " +
        (member.name || member.email || "") +
        " khỏi nhóm này không?"
    );

    if (!confirmed) return;

    try {
        const groupId = selectedGroupId;

        // Xoa ho so thanh vien
        await deleteDoc(doc(db, "members", memberId));

        // Xoa UID khoi danh sach thanh vien cua nhom
        if (member.userId) {
            await updateDoc(doc(db, "groups", groupId), {
                memberUids: arrayRemove(member.userId)
            });
        }

        alert("Đã xóa thành viên khỏi nhóm!");

    } catch (error) {
        console.error("Lỗi xóa thành viên:", error);

        alert(
            "Không thể xóa thành viên. Hãy kiểm tra Firebase Rules."
        );
    }
}

window.deleteMember = deleteMember;


/* ==================================================
   20. TINH THONG KE DASHBOARD
================================================== */

function updateDashboardStatistics() {
    const totalElement =
        document.getElementById("totalTasks");

    const completedElement =
        document.getElementById("completedTasks");

    const pendingElement =
        document.getElementById("pendingTasks");

    const overdueElement =
        document.getElementById("overdueTasks");

    const progressBar =
        document.getElementById("progressBar");

    const progressText =
        document.getElementById("progressText");

    if (
        !totalElement ||
        !completedElement ||
        !pendingElement ||
        !overdueElement ||
        !progressBar ||
        !progressText
    ) {
        return;
    }

    const total = tasksCache.length;

    const completed = tasksCache.filter(function (task) {
        return task.completed === true;
    }).length;

    const pending = total - completed;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdue = tasksCache.filter(function (task) {
        if (task.completed || !task.dueDate) {
            return false;
        }

        if (!isValidDate(task.dueDate)) {
            return false;
        }

        const [year, month, day] = task.dueDate.split("-").map(Number);

        const dueDate = new Date(year, month - 1, day);

        return dueDate < today;
    }).length;

    const percentage = total === 0
        ? 0
        : Math.round((completed / total) * 100);

    totalElement.textContent = total;
    completedElement.textContent = completed;
    pendingElement.textContent = pending;
    overdueElement.textContent = overdue;

    progressBar.style.width = percentage + "%";
    progressText.textContent = percentage + "% hoàn thành";
}


/* ==================================================
   21. HIEN THI NHIEM VU
================================================== */

function displayTasks() {
    const taskList =
        document.getElementById("taskList");

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

        const title = document.createElement("h3");
        title.className = "task-title";
        title.textContent = task.name || "Nhiệm vụ chưa có tên";
        li.appendChild(title);

        const dueDateInfo = document.createElement("p");
        dueDateInfo.className = "task-info";
        dueDateInfo.textContent =
            "Hạn nộp: " + (task.dueDate || "Chưa đặt hạn");
        li.appendChild(dueDateInfo);

        const peopleInfo = document.createElement("p");
        peopleInfo.className = "task-info";
        peopleInfo.textContent =
            "Số người thực hiện: " +
            assigneeUids.length + "/" + maxAssignees;
        li.appendChild(peopleInfo);

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

            // Moi thanh vien chi sua tien do cua minh
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

        const statusInfo = document.createElement("p");
        statusInfo.className = "task-status";

        if (task.completed) {
            statusInfo.textContent = "Đã hoàn thành";
        } else {
            statusInfo.textContent = "Đang thực hiện";
            statusInfo.classList.add("in-progress");
        }

        li.appendChild(statusInfo);

        const actions = document.createElement("div");
        actions.className = "task-actions";

        const alreadyAssigned =
            currentUser && assigneeUids.includes(currentUser.uid);

        const canClaim =
            currentUser &&
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

        taskList.appendChild(li);
    });

    displayAllTasks();
}


/* ==================================================
   22. HIEN THI DANH SACH TAT CA NHIEM VU
================================================== */

function displayAllTasks() {
    const allTaskList =
        document.getElementById("allTaskList");

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

        const title = document.createElement("h3");
        title.className = "task-title";
        title.textContent = task.name || "Nhiệm vụ chưa có tên";
        li.appendChild(title);

        const dueDate = document.createElement("p");
        dueDate.className = "task-info";
        dueDate.textContent =
            "Hạn nộp: " + (task.dueDate || "Chưa đặt hạn");
        li.appendChild(dueDate);

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

        const averageProgress = assigneeUids.length > 0
            ? Math.round(totalProgress / assigneeUids.length)
            : 0;

        const overallProgress = document.createElement("p");
        overallProgress.className = "task-info";
        overallProgress.textContent =
            "Tiến độ chung: " + averageProgress + "%";

        li.appendChild(overallProgress);

        const status = document.createElement("p");
        status.className = "task-status";

        if (task.completed) {
            status.textContent = "Đã hoàn thành";
        } else {
            status.textContent = "Đang thực hiện";
            status.classList.add("in-progress");
        }

        li.appendChild(status);

        const actions = document.createElement("div");
        actions.className = "task-actions";

        const alreadyAssigned =
            currentUser && assigneeUids.includes(currentUser.uid);

        const maxAssignees = Number(task.maxAssignees || 1);

        const canClaim =
            currentUser &&
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


/* ==================================================
   23. THONG BAO HAN NOP
================================================== */

function displayDeadlineNotifications() {
    const notificationBox =
        document.getElementById("deadlineNotifications");

    if (!notificationBox) return;

    notificationBox.replaceChildren();

    if (!selectedGroupId) {
        notificationBox.textContent =
            "Hãy chọn nhóm để xem thông báo.";
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const limitDate = new Date(today);
    limitDate.setDate(limitDate.getDate() + 3);

    const upcomingTasks = tasksCache
        .filter(function (task) {
            return (
                !task.completed &&
                task.dueDate &&
                isValidDate(task.dueDate)
            );
        })
        .map(function (task) {
            const [year, month, day] =
                task.dueDate.split("-").map(Number);

            const dueDate = new Date(year, month - 1, day);

            return {
                ...task,
                parsedDueDate: dueDate
            };
        })
        .filter(function (task) {
            // Hien thi ca nhiem vu qua han va sap den han
            return task.parsedDueDate <= limitDate;
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

        const assigneeUids = getTaskAssigneeUids(task);

        const assigneeNames = assigneeUids.map(function (uid) {
            const member = membersCache.find(function (item) {
                return item.userId === uid;
            });

            return member
                ? (member.name || member.email || "Thành viên")
                : "Thành viên";
        });

        item.textContent =
            message +
            ": " + task.name +
            " - Người thực hiện: " +
            (assigneeNames.length > 0
                ? assigneeNames.join(", ")
                : "Chưa phân công") +
            " - Hạn nộp: " + dateText;

        notificationBox.appendChild(item);
    });
}


/* ==================================================
   24. KHOI DONG DASHBOARD
================================================== */

function startDashboard(user) {
    if (dashboardStarted || !isDashboard) return;

    dashboardStarted = true;

    const userNameElement =
        document.getElementById("userName");

    if (userNameElement) {
        userNameElement.textContent =
            user.displayName || user.email || "Sinh viên";
    }

    listenToUsers();
    listenToGroups(user);
}


/* ==================================================
   25. KIEM TRA DANG NHAP
================================================== */

onAuthStateChanged(auth, function (user) {
    const isDashboardPage =
        window.location.pathname.endsWith("dashboard.html");

    const isGroupsPage =
        window.location.pathname.endsWith("groups.html");

    // Bao ve trang nhom va dashboard
    if ((isDashboardPage || isGroupsPage) && !user) {
        window.location.href = "index.html";
        return;
    }

    // Dashboard can co groupId
    if (isDashboardPage) {
        const params =
            new URLSearchParams(window.location.search);

        const groupId = params.get("groupId");

        if (!groupId) {
            window.location.href = "groups.html";
            return;
        }
    }

    // Hien thi ten nguoi dung
    const userNameElement =
        document.getElementById("userName");

    if (userNameElement && user) {
        userNameElement.textContent =
            user.displayName || user.email || "Sinh viên";
    }

    // Khoi dong dashboard
    if (user && isDashboardPage) {
        startDashboard(user);
    }
});
