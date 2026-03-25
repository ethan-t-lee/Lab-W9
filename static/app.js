import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "----------------",
  authDomain: "el-lab-w9.firebaseapp.com",
  projectId: "el-lab-w9",
  storageBucket: "el-lab-w9.firebasestorage.app",
  messagingSenderId: "1060075430242",
  appId: "1:1060075430242:web:f9c0f064c32bb98cb58c3b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const signupBtn = document.getElementById("signupBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authStatus = document.getElementById("authStatus");

const taskTitle = document.getElementById("taskTitle");
const taskPriority = document.getElementById("taskPriority");
const addTaskBtn = document.getElementById("addTaskBtn");
const taskList = document.getElementById("taskList");

async function getIdToken() {
  if (!auth.currentUser) return null;
  return await auth.currentUser.getIdToken();
}

async function apiFetch(url, options = {}) {
  const token = await getIdToken();
  console.log("ID token exists:", !!token);

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers
  });
}

signupBtn.onclick = async () => {
  try {
    await createUserWithEmailAndPassword(auth, emailEl.value, passwordEl.value);
  } catch (e) {
    alert(e.message);
  }
};

loginBtn.onclick = async () => {
  try {
    await signInWithEmailAndPassword(auth, emailEl.value, passwordEl.value);
  } catch (e) {
    alert(e.message);
  }
};

logoutBtn.onclick = async () => {
  await signOut(auth);
};

addTaskBtn.onclick = async () => {
  const title = taskTitle.value.trim();
  if (!title) {
    alert("Enter a task");
    return;
  }

  const res = await apiFetch("/api/tasks", {
    method: "POST",
    body: JSON.stringify({
      title,
      priority: taskPriority.value
    })
  });

  const data = await res.json().catch(() => ({}));
  console.log("POST /api/tasks status:", res.status, data);

  if (!res.ok) {
    alert(data.error || `Request failed with status ${res.status}`);
    return;
  }

  taskTitle.value = "";
  await loadTasks();
};

async function loadTasks() {
  const res = await apiFetch("/api/tasks");

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    console.error("Failed to load tasks:", data);
    taskList.innerHTML = "<li>Failed to load tasks</li>";
    return;
  }

  const tasks = await res.json();
  taskList.innerHTML = "";

  if (!tasks.length) {
    taskList.innerHTML = "<li>No tasks yet</li>";
    return;
  }

  tasks.forEach(task => {
    const li = document.createElement("li");

    li.innerHTML = `
      ${task.title} [${task.priority}] ${task.done ? "yes" : "no"}
      <button onclick="toggleTask('${task.id}', ${task.done})">Toggle</button>
      <button onclick="delTask('${task.id}')">Delete</button>
    `;

    taskList.appendChild(li);
  });
}

window.toggleTask = async (id, done) => {
  await apiFetch(`/api/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ done: !done })
  });
  await loadTasks();
};

window.delTask = async (id) => {
  await apiFetch(`/api/tasks/${id}`, {
    method: "DELETE"
  });
  await loadTasks();
};

onAuthStateChanged(auth, async (user) => {
  if (user) {
    authStatus.textContent = `Logged in: ${user.email}`;
    await loadTasks();
  } else {
    authStatus.textContent = "Not logged in";
    taskList.innerHTML = "";
  }
});