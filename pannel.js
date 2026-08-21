const SUPABASE_URL = "https://xswkxjymswnveppratwx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhzd2t4anltc3dudmVwcHJhdHd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3OTQ5NTYsImV4cCI6MjEwMjM3MDk1Nn0.sOZhMZMfIBXKn9QgcPLUz9rmpwlHfNE52Bu8RBXIki0";

let _supabase = null;
if (window.supabase && typeof window.supabase.createClient === 'function') {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
    console.error("Supabase SDK not loaded properly. Check your script tags in HTML.");
}

let currentUser = null;
let editPostId = null;

function getUserDisplayName(user) {
    if (!user) return "Admin System";
    if (typeof user === 'string') return user.split('@')[0];
    return user.user_metadata?.full_name || (user.email ? user.email.split('@')[0] : "Admin System");
}

document.addEventListener("DOMContentLoaded", async () => {
    if (!_supabase) return;

    const { data: { session }, error } = await _supabase.auth.getSession();

    if (error || !session) {
        window.location.href = "login.html";
        return;
    }

    currentUser = session.user;
    fetchPosts();
    fetchMetrics();
});

async function fetchMetrics() {
    if (!_supabase) return;

    try {
        const { count: postsCount } = await _supabase
            .from("posts")
            .select("*", { count: 'exact', head: true });

        const { count: commentsCount } = await _supabase
            .from("comments")
            .select("*", { count: 'exact', head: true });

        const postsCounterElem = document.getElementById("totalPostsCount");
        const commentsCounterElem = document.getElementById("totalCommentsCount");

        if (postsCounterElem) postsCounterElem.innerText = postsCount || 0;
        if (commentsCounterElem) commentsCounterElem.innerText = commentsCount || 0;
    } catch (err) {
        console.error("Error fetching system metrics:", err);
    }
}

async function logout() {
    if (_supabase) await _supabase.auth.signOut();
    window.location.href = "admin.html";
}

function previewImage(input) {
    const previewContainer = document.getElementById("imagePreviewContainer");
    const previewImage = document.getElementById("imagePreview");
    const uploadText = document.getElementById("uploadText");

    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            previewImage.src = e.target.result;
            if (previewContainer) previewContainer.classList.remove("d-none");
        };
        reader.readAsDataURL(input.files[0]);
        if (uploadText) uploadText.innerText = "Change Attachment";
    } else {
        if (previewImage) previewImage.src = "";
        if (previewContainer) previewContainer.classList.add("d-none");
        if (uploadText) uploadText.innerText = "Upload Attachment";
    }
}

async function post(event) {
    event.preventDefault();

    if (!_supabase) {
        Swal.fire("Error", "Supabase client is not initialized.", "error");
        return;
    }

    const title = document.getElementById("title") ? document.getElementById("title").value.trim() : "";
    const description = document.getElementById("description") ? document.getElementById("description").value.trim() : "";
    const fileInput = document.getElementById("background-image");
    const file = fileInput ? fileInput.files[0] : null;

    let imageUrl = null;

    Swal.fire({
        title: editPostId ? "Updating Broadcast..." : "Publishing Broadcast...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        if (file) {
            const fileName = `${Date.now()}_${file.name}`;
            const { error: uploadError } = await _supabase.storage
                .from("post-images")
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = _supabase.storage
                .from("post-images")
                .getPublicUrl(fileName);

            imageUrl = urlData.publicUrl;
        }

        const authorName = "ADMIN: " + getUserDisplayName(currentUser);

        if (editPostId) {
            const updateData = { title, description };
            if (imageUrl) updateData.image_url = imageUrl;

            const { error } = await _supabase
                .from("posts")
                .update(updateData)
                .eq("id", editPostId);

            if (error) throw error;

            Swal.fire("Updated!", "Post updated successfully by Admin.", "success");
            editPostId = null;
            const formTitle = document.getElementById("formTitle");
            const postBtn = document.getElementById("postBtn");
            if (formTitle) formTitle.innerText = "Publish System Announcement";
            if (postBtn) postBtn.innerText = "Broadcast Post";
        } else {
            const { error } = await _supabase
                .from("posts")
                .insert([{
                    title,
                    description,
                    image_url: imageUrl,
                    user_id: currentUser.id,
                    user_name: authorName,
                    author_name: authorName
                }]);

            if (error) throw error;

            Swal.fire("Broadcasted!", "System announcement is live.", "success");
        }

        resetForm();
        fetchPosts();
        fetchMetrics();

    } catch (error) {
        Swal.fire("Error", error.message, "error");
    }
}

