const API_URL = "http://localhost:3000/api";
const TOKEN_KEY = "blogToken";

let currentUser = null;
let editingPostId = null;

const getToken = () => localStorage.getItem(TOKEN_KEY);

async function apiRequest(endpoint, options = {}) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.message || "The request could not be completed.");
  }

  return result;
}

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function message(id, text, isError = false) {
  const target = document.querySelector(`#${id}`);
  if (!target) return;
  target.textContent = text;
  target.style.color = isError ? "#b42318" : "#416b58";
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "Not published";
}

function showDashboard(user) {
  currentUser = user;
  document.querySelector("#login-section").classList.add("hidden");
  document.querySelector("#dashboard").classList.remove("hidden");
  document.querySelector("#logout-button").classList.remove("hidden");
  document.querySelector("#welcome-message").textContent =
    `Signed in as ${user.username || user.email}.`;
  loadPosts();
  loadComments();
}

function showLogin() {
  currentUser = null;
  document.querySelector("#login-section").classList.remove("hidden");
  document.querySelector("#dashboard").classList.add("hidden");
  document.querySelector("#logout-button").classList.add("hidden");
}

async function verifyAdminSession() {
  if (!getToken()) {
    showLogin();
    return;
  }

  try {
    const result = await apiRequest("/auth/me");
    const user = result.user || result.data || result;

    if (user.role !== "ADMIN") {
      throw new Error("This account does not have administrator access.");
    }

    showDashboard(user);
  } catch (error) {
    localStorage.removeItem(TOKEN_KEY);
    showLogin();
    message("login-message", error.message, true);
  }
}

