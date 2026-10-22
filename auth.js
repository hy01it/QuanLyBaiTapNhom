
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
    onSnapshot,
    serverTimestamp,
    updateDoc,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";


import { auth, db } from "./firebase.js";



/* Hien thi thong bao */
function showMessage(text, color = "red") {
    const message = document.getElementById("message");

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

/* Xu ly dang ky */
const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const name = document.getElementById("registerName").value.trim();
        const email = document.getElementById("registerEmail").value.trim().toLowerCase();
        const password = document.getElementById("registerPassword").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (name === "") {
            showMessage("Vui long nhap ho ten!");
            return;
        }

        if (password.length < 6) {
            showMessage("Mat khau phai co it nhat 6 ky tu!");
            return;
        }

        if (password !== confirmPassword) {
            showMessage("Mat khau xac nhan khong khop!");
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

            await signOut(auth);

            registerForm.reset();

            document.getElementById("registerSection").classList.add("hidden");
            document.getElementById("loginSection").classList.remove("hidden");
            document.getElementById("loginEmail").value = email;

            showMessage("Dang ky thanh cong! Hay dang nhap.", "green");
        } catch (error) {
            if (error.code === "auth/email-already-in-use") {
                showMessage("Email nay da duoc dang ky!");
            } else if (error.code === "auth/invalid-email") {
                showMessage("Email khong hop le!");
            } else if (error.code === "auth/weak-password") {
                showMessage("Mat khau qua yeu!");
            } else {
                showMessage("Dang ky that bai: " + error.message);
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
            window.location.href = "dashboard.html";
        } catch (error) {
            if (
                error.code === "auth/invalid-credential" ||
                error.code === "auth/wrong-password" ||
                error.code === "auth/user-not-found"
            ) {
                showMessage("Email hoac mat khau khong dung!");
            } else if (error.code === "auth/invalid-email") {
                showMessage("Email khong hop le!");
            } else {
                showMessage("Dang nhap that bai: " + error.message);
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
        alert("Dang xuat that bai. Vui long thu lai.");
        console.error(error);
    }
}

/* Cho phep dashboard goi logout() */
window.logout = logout;

/* Kiem tra dang nhap va hien thi ten tai khoan */
onAuthStateChanged(auth, function (user) {
    const isDashboard = window.location.pathname.endsWith("dashboard.html");

    if (isDashboard && !user) {
        window.location.href = "index.html";
        return;
    }

    const userNameElement = document.getElementById("userName");

    if (userNameElement && user) {
        userNameElement.textContent =
            user.displayName || user.email;
    }
});


/* Du lieu thanh vien va nhiem vu tu Firestore */
let membersCache = [];
let tasksCache = [];

/* Them thanh vien */
const memberForm = document.getElementById("memberForm");

if (memberForm) {
    memberForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const memberName = document.getElementById("memberName").value.trim();

        if (memberName === "") {
            alert("Vui long nhap ten thanh vien!");
            return;
        }

        try {
            await addDoc(collection(db, "members"), {
                name: memberName,
                createdBy: auth.currentUser.uid,
                createdAt: serverTimestamp()
            });

            memberForm.reset();
        } catch (error) {
            console.error(error);
            alert("Khong them duoc thanh vien. Hay kiem tra cau hinh Firestore.");
        }
    });
}

/* Hien thi danh sach thanh vien */
function displayMembers() {
    const memberList = document.getElementById("memberList");
    const taskMember = document.getElementById("taskMember");

    if (!memberList || !taskMember) {
        return;
    }

    memberList.innerHTML = "";
    taskMember.innerHTML = '<option value="">-- Chon thanh vien --</option>';

    membersCache.forEach(function (member) {
        
        const li = document.createElement("li");

        // Hien thi ten thanh vien
        const nameSpan = document.createElement("span");
        nameSpan.textContent = member.name;
        li.appendChild(nameSpan);

        // Tao nut Sua
        const editButton = document.createElement("button");
        editButton.textContent = "Sửa";

        editButton.addEventListener("click", function () {
            editMember(member.id);
        });

        
            li.appendChild(editButton);

            // Tao nut Xoa thanh vien
            const deleteButton = document.createElement("button");
            deleteButton.textContent = "Xóa";

            deleteButton.addEventListener("click", function () {
                deleteMember(member.id);
            });

            li.appendChild(deleteButton);

            // Them vao danh sach
            memberList.appendChild(li);



        const option = document.createElement("option");
        option.value = member.id;
        option.textContent = member.name;
        taskMember.appendChild(option);
    });
}

/* Tao va phan cong nhiem vu */
const taskForm = document.getElementById("taskForm");