function resetForm() {
    const postForm = document.getElementById("postForm");
    if (postForm) postForm.reset();
    const previewContainer = document.getElementById("imagePreviewContainer");
    if (previewContainer) previewContainer.classList.add("d-none");
    const uploadText = document.getElementById("uploadText");
    if (uploadText) uploadText.innerText = "Upload Attachment";
}

async function fetchPosts() {
    const postsContainer = document.getElementById("posts");
    if (!postsContainer || !_supabase) return;

    postsContainer.innerHTML = '<div class="text-center text-secondary py-4"><i class="fa-solid fa-spinner fa-spin fs-3"></i></div>';

    try {
        const { data: posts, error } = await _supabase
            .from("posts")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        postsContainer.innerHTML = "";

        if (!posts || posts.length === 0) {
            postsContainer.innerHTML = '<p class="text-secondary text-center py-4">No system posts found.</p>';
            return;
        }

        for (const item of posts) {
            const card = document.createElement("div");
            card.className = "card post-card mb-4 shadow-lg border-secondary";

            const authorDisplayName = item.author_name || item.user_name || (item.user_email ? item.user_email.split('@')[0] : "Anonymous User");

            card.innerHTML = `
        <div class="card-header d-flex justify-content-between align-items-center py-2 px-3 bg-secondary bg-opacity-25">
          <small class="text-info fw-bold"><i class="fa-solid fa-user-gear me-1"></i>${authorDisplayName}</small>
          <div class="action-buttons">
            <button class="btn btn-sm text-info p-1 me-2 edit-btn" title="Edit Content" onclick="editPost('${item.id}', '${escapeQuotes(item.title)}', '${escapeQuotes(item.description)}')">
              <i class="fa-solid fa-pen-to-square fs-5"></i>
            </button>
            <button class="btn btn-sm text-danger p-1 delete-btn" title="Delete Content" onclick="deletePost('${item.id}')">
              <i class="fa-solid fa-trash fs-5"></i>
            </button>
          </div>
        </div>
        ${item.image_url ? `
          <div class="text-center bg-dark p-2">
            <img src="${item.image_url}" class="img-fluid rounded" style="max-height: 180px; object-fit: contain;" alt="Post attachment">
          </div>
        ` : ""}
        <div class="card-body">
          <h5 class="card-title post-title fw-bold text-info">${item.title}</h5>
          <p class="card-text post-body text-light">${item.description || ""}</p>

          <div class="mt-3 pt-3 border-top border-secondary">
            <h6 class="small fw-bold text-secondary mb-2"><i class="fa-solid fa-comments me-1"></i> Admin Moderated Comments</h6>
            
            <div id="comments-list-${item.id}" class="mb-3">
              <small class="text-muted d-block mb-1">Loading comments...</small>
            </div>

            <div class="input-group input-group-sm">
              <input type="text" id="comment-input-${item.id}" class="form-control bg-dark text-light border-secondary" placeholder="Write admin reply...">
              <button class="btn btn-info fw-bold" onclick="addComment('${item.id}')">
                <i class="fa-solid fa-paper-plane"></i>
              </button>
            </div>
          </div>
        </div>
      `;

            postsContainer.appendChild(card);
            fetchComments(item.id);
        }

    } catch (error) {
        postsContainer.innerHTML = `<p class="text-danger">Failed to load system posts: ${error.message}</p>`;
    }
}

function escapeQuotes(str) {
    if (!str) return "";
    return str
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/"/g, "&quot;")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "");
}

