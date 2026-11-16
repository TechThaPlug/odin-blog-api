const API_URL = "http://localhost:3000/api";
const TOKEN_KEY = "blogToken";

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
    throw new Error(result.message || "Something went wrong.");
  }

  return result;
}

function showMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.style.color = isError ? "#b42318" : "#416b58";
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString();
}

async function loadPosts() {
  const container = document.querySelector("#posts");
  if (!container) return;

  try {
    const result = await apiRequest("/posts?page=1&limit=10");
    container.replaceChildren();

    if (!result.data || result.data.length === 0) {
      container.append(createElement("p", "", "No articles have been published yet."));
      return;
    }

    result.data.forEach((post) => {
      const card = createElement("article", "post-card");
      const date = createElement("p", "eyebrow", formatDate(post.publishedAt));
      const title = createElement("h3", "", post.title);
      const excerpt = createElement("p", "", post.excerpt || "Read the full article.");
      const link = createElement("a", "", "Read article");
      link.href = `post.html?slug=${encodeURIComponent(post.slug)}`;

      card.append(date, title, excerpt, link);
      container.append(card);
    });
  } catch (error) {
    container.replaceChildren(createElement("p", "", error.message));
  }
}

async function refreshAccountStatus() {
  const status = document.querySelector("#auth-status");
  const logoutButton = document.querySelector("#logout-button");
  if (!status) return;

  if (!getToken()) {
    status.textContent = "Log in or create an account to join the conversation.";
    if (logoutButton) logoutButton.classList.add("hidden");
    return;
  }

  try {
    const result = await apiRequest("/auth/me");
    const user = result.user || result.data || result;

    status.textContent = `Signed in as ${user.username || user.email}.`;

    if (logoutButton) logoutButton.classList.remove("hidden");

    if (user.role === "ADMIN" && !document.querySelector("#admin-dashboard-link")) {
      const link = createElement("a", "", " Open admin dashboard");
      link.id = "admin-dashboard-link";
      link.href = "../admin/index.html";
      status.append(link);
    }
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    status.textContent = "Your session has expired. Please log in again.";
    if (logoutButton) logoutButton.classList.add("hidden");
  }
}

function setupAuthentication() {
  const loginForm = document.querySelector("#login-form");
  const registerForm = document.querySelector("#register-form");
  const logoutButton = document.querySelector("#logout-button");

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = loginForm.querySelector("button");
    button.disabled = true;

    try {
      const formData = new FormData(loginForm);
      const result = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          identifier: formData.get("identifier"),
          password: formData.get("password"),
        }),
      });

      localStorage.setItem(TOKEN_KEY, result.token);
      loginForm.reset();
      await refreshAccountStatus();
    } catch (error) {
      showMessage(document.querySelector("#auth-status"), error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = registerForm.querySelector("button");
    button.disabled = true;

    try {
      const formData = new FormData(registerForm);
      const result = await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: formData.get("username"),
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      });

      localStorage.setItem(TOKEN_KEY, result.token);
      registerForm.reset();
      await refreshAccountStatus();
    } catch (error) {
      showMessage(document.querySelector("#auth-status"), error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  logoutButton?.addEventListener("click", () => {
    localStorage.removeItem(TOKEN_KEY);
    window.location.reload();
  });
}

async function loadArticle() {
  const articleContainer = document.querySelector("#article");
  if (!articleContainer) return;

  const slug = new URLSearchParams(window.location.search).get("slug");

  if (!slug) {
    articleContainer.textContent = "No article was specified.";
    return;
  }

  try {
    const result = await apiRequest(`/posts/${encodeURIComponent(slug)}`);
    const post = result.data;

    articleContainer.replaceChildren();

    articleContainer.append(
      createElement("p", "eyebrow", `BY ${post.author?.username || "AUTHOR"} · ${formatDate(post.publishedAt)}`),
      createElement("h1", "", post.title),
      createElement("p", "", post.excerpt || "")
    );

    const content = createElement("div", "article-content", post.content);
    articleContainer.append(content);

    loadComments(post.comments || []);
    setupCommentForm(post.id);
  } catch (error) {
    articleContainer.textContent = error.message;
    const comments = document.querySelector("#comments");
    if (comments) comments.textContent = "";
    const form = document.querySelector("#comment-form");
    if (form) form.classList.add("hidden");
  }
}

function loadComments(comments) {
  const container = document.querySelector("#comments");
  if (!container) return;

  container.replaceChildren();

  if (!comments.length) {
    container.append(createElement("p", "", "No approved comments yet. Be the first to join the conversation."));
    return;
  }

  comments.forEach((comment) => {
    const item = createElement("div", "comment");
    item.append(
      createElement("strong", "", comment.author?.username || "Reader"),
      createElement("p", "", comment.body),
      createElement("small", "", formatDate(comment.createdAt))
    );
    container.append(item);
  });
}

function setupCommentForm(postId) {
  const form = document.querySelector("#comment-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = document.querySelector("#comment-message");

    if (!getToken()) {
      showMessage(message, "Please log in before submitting a comment.", true);
      return;
    }

    const button = form.querySelector("button");
    button.disabled = true;

    try {
      const formData = new FormData(form);
      await apiRequest(`/posts/${encodeURIComponent(postId)}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: formData.get("body") }),
      });

      form.reset();
      showMessage(message, "Your comment has been submitted and is awaiting approval.");
    } catch (error) {
      showMessage(message, error.message, true);
    } finally {
      button.disabled = false;
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  setupAuthentication();
  await refreshAccountStatus();
  await loadPosts();
  await loadArticle();
});