if (taskForm) {
    taskForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const taskName = document.getElementById("taskName").value.trim();
        
        const dueDate = document.getElementById("taskDueDate").value;
        const completed = false;

        const memberId = document.getElementById("taskMember").value;

        const selectedMember = membersCache.find(function (member) {
            return member.id === memberId;
        });

        if (taskName === "" || !selectedMember) {
            alert("Vui long nhap ten nhiem vu va chon thanh vien!");
            return;
        }

        try {
           
        await addDoc(collection(db, "tasks"), {
            name: taskName,
            memberId: selectedMember.id,
            memberName: selectedMember.name,
            dueDate: dueDate,
            completed: completed,
            createdBy: auth.currentUser.uid,
            createdAt: serverTimestamp()
        });


            taskForm.reset();
        } catch (error) {
            console.error(error);
            alert("Khong tao duoc nhiem vu. Hay kiem tra cau hinh Firestore.");
        }
    });
}


/* Doi trang thai hoan thanh cua nhiem vu */
async function toggleTaskStatus(taskId, currentStatus) {
    try {
        await updateDoc(doc(db, "tasks", taskId), {
            completed: !currentStatus
        });
    } catch (error) {
        console.error("Loi cap nhat trang thai:", error);
        alert("Khong the cap nhat trang thai nhiem vu.");
    }
}


async function deleteTask(taskId) {
    const confirmDelete = confirm("Bạn có chắc muốn xóa công việc này không?");

    if (!confirmDelete) {
        return;
    }

    try {
        await deleteDoc(doc(db, "tasks", taskId));
        alert("Đã xóa công việc!");
    } catch (error) {
        console.error("Lỗi khi xóa công việc:", error);
        alert("Không thể xóa công việc!");
    }
}

window.deleteTask = deleteTask;


async function editTask(taskId) {
    // Tim nhiem vu can sua
    const task = tasksCache.find(function (item) {
        return item.id === taskId;
    });

    if (!task) {
        alert("Khong tim thay nhiem vu!");
        return;
    }

    // Nhap ten nhiem vu moi
    const newName = prompt("Nhap ten nhiem vu:", task.name);

    if (newName === null || newName.trim() === "") {
        return;
    }

    // Nhap han nop moi
    const newDueDate = prompt(
        "Nhap han nop (YYYY-MM-DD), de trong neu khong co han:",
        task.dueDate || ""
    );

    if (newDueDate === null) {
        return;
    }

    // Cap nhat len Firebase
    try {
        await updateDoc(doc(db, "tasks", taskId), {
            name: newName.trim(),
            dueDate: newDueDate.trim()
        });

        alert("Da sua nhiem vu thanh cong!");
    } catch (error) {
        console.error("Loi khi sua nhiem vu:", error);
        alert("Khong the sua nhiem vu!");
    }
}

window.editTask = editTask;


async function editMember(memberId) {
    // Tim thanh vien can sua
    const member = membersCache.find(function (item) {
        return item.id === memberId;
    });

    if (!member) {
        alert("Khong tim thay thanh vien!");
        return;
    }

    // Nhap ten moi
    const newName = prompt(
        "Nhap ten thanh vien moi:",
        member.name
    );

    // Khong lam gi neu bam Cancel hoac de trong
    if (newName === null || newName.trim() === "") {
        return;
    }

    try {
        // Cap nhat ten thanh vien tren Firebase
        await updateDoc(doc(db, "members", memberId), {
            name: newName.trim()
        });

        // Cap nhat ten thanh vien trong cac nhiem vu lien quan
        const relatedTasks = tasksCache.filter(function (task) {
            return task.memberId === memberId;
        });

        for (const task of relatedTasks) {
            await updateDoc(doc(db, "tasks", task.id), {
                memberName: newName.trim()
            });
        }

        alert("Da sua ten thanh vien thanh cong!");
    } catch (error) {
        console.error("Loi khi sua thanh vien:", error);
        alert("Khong the sua thanh vien!");
    }
}

window.editMember = editMember;


async function deleteMember(memberId) {
    // Tim thanh vien can xoa
    const member = membersCache.find(function (item) {
        return item.id === memberId;
    });

    if (!member) {
        alert("Khong tim thay thanh vien!");
        return;
    }

    // Kiem tra thanh vien co nhiem vu hay khong
    const hasTasks = tasksCache.some(function (task) {
        return task.memberId === memberId;
    });

    if (hasTasks) {
        alert(
            "Thanh vien nay van con nhiem vu. " +
            "Hay chuyen cac nhiem vu sang nguoi khac truoc khi xoa!"
        );
        return;
    }

    // Xac nhan truoc khi xoa
    const confirmDelete = confirm(
        "Ban co chac muon xoa thanh vien " + member.name + " khong?"
    );

    if (!confirmDelete) {
        return;
    }

    try {
        await deleteDoc(doc(db, "members", memberId));
        alert("Da xoa thanh vien thanh cong!");
    } catch (error) {
        console.error("Loi khi xoa thanh vien:", error);
        alert("Khong the xoa thanh vien!");
    }
}