function editPost(id, title, description) {
    editPostId = id;
    const titleInput = document.getElementById("title");
    const descInput = document.getElementById("description");

    if (titleInput) titleInput.value = title;
    if (descInput) descInput.value = description;

    const formTitle = document.getElementById("formTitle");
    const postBtn = document.getElementById("postBtn");

    if (formTitle) formTitle.innerText = "Edit Moderated Content";
    if (postBtn) postBtn.innerText = "Update Broadcast";

    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deletePost(id) {
    const result = await Swal.fire({
        title: "Delete this post as Admin?",
        text: "This action will permanently purge the record.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        confirmButtonText: "Purge Post"
    });

    if (result.isConfirmed) {
        try {
            const { error, count } = await _supabase
                .from("posts")
                .delete({ count: 'exact' })
                .eq("id", id);

            if (error) throw error;

            if (count === 0) {
                Swal.fire("Action Denied", "Post could not be deleted. Check RLS policies.", "error");
                return;
            }

            Swal.fire("Purged", "Post removed by Admin.", "success");
            fetchPosts();
            fetchMetrics();
        } catch (error) {
            Swal.fire("Error", error.message, "error");
        }
    }
}

async function fetchComments(postId) {
    const commentsList = document.getElementById(`comments-list-${postId}`);
    if (!commentsList || !_supabase) return;

    try {
        const { data: comments, error } = await _supabase
            .from("comments")
            .select("*")
            .eq("post_id", postId)
            .order("created_at", { ascending: true });

        if (error) throw error;

        if (!comments || comments.length === 0) {
            commentsList.innerHTML = '<span class="text-muted small">No comments logged.</span>';
            return;
        }

        commentsList.innerHTML = comments.map(c => {
            const commenterName = c.author_name || c.user_name || (c.user_email ? c.user_email.split('@')[0] : 'Anonymous');
            const bodyContent = c.content || c.comment_text || c.comment || '';

            return `
      <div class="comment-box p-2 mb-2 d-flex justify-content-between align-items-center">
        <div>
          <strong class="text-info small" style="font-size: 11px;">${commenterName}</strong>
          <p class="mb-0 text-light small">${bodyContent}</p>
        </div>
        <button class="btn btn-sm text-danger p-0 ms-2" title="Delete Comment" onclick="deleteComment('${c.id}', '${postId}')">
            <i class="fa-solid fa-xmark fs-6"></i>
        </button>
      </div>
    `;
        }).join("");

    } catch (error) {
        commentsList.innerHTML = `<span class="text-danger small">Error loading comments.</span>`;
    }
}

async function deleteComment(commentId, postId) {
    try {
        const { error, count } = await _supabase
            .from("comments")
            .delete({ count: 'exact' })
            .eq("id", commentId);

        if (error) throw error;

        if (count === 0) {
            Swal.fire("Action Denied", "Comment could not be deleted. Check RLS policies.", "error");
            return;
        }

        fetchComments(postId);
        fetchMetrics();
    } catch (error) {
        Swal.fire("Error", error.message, "error");
    }
}

async function addComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    if (!input) return;
    const commentText = input.value.trim();

    if (!commentText) return;

    const authorName = "ADMIN: " + getUserDisplayName(currentUser);

    try {
        const { error } = await _supabase
            .from("comments")
            .insert([{
                post_id: postId,
                user_id: currentUser.id,
                author_name: authorName,
                user_name: authorName,
                content: commentText
            }]);

        if (error) throw error;

        input.value = "";
        fetchComments(postId);
        fetchMetrics();

    } catch (error) {
        Swal.fire("Error", error.message, "error");
    }
}

function searchPosts() {
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) return;
    const query = searchInput.value.toLowerCase();
    const posts = document.querySelectorAll(".post-card");

    posts.forEach((post) => {
        const title = post.querySelector(".post-title")?.innerText.toLowerCase() || "";
        const body = post.querySelector(".post-body")?.innerText.toLowerCase() || "";

        if (title.includes(query) || body.includes(query)) {
            post.style.display = "block";
        } else {
            post.style.display = "none";
        }
    });
}