function setupLogin() {
  const form = document.querySelector("#login-form");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button");
    button.disabled = true;
    message("login-message", "Signing in...");

    try {
      const data = new FormData(form);
      const result = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          identifier: data.get("identifier"),
          password: data.get("password"),
        }),
      });

      localStorage.setItem(TOKEN_KEY, result.token);

      const session = await apiRequest("/auth/me");
      const user = session.user || session.data || session;

      if (user.role !== "ADMIN") {
        localStorage.removeItem(TOKEN_KEY);
        throw new Error("This account does not have administrator access.");
      }

      form.reset();
      message("login-message", "");
      showDashboard(user);
    } catch (error) {
      message("login-message", error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector("#logout-button").addEventListener("click", () => {
    localStorage.removeItem(TOKEN_KEY);
    showLogin();
    message("login-message", "You have been signed out.");
  });
}

function resetPostForm() {
  editingPostId = null;
  document.querySelector("#post-form").reset();
  document.querySelector("#post-form-title").textContent = "Create an article";
  document.querySelector("#save-post-button").textContent = "Create draft";
  document.querySelector("#cancel-edit-button").classList.add("hidden");
  message("post-message", "");
}

function setupPostForm() {
  const form = document.querySelector("#post-form");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const button = document.querySelector("#save-post-button");
    const data = new FormData(form);
    const payload = {
      title: data.get("title"),
      excerpt: data.get("excerpt"),
      content: data.get("content"),
    };

    button.disabled = true;

    try {
      if (editingPostId) {
        await apiRequest(`/admin/posts/${encodeURIComponent(editingPostId)}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        message("post-message", "Article updated successfully.");
      } else {
        await apiRequest("/admin/posts", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        message("post-message", "Draft created successfully.");
      }

      resetPostForm();
      await loadPosts();
    } catch (error) {
      message("post-message", error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector("#cancel-edit-button").addEventListener("click", resetPostForm);
}

async function loadPosts() {
  const container = document.querySelector("#posts-list");
  container.textContent = "Loading articles...";

  try {
    const result = await apiRequest("/admin/posts?page=1&limit=50");
    const posts = result.data || [];
    container.replaceChildren();

    if (!posts.length) {
      container.textContent = "No articles yet. Create your first draft above.";
      return;
    }

    posts.forEach((post) => {
      const card = element("article", "item");
      const heading = element("h3", "", post.title);
      const status = element(
        "span",
        `status ${post.isPublished ? "" : "draft"}`,
        post.isPublished ? "Published" : "Draft",
      );
      const meta = element(
        "p",
        "item-meta",
        `Created ${formatDate(post.createdAt)} · ${post._count?.comments ?? 0} comments`,
      );
      const excerpt = element("p", "", post.excerpt || "No excerpt provided.");
      const actions = element("div", "item-actions");

      const editButton = element("button", "", "Edit");
      editButton.type = "button";
      editButton.addEventListener("click", () => {
        editingPostId = post.id;
        document.querySelector("#post-title").value = post.title || "";
        document.querySelector("#post-excerpt").value = post.excerpt || "";
        document.querySelector("#post-content").value = post.content || "";
        document.querySelector("#post-form-title").textContent = "Edit article";
        document.querySelector("#save-post-button").textContent = "Save changes";
        document.querySelector("#cancel-edit-button").classList.remove("hidden");
        message("post-message", "Editing selected article.");
        window.scrollTo({ top: 0, behavior: "smooth" });
      });

      const publishButton = element(
        "button",
        "secondary",
        post.isPublished ? "Unpublish" : "Publish",
      );
      publishButton.type = "button";
      publishButton.addEventListener("click", async () => {
        const action = post.isPublished ? "unpublish" : "publish";
        publishButton.disabled = true;
        try {
          await apiRequest(`/admin/posts/${encodeURIComponent(post.id)}/${action}`, {
            method: "PATCH",
          });
          await loadPosts();
        } catch (error) {
          window.alert(error.message);
          publishButton.disabled = false;
        }
      });

      const deleteButton = element("button", "danger", "Delete");
      deleteButton.type = "button";
      deleteButton.addEventListener("click", async () => {
        if (!window.confirm(`Delete "${post.title}" permanently?`)) return;
        deleteButton.disabled = true;
        try {
          await apiRequest(`/admin/posts/${encodeURIComponent(post.id)}`, {
            method: "DELETE",
          });
          if (editingPostId === post.id) resetPostForm();
          await loadPosts();
        } catch (error) {
          window.alert(error.message);
          deleteButton.disabled = false;
        }
      });

      actions.append(editButton, publishButton, deleteButton);
      card.append(heading, status, meta, excerpt, actions);
      container.append(card);
    });
  } catch (error) {
    container.textContent = error.message;
  }
}

async function loadComments() {
  const container = document.querySelector("#comments-list");
  container.textContent = "Loading comments...";

  try {
    const result = await apiRequest("/admin/comments");
    const comments = result.data || [];
    container.replaceChildren();

    if (!comments.length) {
      container.textContent = "No comments have been submitted yet.";
      return;
    }

    comments.forEach((comment) => {
      const card = element("article", "item");
      const heading = element("h3", "", comment.author?.username || "Reader");
      const status = element(
        "span",
        `status ${comment.isApproved ? "" : "draft"}`,
        comment.isApproved ? "Approved" : "Awaiting approval",
      );
      const meta = element(
        "p",
        "item-meta",
        `${comment.post?.title || "Article"} · ${formatDate(comment.createdAt)}`,
      );
      const body = element("p", "item-content", comment.body);
      const actions = element("div", "item-actions");

      const approvalButton = element(
        "button",
        "",
        comment.isApproved ? "Unapprove" : "Approve",
      );
      approvalButton.type = "button";
      approvalButton.addEventListener("click", async () => {
        approvalButton.disabled = true;
        try {
          await apiRequest(`/admin/comments/${encodeURIComponent(comment.id)}/approval`, {
            method: "PATCH",
            body: JSON.stringify({ isApproved: !comment.isApproved }),
          });
          await loadComments();
        } catch (error) {
          window.alert(error.message);
          approvalButton.disabled = false;
        }
      });

      const deleteButton = element("button", "danger", "Delete");
      deleteButton.type = "button";
      deleteButton.addEventListener("click", async () => {
        if (!window.confirm("Delete this comment permanently?")) return;
        deleteButton.disabled = true;
        try {
          await apiRequest(`/admin/comments/${encodeURIComponent(comment.id)}`, {
            method: "DELETE",
          });
          await loadComments();
        } catch (error) {
          window.alert(error.message);
          deleteButton.disabled = false;
        }
      });

      actions.append(approvalButton, deleteButton);
      card.append(heading, status, meta, body, actions);
      container.append(card);
    });
  } catch (error) {
    container.textContent = error.message;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  setupLogin();
  setupPostForm();

  document.querySelector("#refresh-posts-button").addEventListener("click", loadPosts);
  document.querySelector("#refresh-comments-button").addEventListener("click", loadComments);

  await verifyAdminSession();
});