window.deleteMember = deleteMember;


/* Hien thi danh sach nhiem vu */
function displayTasks() {
    const taskList = document.getElementById("taskList");

    if (!taskList) {
        return;
    }

    taskList.innerHTML = "";

    if (tasksCache.length === 0) {
        taskList.textContent = "Chua co nhiem vu nao.";
        return;
    }

    tasksCache.forEach(function (task) {
        
const li = document.createElement("li");

const taskName = document.createElement("span");
taskName.textContent = task.name;

const memberInfo = document.createElement("span");
memberInfo.textContent =
    " - Người thực hiện: " + task.memberName;

const dueDateInfo = document.createElement("span");
dueDateInfo.textContent =
    " - Hạn nộp: " + (task.dueDate || "Chưa đặt hạn");

const statusInfo = document.createElement("span");
statusInfo.textContent = task.completed
    ? " - Đã hoàn thành"
    : " - Chưa hoàn thành";


li.appendChild(taskName);
li.appendChild(memberInfo);
li.appendChild(dueDateInfo);
li.appendChild(statusInfo);

const statusButton = document.createElement("button");
statusButton.textContent = task.completed
    ? "Đánh dấu chưa hoàn thành"
    : "Đánh dấu hoàn thành";

statusButton.addEventListener("click", function () {
    toggleTaskStatus(task.id, task.completed === true);
});


li.appendChild(statusButton);


const editButton = document.createElement("button");
editButton.textContent = "Sửa";

editButton.addEventListener("click", function () {
    editTask(task.id);
});

li.appendChild(editButton);

// Nut Xoa nhiem vu
const deleteButton = document.createElement("button");
deleteButton.textContent = "Xóa";

deleteButton.addEventListener("click", function () {
    deleteTask(task.id);
});

li.appendChild(deleteButton);

taskList.appendChild(li);

   });
}


/* Hien thi thong bao han nop */
function displayDeadlineNotifications() {
    const notificationBox = document.getElementById("deadlineNotifications");

    if (!notificationBox) {
        return;
    }

    // Xoa thong bao cu truoc khi hien thi lai
    notificationBox.replaceChildren();

    // Lay ngay hom nay theo gio may tinh
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Ngay gioi han thong bao: 3 ngay toi
    const limitDate = new Date(today);
    limitDate.setDate(limitDate.getDate() + 3);

    // Chi thong bao nhiem vu chua hoan thanh va co han nop
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
            return !Number.isNaN(task.parsedDueDate.getTime()) &&
                task.parsedDueDate <= limitDate;
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

        const dateText = task.parsedDueDate.toLocaleDateString("vi-VN");

        let message = "";

        if (task.parsedDueDate < today) {
            message = "QUÁ HẠN";
        } else if (task.parsedDueDate.getTime() === today.getTime()) {
            message = "HẠN NỘP HÔM NAY";
        } else {
            message = "SẮP ĐẾN HẠN";
        }

        item.textContent =
            message + ": " + task.name +
            " - Người thực hiện: " + (task.memberName || "Chưa phân công") +
            " - Hạn nộp: " + dateText;

        notificationBox.appendChild(item);
    });
}


/* Lang nghe thay doi du lieu truc tiep tu Firestore */
if (document.getElementById("memberList")) {
    onSnapshot(
        collection(db, "members"),
        function (snapshot) {
            membersCache = snapshot.docs.map(function (doc) {
                return {
                    id: doc.id,
                    ...doc.data()
                };
            });

            displayMembers();
        },
        function (error) {
            console.error("Loi doc danh sach thanh vien:", error);
            alert("Khong doc duoc danh sach thanh vien. Hay kiem tra Firestore.");
        }
    );

    
        onSnapshot(
            collection(db, "tasks"),
            function (snapshot) {
                tasksCache = snapshot.docs.map(function (doc) {
                    return {
                        id: doc.id,
                        ...doc.data()
                    };
                });

                displayTasks();
                displayDeadlineNotifications();
            },

        function (error) {
            console.error("Loi doc danh sach nhiem vu:", error);
            alert("Khong doc duoc danh sach nhiem vu. Hay kiem tra Firestore.");
        }
    );
}
